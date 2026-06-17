/**
 * favorites-parser.ts — Parse le HTML de GET /client/mes-produits-preferes
 * Même approche que parser.ts : regex sur le HTML brut, pas de cheerio/jsdom.
 *
 * Structure de la page :
 *   - Sections de catégories (class "t-myFavorites__section")
 *   - Titre de catégorie (class "t-myFavorites__categoryTitle")
 *   - Cartes produits similaires à /recherche (product-thumbnail__description, product-price…)
 */

import type { FavoriteProduct } from '../types.js';
import { parsePrice, decode } from './html-utils.js';

// Taille de la fenêtre de contexte utilisée en l'absence de balises <article>
const FALLBACK_CTX_BEFORE = 500;  // chars en arrière depuis le lien produit
const FALLBACK_CTX_AFTER  = 3000; // chars en avant depuis le lien produit

/**
 * Parse le HTML brut de /client/mes-produits-preferes et retourne la liste
 * des produits favoris groupés par catégorie.
 *
 * Stratégie :
 *   1. Repérer les débuts de sections de catégorie (class "t-myFavorites__section")
 *   2. Pour chaque section, extraire le titre de catégorie
 *   3. Pour chaque produit (href "/…/pr-Cxxxxxx"), extraire les champs depuis le contexte HTML
 */
export function parseFavoritesPage(html: string): FavoriteProduct[] {
  const results: FavoriteProduct[] = [];

  // ── Localiser les sections de catégorie ──────────────────────────────────────
  const sectionClassRe = /class="[^"]*t-myFavorites__section[^"]*"/g;
  const sectionStarts: number[] = [];
  let sMatch: RegExpExecArray | null;

  while ((sMatch = sectionClassRe.exec(html)) !== null) {
    // Remonter jusqu'au '<' ouvrant du tag
    let tagStart = sMatch.index;
    while (tagStart > 0 && html[tagStart] !== '<') tagStart--;
    sectionStarts.push(tagStart);
  }

  if (sectionStarts.length === 0) return results;

  // ── Parser chaque section ────────────────────────────────────────────────────
  for (let i = 0; i < sectionStarts.length; i++) {
    const sStart = sectionStarts[i];
    const sEnd = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : html.length;
    const sHtml = html.slice(sStart, sEnd);

    // Titre de catégorie
    const catM = sHtml.match(/t-myFavorites__categoryTitle[^>]*>([^<]+)</);
    const category = catM ? decode(catM[1].trim()) : '';

    // ── Délimitation des cartes produits ────────────────────────────────────
    // On utilise <article comme frontière entre cartes : chaque produit est
    // encapsulé dans un <article ...>. Sinon, on délimite par les liens produits.
    const articleStarts: number[] = [];
    const artRe = /<article/g;
    let artM: RegExpExecArray | null;
    while ((artM = artRe.exec(sHtml)) !== null) {
      articleStarts.push(artM.index);
    }

    // ── Produits dans la section ──────────────────────────────────────────────
    // Ancrage : href vers un produit de type "/slug/pr-Cxxxxxx"
    const productLinkRe = /href="(\/[^"]*\/pr-(C\d+))"/g;
    let pMatch: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((pMatch = productLinkRe.exec(sHtml)) !== null) {
      const productUrl = pMatch[1];
      const productCode = pMatch[2];

      // Dédoublonnage (plusieurs <a> peuvent pointer vers le même produit)
      if (seen.has(productCode)) continue;
      seen.add(productCode);

      const linkPos = pMatch.index;

      // Contexte borné par les <article> (évite le débordement vers la carte précédente)
      let ctxStart = 0;
      let ctxEnd = sHtml.length;

      if (articleStarts.length > 0) {
        // Début : dernier <article avant le lien courant
        for (const pos of articleStarts) {
          if (pos <= linkPos) ctxStart = pos;
        }
        // Fin : premier <article après le lien courant
        for (const pos of articleStarts) {
          if (pos > linkPos) { ctxEnd = pos; break; }
        }
      } else {
        // Fallback : fenêtre fixe autour du lien
        ctxStart = Math.max(0, linkPos - FALLBACK_CTX_BEFORE);
        ctxEnd = Math.min(sHtml.length, linkPos + FALLBACK_CTX_AFTER);
      }

      const ctx = sHtml.slice(ctxStart, ctxEnd);

      // ── Nom et marque ───────────────────────────────────────────────────────
      const descM = ctx.match(
        /class="[^"]*product-thumbnail__description[^"]*"[^>]*>([\s\S]*?)<\/p>/,
      );
      const descHtml = descM?.[1] ?? '';

      const brandM = descHtml.match(/<strong[^>]*>\s*([^<]+)\s*<\/strong>/);
      const brand = brandM ? decode(brandM[1].trim()) : undefined;

      // Nom = description sans le tag <strong> de marque.
      const nameRaw = descHtml.replace(/<strong[^>]*>[\s\S]*?<\/strong>/g, '');
      const name = decode(nameRaw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

      // ── Format / conditionnement ─────────────────────────────────────────────
      const fmtM = ctx.match(/class="[^"]*product-attribute[^"]*"[^>]*>\s*([^<]+)/);
      const format = fmtM ? decode(fmtM[1].trim()) : undefined;

      // ── Prix principal ───────────────────────────────────────────────────────
      const priceM = ctx.match(/class="[^"]*product-price[^"]*"[^>]*>\s*([\d\s,.'€]+)/);
      const priceFormatted = priceM ? priceM[1].trim() : '';
      const price = parsePrice(priceFormatted);

      // ── Prix à l'unité (ex : "1,29 € / l") ──────────────────────────────────
      const ppuM = ctx.match(/class="[^"]*product-price-perUnit[^"]*"[^>]*>\s*([^<]+)/);
      const pricePerUnit = ppuM ? decode(ppuM[1].trim()) : undefined;

      // ── Promotion ────────────────────────────────────────────────────────────
      const promoM = ctx.match(/class="[^"]*a-promotionLabel[^"]*"[^>]*>\s*([^<]+)/);
      const promo = promoM ? decode(promoM[1].trim()) : undefined;

      // ── Disponibilité ────────────────────────────────────────────────────────
      const qsM = ctx.match(/<[^>]+class="[^"]*quantity-selector[^"]*"[^>]*>/);
      const available = qsM != null && !qsM[0].includes('disabled');

      results.push({
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

  return results;
}
