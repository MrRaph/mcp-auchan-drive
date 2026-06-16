import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuchanClient } from '../../src/auchan/client.js';
import { Throttler } from '../../src/auchan/throttle.js';
import type { CookieProvider } from '../../src/types.js';
import cartGetFixture from '../fixtures/cart-get-response.json' assert { type: 'json' };
import cartAddFixture from '../fixtures/cart-add-response.json' assert { type: 'json' };
import cartUpdateFixture from '../fixtures/cart-update-response.json' assert { type: 'json' };
import cartRemoveFixture from '../fixtures/cart-remove-response.json' assert { type: 'json' };

// HTML minimal simulant une page de résultats de recherche Auchan Drive
const SEARCH_HTML = `
<html><body>
<div class="quantity-selector"
  data-product-id="acfdc139-5da2-4e2c-b652-5687fa2932b1"
  data-offer-id="19f46dfd-f09f-5533-9958-a71f53c6adbb"
  data-seller-id="b42fbf5b-51d4-42d0-bad8-abe4e6963846"
  data-seller-type="GROCERY">
</div>
<p class="product-thumbnail__description">Beurre tendre doux 82%MG</p>
<article><strong>ELLE &amp; VIRE</strong></article>
<div class="product-price">2,98 €</div>
<span>11,92 € / kg</span>
<span class="product-attribute">250g</span>
<a href="/produit/pr-C1264653">voir</a>
</body></html>
`;

// Throttler sans délai pour les tests
function fastThrottler() {
  return new Throttler({ minIntervalMs: 0, jitterMs: 0, maxRetries: 3, backoffBaseMs: 0 });
}

// CookieProvider factice
function fakeCookies(cookie = 'lark-session=test; datadome=dd; lark-consentId=consent-uuid'): CookieProvider {
  return {
    getCookie: vi.fn().mockResolvedValue(cookie),
    invalidate: vi.fn(),
  };
}

// Construit un mock fetch retournant une réponse JSON
function mockFetchJson(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

// Construit un mock fetch retournant du HTML
function mockFetchHtml(html: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(html),
  } as Response);
}

// Construit un mock fetch qui échoue avec un status HTTP
function mockFetchError(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response);
}

// ── search ────────────────────────────────────────────────────────────────────

describe('AuchanClient.search', () => {
  it('retourne les produits parsés depuis le HTML de recherche', async () => {
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', mockFetchHtml(SEARCH_HTML));
    const results = await client.search('beurre');

    expect(results).toHaveLength(1);
    expect(results[0].productId).toBe('acfdc139-5da2-4e2c-b652-5687fa2932b1');
    expect(results[0].offerId).toBe('19f46dfd-f09f-5533-9958-a71f53c6adbb');
    expect(results[0].name).toBe('Beurre tendre doux 82%MG');
    expect(results[0].brand).toBe('ELLE & VIRE');
    expect(results[0].price).toBe(298);
    expect(results[0].pricePerKg).toBe(1192);
    expect(results[0].format).toBe('250g');
    expect(results[0].available).toBe(true);
  });

  it('retourne [] si la page ne contient aucun produit', async () => {
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', mockFetchHtml('<html><body>Aucun résultat</body></html>'));
    const results = await client.search('produitinexistant');
    expect(results).toEqual([]);
  });

  it('lève une erreur sur 403 après épuisement des retries', async () => {
    const fetch403 = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as Response);
    const cookies = fakeCookies();
    const client = new AuchanClient(cookies, fastThrottler(), 'https://www.auchan.fr', fetch403);

    await expect(client.search('beurre')).rejects.toThrow('HTTP 403');
    // invalidate() doit avoir été appelé à chaque tentative (4 = 1 + 3 retries)
    expect(cookies.invalidate).toHaveBeenCalledTimes(4);
  });

  it('ne retry pas sur une erreur 500 (non-retryable)', async () => {
    const fetch500 = mockFetchError(500);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetch500);

    await expect(client.search('beurre')).rejects.toThrow('HTTP 500');
    expect(fetch500).toHaveBeenCalledTimes(1);
  });
});

// ── getCart ───────────────────────────────────────────────────────────────────

describe('AuchanClient.getCart', () => {
  it('retourne le panier avec les articles et le total', async () => {
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', mockFetchJson(cartGetFixture));
    const cart = await client.getCart();

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('d2b82432-fe6b-4d95-a52f-3a6a65150092');
    expect(cart.items[0].quantity).toBe(4);
    expect(cart.total).toBe(4354);
    expect(cart.itemCount).toBe(1);
  });

  it('retourne un panier vide si items est absent', async () => {
    const emptyCart = { cart: { cart: { id: 'x', prices: { totalPrice: { amount: 0 } }, items: [] } } };
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', mockFetchJson(emptyCart));
    const cart = await client.getCart();

    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
  });
});

