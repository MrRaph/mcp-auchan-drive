/**
 * client.ts — Client HTTP Auchan Drive
 *
 * Orchestre :
 *   - Throttler  : sérialisation des requêtes + retry anti-DataDome
 *   - CookieProvider : auth cookie (relecture Chrome si 403)
 *   - parser.ts  : HTML search → SearchProduct[]
 *   - cart-mapper.ts : JSON GET /cart → Cart
 */

import type { CookieProvider, Cart, OrderPeriod } from '../types.js';
import { Throttler } from './throttle.js';
import { parseSearchResults, type SearchProduct } from './parser.js';
import { mapCart, extractCartId } from './cart-mapper.js';
import { parseLoyaltyPage, type LoyaltyInfo } from './loyalty-parser.js';
import { parseOrdersPage, type Order } from './orders-parser.js';
import { parseLoyaltyHistoryPage, type LoyaltyTransaction } from './loyalty-history-parser.js';

// ─── Types internes ───────────────────────────────────────────────────────────

interface HttpError extends Error { status: number; }

interface RawCartLine {
  id: string;
  productId: string;
  offerId: string;
  desiredQuantity: number;
  desiredType: string;
  offering?: {
    context?: {
      seller?: { id: string; type: string };
    };
  };
}

interface RawCartInner {
  id: string;
  items?: RawCartLine[];
}

interface RawCartResponse {
  cart?: { cart?: RawCartInner };
}

// ─── AuchanClient ─────────────────────────────────────────────────────────────

export class AuchanClient {
  constructor(
    private readonly cookieProvider: CookieProvider,
    private readonly throttler: Throttler,
    private readonly baseUrl = 'https://www.auchan.fr',
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  // ── Requête HTTP de base (via throttler) ────────────────────────────────────

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    return this.throttler.run(async () => {
      const cookie = await this.cookieProvider.getCookie();
      const headers: Record<string, string> = {
        Cookie: cookie,
        'X-Requested-With': 'XMLHttpRequest',
        ...(init.headers as Record<string, string> | undefined),
      };

      const response = await this.fetchFn(url, { ...init, headers });

      if (!response.ok) {
        // 403 DataDome → invalider le cache de cookies pour le prochain retry
        if (response.status === 403) {
          this.cookieProvider.invalidate();
        }
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
        err.status = response.status;
        throw err;
      }

      return response;
    });
  }

  // ── Extraction du consentId depuis le cookie header ─────────────────────────

  private extractConsentId(cookieHeader: string): string {
    const m = cookieHeader.match(/lark-consentId=([^;]+)/);
    return m?.[1] ?? '';
  }

  // ── GET /cart (raw JSON) — réutilisé par les mutations ─────────────────────

  private async getCartRaw(): Promise<RawCartResponse> {
    const response = await this.request(`${this.baseUrl}/cart`, {
      headers: { Accept: 'application/json' },
    });
    return response.json() as Promise<RawCartResponse>;
  }

  // ── API publique ────────────────────────────────────────────────────────────

  /** Recherche de produits dans le catalogue Drive. */
  async search(query: string): Promise<SearchProduct[]> {
    const response = await this.request(
      `${this.baseUrl}/recherche?text=${encodeURIComponent(query)}`,
      { headers: { Accept: 'text/html' } },
    );
    return parseSearchResults(await response.text());
  }

  /** Recherche de produits en promotion sur le drive actif. */
  async searchPromos(query?: string, category?: string): Promise<SearchProduct[]> {
    const params = new URLSearchParams();
    if (query) params.set('text', query);
    if (category) params.set('category', category);
    const qs = params.toString();
    const url = `${this.baseUrl}/boutique/promos${qs ? `?${qs}` : ''}`;
    const response = await this.request(url, { headers: { Accept: 'text/html' } });
    return parseSearchResults(await response.text());
  }

  /** Lecture du panier courant. */
  async getCart(): Promise<Cart> {
    return mapCart(await this.getCartRaw());
  }

  /** Informations du programme de fidélité (cagnotte, carte, Jour W!, défis). */
  async getLoyaltyInfo(): Promise<LoyaltyInfo> {
    const response = await this.request(`${this.baseUrl}/fidelite/accueil`, {
      headers: { Accept: 'text/html' },
    });
    return parseLoyaltyPage(await response.text());
  }

