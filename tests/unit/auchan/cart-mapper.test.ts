import { describe, it, expect } from 'vitest';
import { mapCart, extractCartId } from '../../../src/auchan/cart-mapper.js';

describe('mapCart', () => {
  it('retourne un Cart avec 1 item depuis la fixture réelle', () => {
    const input = {
      cart: {
        cart: {
          id: '438e38d8-958a-4c66-93be-f4de245a9c98',
          prices: { totalPrice: { amount: 4354, currency: 'EUR' } },
          items: [
            {
              id: '5797d20b-68cc-4484-a711-69f3b5e8893c',
              productId: 'd2b82432-fe6b-4d95-a52f-3a6a65150092',
              offerId: 'e5847037-0b45-5aa0-9f76-47b576787256',
              desiredQuantity: 4,
              offering: {
                prices: {
                  price: { amount: 1649, currency: 'EUR' },
                  totalPrice: { amount: 4354, currency: 'EUR' },
                },
              },
            },
          ],
        },
      },
    };

    const result = mapCart(input);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe('d2b82432-fe6b-4d95-a52f-3a6a65150092');
    expect(result.items[0].quantity).toBe(4);
    expect(result.items[0].unitPrice).toBe(1649);   // centimes — pas de ×100
    expect(result.items[0].totalPrice).toBe(4354);
    expect(result.total).toBe(4354);
    expect(result.itemCount).toBe(1);
  });

  it('retourne un panier vide si items est absent', () => {
    const input = { cart: { cart: { prices: { totalPrice: { amount: 0 } } } } };
    const result = mapCart(input);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.itemCount).toBe(0);
  });

  it('retourne 0 si les prix sont absents', () => {
    const input = { cart: { cart: { items: [{ productId: 'x', desiredQuantity: 1 }] } } };
    const result = mapCart(input);
    expect(result.items[0].unitPrice).toBe(0);
    expect(result.items[0].totalPrice).toBe(0);
  });
});

describe('extractCartId', () => {
  it('retourne l\'id depuis la fixture réelle', () => {
    const input = { cart: { cart: { id: '438e38d8-958a-4c66-93be-f4de245a9c98' } } };
    expect(extractCartId(input)).toBe('438e38d8-958a-4c66-93be-f4de245a9c98');
  });

  it('retourne undefined si absent', () => {
    expect(extractCartId({})).toBeUndefined();
  });
});
