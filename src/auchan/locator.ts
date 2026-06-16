/**
 * locator.ts — Store locator Auchan Drive
 *
 * Approche deux étapes :
 *   1. GET api-adresse.data.gouv.fr (géocodage officiel FR, code postal inclus)
 *   2. GET /offering-contexts (réponse HTML CREST, pas JSON)
 *
 * Headers requis par le serveur Auchan (découverts par capture réseau Firefox) :
 *   Accept: application/crest          ← déclenche la réponse CREST (pas HTML full-page)
 *   X-Crest-Renderer: journey-renderer ← identifie le renderer côté serveur
 *   X-Requested-With: XMLHttpRequest
 *
 * Note : address.zipcode est OBLIGATOIRE pour /offering-contexts (500 sinon).
 *   Nominatim ne retourne pas de postcode pour les grandes villes — on utilise
 *   l'API adresse.data.gouv.fr qui retourne toujours un code postal pour toutes
 *   les communes françaises (Lyon → 69001, Paris → 75001, etc.)
 *
 * Structure HTML retournée :
 *   <div class="...journeyPosItem..." data-id="<uuid>"
 *        data-lat="..." data-lng="..."
 *        data-type="DRIVE" data-zipcode="..." data-city="...">
 *     ...
 *     <span class="place-pos__name">Auchan Drive Saint-Genis (Chapônost)</span>
 *     ...
 *     <span>5.14 km</span>
 *   </div>
 */

import type { CookieProvider, Store } from '../types.js';
import { Throttler } from './throttle.js';

// ─── Types géocodage ──────────────────────────────────────────────────────────

interface GeoPlace {
  lat: number;
  lng: number;
  postcode: string;
  city: string;
}

// ─── Helpers HTML ─────────────────────────────────────────────────────────────

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`  ))?.[1];
}

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

// ─── StoreLocator ─────────────────────────────────────────────────────────────

export class StoreLocator {
  constructor(
    private readonly cookieProvider: CookieProvider,
    private readonly throttler: Throttler,
    private readonly baseUrl = 'https://www.auchan.fr',
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  // ── Étape 1 : géocodage via api-adresse.data.gouv.fr ──────────────────────
  // Avantage sur Nominatim : retourne toujours un code postal pour les communes FR.
  // Le code postal est OBLIGATOIRE pour /offering-contexts (sinon 500 serveur).

  private async geocode(query: string): Promise<GeoPlace | null> {
    const url =
      `https://api-adresse.data.gouv.fr/search/` +
      `?q=${encodeURIComponent(query)}&limit=1&type=municipality`;

    const response = await this.fetchFn(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'mcp-auchan-drive/1.0 (personal grocery assistant)',
      },
    });

    if (!response.ok) return null;

    interface GouvFeature {
      geometry: { coordinates: [number, number] };
      properties: { postcode?: string; city?: string };
    }
    interface GouvResponse { features?: GouvFeature[] }

    const json = (await response.json()) as GouvResponse;
    const feat = json.features?.[0];
    if (!feat) return null;

    return {
      lat: feat.geometry.coordinates[1],
      lng: feat.geometry.coordinates[0],
      postcode: feat.properties.postcode ?? '',
      city: feat.properties.city ?? query,
    };
  }

  // ── Étape 2 : drives via /offering-contexts (réponse HTML CREST) ───────────

  private async fetchOfferingContextsHtml(
    lat: number,
    lng: number,
    zipcode: string,
    city: string,
    country: string,
  ): Promise<string> {
    return this.throttler.run(async () => {
      const cookie = await this.cookieProvider.getCookie();

      const params = new URLSearchParams({
        'address.zipcode': zipcode,
        'address.city': city,
        'address.country': country,
        'location.latitude': String(lat),
        'location.longitude': String(lng),
        'accuracy': 'MUNICIPALITY',
        'position': '1',
        'sellerType': 'GROCERY',
        'filters.pos': '',
        'filters.slots': '',
        'filters.validStoreReferences': '',
        'channels': 'PICK_UP,SHIPPING',
      });

      const url = `${this.baseUrl}/offering-contexts?${params}`;
      const response = await this.fetchFn(url, {
        headers: {
          Cookie: cookie,
          // Ces deux headers sont requis pour obtenir la réponse CREST (fragment HTML)
          // au lieu de la page HTML complète (qui retourne 404 express-style)
          Accept: 'application/crest',
          'X-Crest-Renderer': 'journey-renderer',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${this.baseUrl}/checkout/cart/`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) this.cookieProvider.invalidate();
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & { status: number };
        err.status = response.status;
        throw err;
      }

      return response.text();
    });
  }

  // ── Parse du HTML CREST ────────────────────────────────────────────────────

  private parseStoresHtml(html: string): Store[] {
    const stores: Store[] = [];

    // Chaque drive est un <div class="...journeyPosItem..." data-id="<uuid>" ...>
    const wrapperRe = /<div[^>]+class="[^"]*journeyPosItem[^"]*"[^>]*>/g;
    let wrapperMatch: RegExpExecArray | null;

    while ((wrapperMatch = wrapperRe.exec(html)) !== null) {
      const tag = wrapperMatch[0];

      const id = attr(tag, 'data-id');
      if (!id) continue;

      const type = attr(tag, 'data-type') ?? 'DRIVE';
      const zipcode = attr(tag, 'data-zipcode') ?? '';
      const city = attr(tag, 'data-city') ?? '';

      // Contexte HTML du bloc store (500 chars suffisent pour le nom + distance)
      const ctx = html.slice(wrapperMatch.index, wrapperMatch.index + 1500);

      // Nom depuis class="place-pos__name"
      const nameM = ctx.match(/class="[^"]*place-pos__name[^"]*"[^>]*>([^<]+)/);
      const name = nameM ? decode(nameM[1].trim()) : `Auchan Drive ${city}`;

      // Adresse depuis class="place-pos__address" (peut ne pas exister)
      const addrM = ctx.match(/class="[^"]*place-pos__address[^"]*"[^>]*>([^<]+)/);
      const address = addrM
        ? decode(addrM[1].trim())
        : `${city} ${zipcode}`.trim();

      // Distance en mètres depuis le texte "X,XX km" dans le bloc
      const distM = ctx.match(/(\d+[,.]?\d*)\s*km/i);
      const distance = distM ? Math.round(parseFloat(distM[1].replace(',', '.')) * 1000) : undefined;

      stores.push({ id, name, address, distance, type });
    }

    return stores;
  }

  /**
   * Trouve les drives Auchan proches d'une ville ou d'un code postal.
   * Retourne [] si la requête ne correspond à aucune localité française.
   */
  async findStores(query: string): Promise<Store[]> {
    // Étape 1 : géocodage (api-adresse.data.gouv.fr → code postal garanti)
    const place = await this.geocode(query);
    if (!place) return [];

    // Étape 2 : drives Auchan (réponse HTML CREST)
    const html = await this.fetchOfferingContextsHtml(
      place.lat, place.lng, place.postcode, place.city, 'FR',
    );
    return this.parseStoresHtml(html);
  }
}
