import { describe, it, expect, vi } from 'vitest';
import { StoreLocator } from '../../src/auchan/locator.js';
import { Throttler } from '../../src/auchan/throttle.js';
import type { CookieProvider } from '../../src/types.js';

function fastThrottler() {
  return new Throttler({ minIntervalMs: 0, jitterMs: 0, maxRetries: 0, backoffBaseMs: 0 });
}

function fakeCookies(): CookieProvider {
  return {
    getCookie: vi.fn().mockResolvedValue('lark-session=test; datadome=dd; lark-consentId=c-uuid'),
    invalidate: vi.fn(),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Réponse api-adresse.data.gouv.fr pour Lyon (GeoJSON)
const GOUV_LYON = {
  features: [{
    geometry: { coordinates: [4.8320, 45.7578] },
    properties: { postcode: '69001', city: 'Lyon' },
  }],
};

// Réponse HTML CREST de /offering-contexts (structure réelle Auchan)
const STORES_HTML = `
<section class="journey__offering-contexts">
  <div class="journey-offering-context__wrapper journeyPosItem shadow--light"
    data-id="b42fbf5b-51d4-42d0-bad8-abe4e6963846"
    data-lat="45.79719" data-lng="4.85138"
    data-restricted="false" data-type="DRIVE"
    data-zipcode="69300" data-city="CALUIRE-ET-CUIRE">
    <span class="place-pos__name">Drive Caluire</span>
    <span class="place-pos__address">22 Rue des Canuts, 69300 Caluire-et-Cuire</span>
    <span>3.2 km</span>
  </div>
  <div class="journey-offering-context__wrapper journeyPosItem shadow--light"
    data-id="c53gcf6c-62e5-53b1-cbd9-bcf5f7074957"
    data-lat="45.760" data-lng="4.832"
    data-restricted="false" data-type="DRIVE"
    data-zipcode="69003" data-city="LYON">
    <span class="place-pos__name">Drive Lyon Part-Dieu</span>
    <span class="place-pos__address">17 Rue du Docteur Bouchut, 69003 Lyon</span>
    <span>1.5 km</span>
  </div>
</section>
`;

// Construit un fetch mocké avec deux réponses séquentielles :
//   1. api-adresse.data.gouv.fr → GeoJSON (json())
//   2. /offering-contexts       → HTML CREST (text())
function makeFetch(gouvResult = GOUV_LYON, offeringHtml: string = STORES_HTML): typeof fetch {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(gouvResult),
      text: () => Promise.resolve(JSON.stringify(gouvResult)),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(offeringHtml),
      json: () => Promise.resolve({}),
    } as Response);
}

// ── findStores ────────────────────────────────────────────────────────────────

describe('StoreLocator.findStores', () => {
  it('retourne les drives depuis la fixture HTML CREST', async () => {
    const locator = new StoreLocator(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', makeFetch());
    const stores = await locator.findStores('Lyon');

    expect(stores).toHaveLength(2);

    const caluire = stores.find((s) => s.name === 'Drive Caluire');
    expect(caluire).toBeDefined();
    expect(caluire!.id).toBe('b42fbf5b-51d4-42d0-bad8-abe4e6963846');
    expect(caluire!.address).toContain('Caluire');
    expect(caluire!.distance).toBe(3200);
    expect(caluire!.type).toBe('DRIVE');
  });

  it('mappe correctement tous les champs id, name, address, distance, type', async () => {
    const locator = new StoreLocator(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', makeFetch());
    const stores = await locator.findStores('69000');

    const partDieu = stores.find((s) => s.name === 'Drive Lyon Part-Dieu');
    expect(partDieu).toBeDefined();
    expect(partDieu!.id).toBe('c53gcf6c-62e5-53b1-cbd9-bcf5f7074957');
    expect(partDieu!.address).toBe('17 Rue du Docteur Bouchut, 69003 Lyon');
    expect(partDieu!.distance).toBe(1500);
    expect(partDieu!.type).toBe('DRIVE');
  });

  it('retourne [] si api-adresse.data.gouv.fr ne trouve aucune localité', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ features: [] }),
    } as Response);
    const locator = new StoreLocator(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    const stores = await locator.findStores('villebidon99999');

    expect(stores).toEqual([]);
    // Géocodage appelé mais /offering-contexts non appelé
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retourne [] si /offering-contexts ne contient aucun journeyPosItem', async () => {
    const locator = new StoreLocator(
      fakeCookies(), fastThrottler(), 'https://www.auchan.fr',
      makeFetch(GOUV_LYON, '<section class="journey__offering-contexts"></section>'),
    );
    const stores = await locator.findStores('Lyon');

    expect(stores).toEqual([]);
  });

  it('filtre les journeyPosItem sans data-id', async () => {
    const htmlWithMissingId = `
      <div class="journeyPosItem" data-type="DRIVE">
        <span class="place-pos__name">Sans ID</span>
      </div>
      ${STORES_HTML}
    `;
    const locator = new StoreLocator(
      fakeCookies(), fastThrottler(), 'https://www.auchan.fr',
      makeFetch(GOUV_LYON, htmlWithMissingId),
    );
    const stores = await locator.findStores('Lyon');

    expect(stores.every((s) => s.id)).toBe(true);
    expect(stores).toHaveLength(2);
  });

  it('décode les entités HTML dans les noms (ex: &#xF4; → ô)', async () => {
    const htmlWithEntity = `
      <div class="journey-offering-context__wrapper journeyPosItem shadow--light"
        data-id="d240e702-a1ab-e800-34fe-d683523ebab0"
        data-type="DRIVE" data-zipcode="69630" data-city="CHAPONOST">
        <span class="place-pos__name">Auchan Drive Saint-Genis (Chap&#xF4;nost)</span>
        <span>5.1 km</span>
      </div>
    `;
    const locator = new StoreLocator(
      fakeCookies(), fastThrottler(), 'https://www.auchan.fr',
      makeFetch(GOUV_LYON, htmlWithEntity),
    );
    const stores = await locator.findStores('Lyon');

    expect(stores[0].name).toBe('Auchan Drive Saint-Genis (Chapônost)');
  });

  it('invalide le cookie et lève une erreur sur 403 de /offering-contexts', async () => {
    const cookies = fakeCookies();
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(GOUV_LYON),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

    const locator = new StoreLocator(cookies, fastThrottler(), 'https://www.auchan.fr', fetchFn);
    await expect(locator.findStores('Lyon')).rejects.toThrow('HTTP 403');
    expect(cookies.invalidate).toHaveBeenCalled();
  });

  it('envoie les bons headers CREST vers /offering-contexts', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(GOUV_LYON),
      } as Response)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: () => Promise.resolve(STORES_HTML),
      } as Response);

    const locator = new StoreLocator(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    await locator.findStores('Lyon');

    const [, offeringCall] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    const offeringHeaders = offeringCall[1]?.headers as Record<string, string>;
    expect(offeringHeaders['Accept']).toBe('application/crest');
    expect(offeringHeaders['X-Crest-Renderer']).toBe('journey-renderer');
    expect(offeringHeaders['X-Requested-With']).toBe('XMLHttpRequest');
  });
});