  /** Historique des commandes drive. */
  async getOrders(period: OrderPeriod = '3months'): Promise<Order[]> {
    const queryString = this.buildOrdersPeriodQuery(period);
    const response = await this.request(
      `${this.baseUrl}/client/mes-commandes?${queryString}`,
      { headers: { Accept: 'text/html' } },
    );
    return parseOrdersPage(await response.text());
  }

  /** Convertit une période en query string pour l'API des commandes. */
  private buildOrdersPeriodQuery(period: OrderPeriod): string {
    switch (period) {
      case '10days':        return 'days=10';
      case '30days':        return 'days=30';
      case '3months':       return 'days=90';
      case '6months':       return 'days=180';
      case 'current_year':  return `year=${new Date().getFullYear()}`;
      case '2025':          return 'year=2025';
      case '2024':          return 'year=2024';
    }
  /** Historique des transactions de cagnotte (3 derniers mois). */
  async getLoyaltyHistory(): Promise<LoyaltyTransaction[]> {
    const response = await this.request(`${this.baseUrl}/fidelite/ma-carte/historique`, {
      headers: { Accept: 'text/html' },
    });
    return parseLoyaltyHistoryPage(await response.text());
  }

  /** Ajout d'un produit au panier (sans id — article nouveau). */
  async addToCart(
    productId: string,
    offerId: string,
    sellerId: string,
    sellerType: string,
    quantity = 1,
  ): Promise<Cart> {
    const [raw, cookie] = await Promise.all([
      this.getCartRaw(),
      this.cookieProvider.getCookie(),
    ]);

    const body = JSON.stringify({
      cartId: extractCartId(raw),
      items: [{
        productId,
        offerId,
        sellerId,
        sellerType,
        desiredQuantity: quantity,
        desiredType: 'DEFAULT',
      }],
      consentId: this.extractConsentId(cookie),
      reservationId: null,
      mbaAvailabilityNeeded: true,
    });

    const response = await this.request(`${this.baseUrl}/cart/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    return mapCart(await response.json());
  }

  /** Mise à jour de la quantité d'un article déjà dans le panier. */
  async updateQuantity(productId: string, quantity: number): Promise<Cart> {
    if (quantity === 0) return this.removeFromCart(productId);

    const [raw, cookie] = await Promise.all([
      this.getCartRaw(),
      this.cookieProvider.getCookie(),
    ]);

    const line = this.findLine(raw, productId);
    const body = JSON.stringify({
      cartId: extractCartId(raw),
      items: [{
        id: line.id,
        productId,
        offerId: line.offerId,
        sellerId: line.offering?.context?.seller?.id ?? '',
        sellerType: line.offering?.context?.seller?.type ?? 'GROCERY',
        desiredQuantity: quantity,
        desiredType: 'DEFAULT',
      }],
      consentId: this.extractConsentId(cookie),
      reservationId: null,
      mbaAvailabilityNeeded: true,
    });

    const response = await this.request(`${this.baseUrl}/cart/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    return mapCart(await response.json());
  }

  /** Suppression d'un article du panier (desiredQuantity: 0). */
  async removeFromCart(productId: string): Promise<Cart> {
    const [raw, cookie] = await Promise.all([
      this.getCartRaw(),
      this.cookieProvider.getCookie(),
    ]);

    const line = this.findLine(raw, productId);
    const body = JSON.stringify({
      cartId: extractCartId(raw),
      items: [{
        id: line.id,
        productId,
        offerId: line.offerId,
        sellerId: line.offering?.context?.seller?.id ?? '',
        sellerType: line.offering?.context?.seller?.type ?? 'GROCERY',
        desiredQuantity: 0,
        desiredType: 'DEFAULT',
      }],
      consentId: this.extractConsentId(cookie),
      reservationId: null,
      mbaAvailabilityNeeded: true,
    });

    const response = await this.request(`${this.baseUrl}/cart/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    return mapCart(await response.json());
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private findLine(raw: RawCartResponse, productId: string): RawCartLine {
    const lines = raw?.cart?.cart?.items ?? [];
    const line = lines.find((l) => l.productId === productId);
    if (!line) throw new Error(`Product ${productId} not found in cart`);
    return line;
  }
}
