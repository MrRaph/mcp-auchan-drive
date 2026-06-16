/**
 * locator.ts — Store locator Auchan Drive
 *
 * Approche deux étapes :
 *   1. GET nominatim.openstreetmap.org (géocodage libre, sans cookies)
 *   2. GET /offering-contexts (API Auchan avec cookies)
 *
 * Params /offering-contexts capturés live depuis le navigateur :
 *   accuracy=MUNICIPALITY, address.country=France, filters.pos=<vide>,
 *   filters.slots=<vide>, channels=PICK_UP,SHIPPING
 */

import type { CookieProvider, Store } from '../types.js';
import { Throttler } from './throttle.js';

// ─── Types Nominatim ──────────────────────────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
}

// ─── Types /offering-contexts ─────────────────────────────────────────────────

interface OfferingSeller {
  id?: string;
  name?: string;
  type?: string;
}

interface OfferingAddress {
  formattedAddress?: string;
  zipcode?: string;
  city?: string;
}

interface OfferingContext {
  seller?: OfferingSeller;
  address?: OfferingAddress;
  distance?: number;
}

type OfferingResponse = OfferingContext[] | { results?: OfferingContext[] };

function toArray<T>(raw: T[] | { results?: T[] }): T[] {
  return Array.isArray(raw) ? raw : (raw?.results ?? []);
}

// ─── StoreLocator ─────────────────────────────────────────────────────────────

export class StoreLocator {
  constructor(
    private readonly cookieProvider: CookieProvider,
    private readonly throttler: Throttler,
    private readonly baseUrl = 'https://www.auchan.fr',
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  // ── Étape 1 : géocodage via Nominatim (sans auth) ──────────────────────────

  private async geocode(query: string): Promise<NominatimResult | null> {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=fr&addressdetails=1`;

    const response = await this.fetchFn(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'mcp-auchan-drive/1.0 (personal grocery assistant)',
      },
    });

    if (!response.ok) return null;
    const results = (await response.json()) as NominatimResult[];
    return results[0] ?? null;
  }

  // ── Étape 2 : drives autour des coordonnées via Auchan ─────────────────────

  private async fetchOfferingContexts(
    lat: number,
    lng: number,
    zipcode: string,
    city: string,
    country: string,
  ): Promise<OfferingContext[]> {
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
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) this.cookieProvider.invalidate();
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & { status: number };
        err.status = response.status;
        throw err;
      }

      const raw = (await response.json()) as OfferingResponse;
      return toArray(raw);
    });
  }

  /**
   * Trouve les drives Auchan proches d'une ville ou d'un code postal.
   * Retourne [] si la requête ne correspond à aucune localité française.
   */
  async findStores(query: string): Promise<Store[]> {
    // Étape 1 : géocodage Nominatim
    const place = await this.geocode(query);
    if (!place) return [];

    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    if (isNaN(lat) || isNaN(lng)) return [];

    const zipcode = place.address?.postcode ?? '';
    const city =
      place.address?.city ??
      place.address?.town ??
      place.address?.village ??
      place.address?.county ??
      query;
    const country = place.address?.country ?? 'France';

    // Étape 2 : drives Auchan
    const contexts = await this.fetchOfferingContexts(lat, lng, zipcode, city, country);

    return contexts
      .filter((ctx): boolean => Boolean(ctx.seller?.id))
      .map((ctx): Store => ({
        id: ctx.seller!.id!,
        name: ctx.seller?.name ?? '',
        address:
          ctx.address?.formattedAddress ??
          `${ctx.address?.city ?? ''} ${ctx.address?.zipcode ?? ''}`.trim(),
        distance: ctx.distance,
        type: ctx.seller?.type ?? 'GROCERY',
      }));
  }
}
