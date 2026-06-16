/**
 * cart-mapper.ts — Mappe la réponse JSON de GET /cart → Cart
 * Les montants dans l'API sont en centimes (amount: 4354 = 43,54 €).
 */

import type { Cart, CartItem } from '../types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RawPrice {
  amount?: number;
  currency?: string;
}

interface RawOffering {
  prices?: {
    price?: RawPrice;
    totalPrice?: RawPrice;
  };
}

interface RawItem {
  id?: string;
  productId?: string;
  offerId?: string;
  desiredQuantity?: number;
  offering?: RawOffering;
}

interface RawCartInner {
  id?: string;
  prices?: {
    totalPrice?: RawPrice;
  };
  items?: RawItem[];
}

interface RawCartResponse {
  cart?: {
    cart?: RawCartInner;
  };
}

function amount(price: RawPrice | undefined): number {
  return price?.amount ?? 0;
}

/**
 * Mappe la réponse brute de GET /cart vers le type Cart.
 * Les montants sont en centimes — pas de conversion nécessaire.
 */
export function mapCart(raw: unknown): Cart {
  const data = raw as RawCartResponse;
  const inner = data?.cart?.cart ?? {};

  const items: CartItem[] = (inner.items ?? []).map((item): CartItem => ({
    productId: item.productId ?? '',
    label: '',  // non disponible dans GET /cart — enrichi ultérieurement via search
    quantity: item.desiredQuantity ?? 0,
    unitPrice: amount(item.offering?.prices?.price),
    totalPrice: amount(item.offering?.prices?.totalPrice),
  }));

  return {
    items,
    total: amount(inner.prices?.totalPrice),
    itemCount: items.length,
  };
}

/**
 * Extrait le cartId depuis la réponse brute.
 * Nécessaire pour les mutations POST /cart/update.
 */
export function extractCartId(raw: unknown): string | undefined {
  const data = raw as RawCartResponse;
  return data?.cart?.cart?.id;
}