// ── addToCart ─────────────────────────────────────────────────────────────────

describe('AuchanClient.addToCart', () => {
  it('POST /cart/update avec le bon body et retourne le panier mis à jour', async () => {
    // Premier appel : GET /cart, deuxième appel : POST /cart/update
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartGetFixture) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartAddFixture) } as Response);

    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    const cart = await client.addToCart(
      'acfdc139-5da2-4e2c-b652-5687fa2932b1',
      '19f46dfd-f09f-5533-9958-a71f53c6adbb',
      'b42fbf5b-51d4-42d0-bad8-abe4e6963846',
      'GROCERY',
      1,
    );

    expect(cart.items).toHaveLength(2);
    expect(cart.items[1].productId).toBe('acfdc139-5da2-4e2c-b652-5687fa2932b1');

    // Vérifier le body du POST
    const [, postInit] = fetchFn.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postInit.body as string);
    expect(body.cartId).toBe('438e38d8-958a-4c66-93be-f4de245a9c98');
    expect(body.items[0].productId).toBe('acfdc139-5da2-4e2c-b652-5687fa2932b1');
    expect(body.items[0].desiredQuantity).toBe(1);
    expect(body.consentId).toBe('consent-uuid');
  });
});

// ── updateQuantity ────────────────────────────────────────────────────────────

describe('AuchanClient.updateQuantity', () => {
  it('met à jour la quantité d\'un article existant', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartGetFixture) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartUpdateFixture) } as Response);

    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    const cart = await client.updateQuantity('d2b82432-fe6b-4d95-a52f-3a6a65150092', 3);

    expect(cart.items[0].quantity).toBe(3);

    const [, postInit] = fetchFn.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postInit.body as string);
    expect(body.items[0].desiredQuantity).toBe(3);
    // le champ id doit être présent pour un UPDATE
    expect(body.items[0].id).toBe('5797d20b-68cc-4484-a711-69f3b5e8893c');
  });

  it('appelle removeFromCart si quantity === 0', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartGetFixture) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartRemoveFixture) } as Response);

    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    const cart = await client.updateQuantity('d2b82432-fe6b-4d95-a52f-3a6a65150092', 0);

    expect(cart.items).toHaveLength(0);

    const [, postInit] = fetchFn.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postInit.body as string);
    expect(body.items[0].desiredQuantity).toBe(0);
  });

  it('lève une erreur si le produit n\'est pas dans le panier', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(cartGetFixture),
    } as Response);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);

    await expect(client.updateQuantity('produit-inexistant', 2)).rejects.toThrow('not found in cart');
  });
});

// ── removeFromCart ────────────────────────────────────────────────────────────

describe('AuchanClient.removeFromCart', () => {
  it('supprime l\'article et retourne le panier vide', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartGetFixture) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(cartRemoveFixture) } as Response);

    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    const cart = await client.removeFromCart('d2b82432-fe6b-4d95-a52f-3a6a65150092');

    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);

    const [, postInit] = fetchFn.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(postInit.body as string);
    expect(body.items[0].desiredQuantity).toBe(0);
    expect(body.items[0].id).toBe('5797d20b-68cc-4484-a711-69f3b5e8893c');
  });

  it('lève une erreur si le produit n\'est pas dans le panier', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(cartGetFixture),
    } as Response);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);

    await expect(client.removeFromCart('produit-absent')).rejects.toThrow('not found in cart');
  });
});

// ── searchPromos ──────────────────────────────────────────────────────────────

