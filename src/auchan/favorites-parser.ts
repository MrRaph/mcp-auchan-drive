/**
 * favorites-parser.ts — Parse le HTML de GET /client/mes-produits-preferes
 * Même approche que parser.ts : regex sur le HTML brut, pas de cheerio/jsdom.
 */

import type { FavoriteProduct } from '../types.js';
import { parsePrice } from './html-utils.js';

/**
 * Parse la page HTML des produits favoris et retourne la liste des produits
 * groupés par catégorie.
 *
 * Structure HTML attendue :
 * ```html
 * <section class="t-myFavorites__section">
 *   <h2 class="t-myFavorites__categoryTitle">Eaux, jus, sodas, thés glacés</h2>
 *   <article class="product-thumbnail">
 *     <a href="/orangina-boisson-gazeuse-a-l-orange/pr-C1820950">...</a>
 *     <p class="product-thumbnail__description"><strong>ORANGINA</strong> Boisson gazeuse à l'orange</p>
 *     <span class="product-attribute">1,5l</span>
 *     <div class="product-price">1,93 €</div>
 *     <span class="product-price-perUnit">1,29 € / l</span>
 *     <span class="a-promotionLabel">-50% sur le 2ème</span>
 *     <div class="quantity-selector" data-product-id="...">Dans mon drive</div>
 *   </article>
 * </section>
 * ```
 */
export function parseFavoritesPage(html: string): FavoriteProduct[] {
  const products: FavoriteProduct[] = [];

  // Extrait chaque section (rayon)
  const sectionPattern = /<section[^>]*t-myFavorites__section[^>]*>([\s\S]*?)<\/section>/g;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const sectionHtml = sectionMatch[1];

    // Titre du rayon
    const categoryM = sectionHtml.match(/t-myFavorites__categoryTitle[^>]*>([^<]+)</);
    const category = categoryM?.[1]?.trim() ?? '';

    // Extrait chaque article
    const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/g;
    let articleMatch: RegExpExecArray | null;

    while ((articleMatch = articlePattern.exec(sectionHtml)) !== null) {
      const block = articleMatch[1];

      // URL produit (href) et code produit
      const hrefM = block.match(/href="([^"]+pr-([A-Z0-9]+)[^"]*)"/);
      if (!hrefM) continue;
      const productUrl = hrefM[1];
      const productCode = hrefM[2];

      // Nom et marque : <p ...><strong>MARQUE</strong> Nom du produit</p>
      const descM = block.match(/product-thumbnail__description[^>]*>(?:<strong>([^<]*)<\/strong>\s*)?([^<]+)</);
      const brand = descM?.[1]?.trim() || undefined;
      const name = descM?.[2]?.trim() ?? '';

      // Format
      const formatM = block.match(/product-attribute[^>]*>([^<]+)</);
      const format = formatM?.[1]?.trim() || undefined;

      // Prix
      const priceM = block.match(/product-price[^>]*>([^<]+)</);
      const priceFormatted = priceM?.[1]?.trim() ?? '0,00 €';
      const price = parsePrice(priceFormatted);

      // Prix à l'unité
      const perUnitM = block.match(/product-price-perUnit[^>]*>([^<]+)</);
      const pricePerUnit = perUnitM?.[1]?.trim() || undefined;

      // Promo
      const promoM = block.match(/a-promotionLabel[^>]*>([^<]+)</);
      const promo = promoM?.[1]?.trim() || undefined;

      // Disponibilité : présence de "Dans mon drive" dans le quantity-selector
      const available = /quantity-selector(?! disabled)[^>]*>[^<]*Dans mon drive/i.test(block)
        || (/Dans mon drive/i.test(block) && !/quantity-selector disabled/i.test(block));

      products.push({
        name,
        brand,
        format,
        category,
        price,
        priceFormatted,
        pricePerUnit,
        promo,
        productUrl,
        productCode,
        available,
      });
    }
  }

  return products;
}
