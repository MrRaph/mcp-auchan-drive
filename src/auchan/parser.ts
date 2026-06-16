/**
 * parser.ts — Parse le HTML de GET /recherche?text=<query>
 * Pas de dépendance externe (pas de cheerio / jsdom) : regex sur le HTML brut.
 */

import { parsePrice } from './html-utils.js';

export interface SearchProduct {
  productId: string;   // data-product-id
  offerId: string;     // data-offer-id
  sellerId: string;    // data-seller-id
  sellerType: string;  // data-seller-type
  name: string;        // p.product-thumbnail__description
  brand?: string;      // article > strong (premier)
  price: number;       // centimes — "2,98 €" → 298
  pricePerKg?: number; // centimes — "11,92 € / kg" → 1192
  format?: string;     // span.product-attribute
  available: boolean;  // true si pas class "disabled" sur le quantity-selector
  catalogCode?: string;// href="/produit/pr-C1264653" → "C1264653"
}

/** Extrait la valeur d'un attribut HTML depuis une balise ouvrante. */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m?.[1];
}

/** Décode les entités HTML (nommées + numériques décimales et hexadécimales). */
function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parse le HTML brut de /recherche et retourne la liste des produits.
 * Stratégie :
 *   1. Trouver chaque <div class="quantity-selector" data-product-id="...">
 *   2. Extraire les data-attributes (productId, offerId, sellerId, sellerType)
 *   3. Analyser le contexte HTML autour de chaque sélecteur pour les autres champs
 */
export function parseSearchResults(html: string): SearchProduct[] {
  const products: SearchProduct[] = [];

  // Balise ouvrante du quantity-selector (chaque produit en a une)
  const tagRe = /<div[^>]+data-product-id="[^"]+"[^>]*>/g;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRe.exec(html)) !== null) {
    const tag = tagMatch[0];

    // Ignorer les balises sans class quantity-selector
    if (!tag.includes('quantity-selector')) continue;

    const productId = attr(tag, 'data-product-id');
    const offerId = attr(tag, 'data-offer-id');
    const sellerId = attr(tag, 'data-seller-id');
    const sellerType = attr(tag, 'data-seller-type');

    if (!productId || !offerId || !sellerId || !sellerType) continue;

    // Contexte HTML autour du sélecteur (~4 ko avant, 500 après)
    // La description produit peut être à 3000+ chars avant le quantity-selector
    const start = Math.max(0, tagMatch.index - 4000);
    const end = Math.min(html.length, tagMatch.index + 500);
    const ctx = html.slice(start, end);

    // Nom du produit — extrait le contenu texte complet du paragraphe (strip balises enfants)
    const descM = ctx.match(/class="[^"]*product-thumbnail__description[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const name = descM
      ? decode(descM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      : '';

    // Marque — cherche d'abord dans la description (structure actuelle), puis dans ctx (fallback)
    const brandM =
      (descM?.[1] ?? '').match(/<strong[^>]*>\s*([^<]+)\s*<\/strong>/) ??
      ctx.match(/<strong[^>]*>\s*([^<]+)\s*<\/strong>/);
    const brand = brandM ? decode(brandM[1].trim()) : undefined;

    // Prix principal
    const priceM = ctx.match(/class="[^"]*product-price[^"]*"[^>]*>\s*([\d\s,.'€]+)/);
    const price = priceM ? parsePrice(priceM[1]) : 0;

    // Prix au kilo
    const pkgM = ctx.match(/([\d]+[,.][\d]{2})\s*€\s*\/\s*kg/);
    const pricePerKg = pkgM ? parsePrice(pkgM[1]) : undefined;

    // Format / conditionnement
    const fmtM = ctx.match(/class="[^"]*product-attribute[^"]*"[^>]*>\s*([^<]+)/);
    const format = fmtM ? decode(fmtM[1].trim()) : undefined;

    // Code catalogue depuis href
    const hrefM = ctx.match(/href="[^"]*\/pr-(C\d+)/);
    const catalogCode = hrefM ? hrefM[1] : undefined;

    // Disponibilité
    const available = !tag.includes('disabled');

    products.push({
      productId,
      offerId,
      sellerId: sellerId ?? '',
      sellerType: sellerType ?? '',
      name,
      brand,
      price,
      pricePerKg,
      format,
      available,
      catalogCode,
    });
  }

  return products;
}