describe('AuchanClient.searchPromos', () => {
  it('retourne les produits en promo sans argument (GET /boutique/promos)', async () => {
    const fetchFn = mockFetchHtml(SEARCH_HTML);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    const results = await client.searchPromos();

    expect(results).toHaveLength(1);
    expect(results[0].productId).toBe('acfdc139-5da2-4e2c-b652-5687fa2932b1');
    expect(results[0].name).toBe('Beurre tendre doux 82%MG');
    expect(results[0].price).toBe(298);
    expect(results[0].available).toBe(true);

    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://www.auchan.fr/boutique/promos');
  });

  it('passe le paramètre text quand query est fournie', async () => {
    const fetchFn = mockFetchHtml(SEARCH_HTML);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    await client.searchPromos('café');

    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://www.auchan.fr/boutique/promos?text=caf%C3%A9');
  });

  it('passe le paramètre category quand category est fournie', async () => {
    const fetchFn = mockFetchHtml(SEARCH_HTML);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    await client.searchPromos(undefined, 'ca-n02');

    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://www.auchan.fr/boutique/promos?category=ca-n02');
  });

  it('passe query et category ensemble', async () => {
    const fetchFn = mockFetchHtml(SEARCH_HTML);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    await client.searchPromos('beurre', 'ca-n01');

    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://www.auchan.fr/boutique/promos?text=beurre&category=ca-n01');
  });

  it('retourne [] si la page ne contient aucun produit', async () => {
    const client = new AuchanClient(
      fakeCookies(),
      fastThrottler(),
      'https://www.auchan.fr',
      mockFetchHtml('<html><body>Aucune promo</body></html>'),
    );
    const results = await client.searchPromos();
    expect(results).toEqual([]);
  });

  it('lève une erreur sur 403', async () => {
    const client = new AuchanClient(
      fakeCookies(),
      fastThrottler(),
      'https://www.auchan.fr',
      mockFetchError(403),
    );
    await expect(client.searchPromos()).rejects.toThrow('HTTP 403');
  });
});

// ── getLoyaltyInfo ────────────────────────────────────────────────────────────

const LOYALTY_HTML = `
<html><body>
<div class="o-cardSelector__cardNumberAndName">
  <div class="o-cardSelector__cardNumber">N° <strong>0000000000000</strong></div>
  <div class="o-cardSelector__cardName">DOE John</div>
</div>
<div class="t-myLoyalty__amount o-loyaltyMyCard__amount">
  <div class="o-loyaltyMyCard__row">
    <span>Ma cagnotte au 04/06/2026</span>
    <span class="a-waaohTag a-waaohTag--xlarge a-waaohTag--transparent">3,46 €</span>
  </div>
</div>
<div class="-waaohAccountID">Mon numéro de compte Waooh : 00000000</div>
<div class="m-discountClubBox">
  <div class="m-discountClubBox__title -waaoh">Votre jour W! est activé !</div>
  <div class="m-discountClubBox__title -noBold">
    Chaque <strong>mercredi</strong>, vous bénéficiez de
    <strong>10 % cagnottés sur tous les produits frais des Halles*</strong>
  </div>
</div>
<section class="t-myLoyalty__section t-myLoyalty__section--challenges">
  <div><strong>Jusqu’au 30 juin 2026</strong>, profitez des Défis Waaoh.</div>
  <div class="a-waaohChallengeTag">
    Cagnotte Défis Waaoh
    <span class="a-waaohChallengeTag__amount">0,00 €</span>
  </div>
</section>
</body></html>
`;

describe('AuchanClient.getLoyaltyInfo', () => {
  it('fetche /fidelite/accueil et retourne les informations de fidélité parsées', async () => {
    const client = new AuchanClient(
      fakeCookies(),
      fastThrottler(),
      'https://www.auchan.fr',
      mockFetchHtml(LOYALTY_HTML),
    );
    const info = await client.getLoyaltyInfo();

    expect(info.card.number).toBe('0000000000000');
    expect(info.card.holder).toBe('DOE John');
    expect(info.balance.amountCents).toBe(346);
    expect(info.balance.amountFormatted).toBe('3,46 €');
    expect(info.balance.expiryDate).toBe('04/06/2026');
    expect(info.waoohAccountNumber).toBe('00000000');
    expect(info.jourW.active).toBe(true);
    expect(info.jourW.day).toBe('mercredi');
    expect(info.challenges.cagnotteCents).toBe(0);
    expect(info.challenges.deadline).toBe('30 juin 2026');
  });

  it('appelle bien GET /fidelite/accueil', async () => {
    const fetchFn = mockFetchHtml(LOYALTY_HTML);
    const client = new AuchanClient(fakeCookies(), fastThrottler(), 'https://www.auchan.fr', fetchFn);
    await client.getLoyaltyInfo();

    const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://www.auchan.fr/fidelite/accueil');
  });

  it('lève une erreur sur 403', async () => {
    const client = new AuchanClient(
      fakeCookies(),
      fastThrottler(),
      'https://www.auchan.fr',
      mockFetchError(403),
    );
    await expect(client.getLoyaltyInfo()).rejects.toThrow('HTTP 403');
  });
});
