import { describe, it, expect } from 'vitest';
import { parseFavoritesPage } from '../../../src/auchan/favorites-parser.js';

// HTML minimal reproduisant la structure réelle de /client/mes-produits-preferes
// 2 rayons, 3 produits dont 1 en promo et 1 indisponible.
const FULL_HTML = `
<html><body>

<section class="t-myFavorites__section">
  <h2 class="t-myFavorites__categoryTitle">Eaux, jus, sodas, thés glacés</h2>

  <!-- Produit 1 : disponible, avec promo et prix/unité -->
  <article class="product-thumbnail">
    <a href="/orangina-boisson-gazeuse-a-l-orange/pr-C1820950">Voir le produit</a>
    <p class="product-thumbnail__description"><strong>ORANGINA</strong> Boisson gazeuse à l'orange</p>
    <span class="product-attribute">1,5l</span>
    <div class="product-price">1,93 €</div>
    <span class="product-price-perUnit">1,29 € / l</span>
    <span class="a-promotionLabel">-50% sur le 2ème</span>
    <div class="quantity-selector" data-product-id="uuid-orangina">Dans mon drive</div>
  </article>

  <!-- Produit 2 : disponible, sans promo ni prix/unité -->
  <article class="product-thumbnail">
    <a href="/evian-eau-minerale-naturelle/pr-C1234567">Voir le produit</a>
    <p class="product-thumbnail__description"><strong>EVIAN</strong> Eau minérale naturelle</p>
    <span class="product-attribute">6x1,5l</span>
    <div class="product-price">3,50 €</div>
    <div class="quantity-selector" data-product-id="uuid-evian">Dans mon drive</div>
  </article>
</section>

<section class="t-myFavorites__section">
  <h2 class="t-myFavorites__categoryTitle">Épicerie salée</h2>

  <!-- Produit 3 : indisponible (quantity-selector disabled) -->
  <article class="product-thumbnail">
    <a href="/panzani-pates-spaghetti/pr-C9876543">Voir le produit</a>
    <p class="product-thumbnail__description"><strong>PANZANI</strong> Pâtes spaghetti</p>
    <span class="product-attribute">500g</span>
    <div class="product-price">1,20 €</div>
    <div class="quantity-selector disabled" data-product-id="uuid-panzani">Indisponible</div>
  </article>
</section>

</body></html>
`;

// Variante : produit sans quantity-selector du tout (indisponible — « Dans mon drive » absent)
const NO_QUANTITY_SELECTOR_HTML = `
<html><body>
<section class="t-myFavorites__section">
  <h2 class="t-myFavorites__categoryTitle">Épicerie sucrée</h2>
  <article class="product-thumbnail">
    <a href="/lu-petit-beurre/pr-C1111111">Voir le produit</a>
    <p class="product-thumbnail__description"><strong>LU</strong> Petit beurre</p>
    <span class="product-attribute">200g</span>
    <div class="product-price">1,50 €</div>
  </article>
</section>
</body></html>
`;

describe('parseFavoritesPage', () => {
  // ── Résultats généraux ─────────────────────────────────────────────────────

  it('retourne un tableau vide sur une page sans section', () => {
    expect(parseFavoritesPage('<html><body></body></html>')).toEqual([]);
  });

  it('retourne 3 produits depuis le HTML complet', () => {
    const products = parseFavoritesPage(FULL_HTML);
    expect(products).toHaveLength(3);
  });

  // ── Catégories ─────────────────────────────────────────────────────────────

  it('associe les produits à la bonne catégorie', () => {
    const products = parseFavoritesPage(FULL_HTML);
    expect(products[0].category).toBe('Eaux, jus, sodas, thés glacés');
    expect(products[1].category).toBe('Eaux, jus, sodas, thés glacés');
    expect(products[2].category).toBe('Épicerie salée');
  });

  // ── Nom et marque ──────────────────────────────────────────────────────────

  it('extrait le nom sans la marque', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.name).toBe("Boisson gazeuse à l'orange");
  });

  it('extrait la marque séparément', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.brand).toBe('ORANGINA');
  });

  it('extrait le nom et la marque du deuxième produit', () => {
    const [, p2] = parseFavoritesPage(FULL_HTML);
    expect(p2.name).toBe('Eau minérale naturelle');
    expect(p2.brand).toBe('EVIAN');
  });

  // ── Format ────────────────────────────────────────────────────────────────

  it('extrait le format du produit', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.format).toBe('1,5l');
  });

  // ── Prix ──────────────────────────────────────────────────────────────────

  it('parse le prix en centimes', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.price).toBe(193); // "1,93 €" → 193
  });

  it('conserve le prix formaté', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.priceFormatted).toBe('1,93 €');
  });

  it('extrait le prix par unité', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.pricePerUnit).toBe('1,29 € / l');
  });

  it('retourne pricePerUnit undefined si absent', () => {
    const [, p2] = parseFavoritesPage(FULL_HTML);
    expect(p2.pricePerUnit).toBeUndefined();
  });

  // ── Promotion ─────────────────────────────────────────────────────────────

  it('extrait la promotion du premier produit', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.promo).toBe('-50% sur le 2ème');
  });

  it('retourne promo undefined si absente', () => {
    const [, p2] = parseFavoritesPage(FULL_HTML);
    expect(p2.promo).toBeUndefined();
  });

  // ── URL et code produit ────────────────────────────────────────────────────

  it('extrait l\'URL produit', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.productUrl).toBe('/orangina-boisson-gazeuse-a-l-orange/pr-C1820950');
  });

  it('extrait le code produit depuis le slug', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.productCode).toBe('C1820950');
  });

  // ── Disponibilité ─────────────────────────────────────────────────────────

  it('available = true si quantity-selector sans disabled', () => {
    const [p] = parseFavoritesPage(FULL_HTML);
    expect(p.available).toBe(true);
  });

  it('available = false si quantity-selector avec disabled', () => {
    const products = parseFavoritesPage(FULL_HTML);
    const panzani = products[2];
    expect(panzani.name).toBe('Pâtes spaghetti');
    expect(panzani.available).toBe(false);
  });

  it('available = false si quantity-selector absent (produit non drivable)', () => {
    const [p] = parseFavoritesPage(NO_QUANTITY_SELECTOR_HTML);
    expect(p.available).toBe(false);
  });

  // ── Décodage HTML ─────────────────────────────────────────────────────────

  it('décode les entités HTML dans la marque', () => {
    const html = `
<html><body>
<section class="t-myFavorites__section">
  <h2 class="t-myFavorites__categoryTitle">Épicerie</h2>
  <article>
    <a href="/elle-vire-beurre/pr-C1264653">Voir</a>
    <p class="product-thumbnail__description"><strong>ELLE &amp; VIRE</strong> Beurre doux</p>
    <div class="product-price">2,98 €</div>
    <div class="quantity-selector" data-product-id="uuid-1">Dans mon drive</div>
  </article>
</section>
</body></html>`;
    const [p] = parseFavoritesPage(html);
    expect(p.brand).toBe('ELLE & VIRE');
  });
});
