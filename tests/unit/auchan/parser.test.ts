import { describe, it, expect } from 'vitest';
import { parseSearchResults } from '../../../src/auchan/parser.js';

// HTML minimal qui reproduit la structure réelle d'Auchan Drive
const SAMPLE_HTML = `
<html>
<body>
  <article>
    <a href="/elle-vire-beurre-tendre/pr-C1264653">Voir le produit</a>
    <strong>ELLE &amp; VIRE</strong>
    <p class="product-thumbnail__description">Beurre tendre doux 82%MG</p>
    <div class="product-price">2,98 €</div>
    <span>11,92 € / kg</span>
    <span class="product-attribute">250g</span>
    <div class="quantity-selector"
         data-product-id="acfdc139-5da2-4e2c-b652-5687fa2932b1"
         data-offer-id="19f46dfd-f09f-5533-9958-a71f53c6adbb"
         data-seller-id="b42fbf5b-51d4-42d0-bad8-abe4e6963846"
         data-seller-type="GROCERY">
    </div>
  </article>
  <article>
    <a href="/president-beurre/pr-C9876543">Voir le produit</a>
    <strong>PRÉSIDENT</strong>
    <p class="product-thumbnail__description">Beurre doux 250g</p>
    <div class="product-price">3,20 €</div>
    <span>12,80 € / kg</span>
    <span class="product-attribute">250g</span>
    <div class="quantity-selector disabled"
         data-product-id="2fcdbc20-17e8-4b90-bc9b-c16b01cbfa32"
         data-offer-id="cb78e618-695e-5ae8-9844-f5823db358a8"
         data-seller-id="b42fbf5b-51d4-42d0-bad8-abe4e6963846"
         data-seller-type="GROCERY">
    </div>
  </article>
</body>
</html>
`;

describe('parseSearchResults', () => {
  it('retourne un tableau vide pour du HTML sans produits', () => {
    expect(parseSearchResults('<html></html>')).toEqual([]);
  });

  it('retourne 2 produits depuis le HTML sample', () => {
    const products = parseSearchResults(SAMPLE_HTML);
    expect(products).toHaveLength(2);
  });

  it('extrait correctement les IDs du premier produit', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.productId).toBe('acfdc139-5da2-4e2c-b652-5687fa2932b1');
    expect(p.offerId).toBe('19f46dfd-f09f-5533-9958-a71f53c6adbb');
    expect(p.sellerId).toBe('b42fbf5b-51d4-42d0-bad8-abe4e6963846');
    expect(p.sellerType).toBe('GROCERY');
  });

  it('extrait le nom du produit', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.name).toBe('Beurre tendre doux 82%MG');
  });

  it('extrait la marque et décode les entités HTML', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.brand).toBe('ELLE & VIRE'); // &amp; → &
  });

  it('parse le prix en centimes', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.price).toBe(298); // "2,98 €" → 298
  });

  it('parse le prix au kilo en centimes', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.pricePerKg).toBe(1192); // "11,92 € / kg" → 1192
  });

  it('extrait le format', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.format).toBe('250g');
  });

  it('extrait le code catalogue depuis le href', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.catalogCode).toBe('C1264653');
  });

  it('disponible = true si pas de classe disabled', () => {
    const [p] = parseSearchResults(SAMPLE_HTML);
    expect(p.available).toBe(true);
  });

  it('disponible = false si classe disabled présente', () => {
    const [, p2] = parseSearchResults(SAMPLE_HTML);
    expect(p2.available).toBe(false);
  });
});
