/**
 * order-detail-parser.ts — Parse le HTML de GET /client/mes-commandes/{ref}/{num}
 * Même approche que les autres parsers : regex sur le HTML brut.
 */

import type { OrderDetail, OrderProduct } from '../types.js';
import { parsePrice, decode } from './html-utils.js';

/**
 * Parse la page HTML de détail d'une commande.
 *
 * Structure HTML attendue :
 * ```html
 * <!-- Tracker de statut -->
 * <li class="o-orderStatus__step o-orderStatus__step--active"><span>En cours de préparation</span></li>
 *
 * <!-- Créneau de retrait -->
 * <p>Retrait prévu le: mardi 16 juin entre 17h00 et 17h30</p>
 *
 * <!-- Magasin -->
 * <div class="m-storeInfo">
 *   <p class="m-storeInfo__name">Auchan Drive Caluire</p>
 *   <p class="m-storeInfo__address">10 Chemin Jean Petit 69300 CALUIRE-ET-CUIRE</p>
 * </div>
 *
 * <!-- Total -->
 * <span class="m-orderSummary__totalPrice">38,62 €</span>
 *
 * <!-- Produits par catégorie -->
 * <h2 class="m-orderProductList__categoryTitle">Boucherie, volaille, poissonnerie</h2>
 * <div class="m-orderProduct">
 *   <p class="m-orderProduct__name"><strong>AUCHAN</strong> Chipolatas supérieures aux herbes</p>
 *   <span class="m-orderProduct__quantity">Quantité : 6</span>
 *   <span class="m-orderProduct__price">8,34 €</span>
 * </div>
 * ```
 */
export function parseOrderDetailPage(
  html: string,
  orderRef: string,
  orderNumber: string,
): OrderDetail {
  // ── Statut courant (étape active du tracker) ─────────────────────────────────
  // L'étape active porte une classe contenant "active" ou "current", ou un aria-current.
  const statusActiveM = html.match(
    /o-orderStatus__step[^"]*(?:active|current)[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/i,
  ) ?? html.match(/aria-current="[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/i);

  // Fallback : prendre le dernier span dans la liste de statuts non vide
  const status = statusActiveM
    ? decode(statusActiveM[1].trim())
    : extractLastStatus(html);

  // ── Créneau de retrait ───────────────────────────────────────────────────────
  const pickupM = html.match(/Retrait pr[eé]vu\s+le\s*:\s*([^\n<]+)/i);
  const pickupSlot = pickupM ? decode(pickupM[1].trim()) : undefined;

  // ── Magasin : nom ────────────────────────────────────────────────────────────
  const storeNameM = html.match(/m-storeInfo__name[^>]*>([^<]+)/)
    ?? html.match(/class="[^"]*storeName[^"]*"[^>]*>([^<]+)/);
  const storeName = storeNameM ? decode(storeNameM[1].trim()) : '';

  // ── Magasin : adresse ────────────────────────────────────────────────────────
  const storeAddrM = html.match(/m-storeInfo__address[^>]*>([\s\S]*?)<\/p>/)
    ?? html.match(/class="[^"]*storeAddress[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/);
  const storeAddress = storeAddrM
    ? decode(storeAddrM[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    : '';

  // ── Total ─────────────────────────────────────────────────────────────────────
  const totalM = html.match(/m-orderSummary__totalPrice[^>]*>([^<]+)/)
    ?? html.match(/orderTotal[^>]*>([^<]+)/);
  const totalFormatted = totalM ? decode(totalM[1].trim()) : '';
  const total = parsePrice(totalFormatted);

  // ── Produits par catégorie ────────────────────────────────────────────────────
  const products = parseProducts(html);

  return {
    orderNumber,
    orderRef,
    storeName,
    storeAddress,
    status,
    pickupSlot,
    total,
    totalFormatted,
    products,
  };
}

function extractLastStatus(html: string): string {
  const stepRe = /o-orderStatus__step[^>]*>[\s\S]*?<span[^>]*>([^<]+)/g;
  let last = '';
  let m: RegExpExecArray | null;
  while ((m = stepRe.exec(html)) !== null) {
    const t = decode(m[1].trim());
    if (t) last = t;
  }
  return last;
}

function parseProducts(html: string): OrderProduct[] {
  const products: OrderProduct[] = [];

  // Découper en sections par catégorie
  const catRe = /class="[^"]*m-orderProductList__categoryTitle[^"]*"[^>]*>([^<]+)/g;
  const catMatches: Array<{ index: number; category: string }> = [];
  let cM: RegExpExecArray | null;
  while ((cM = catRe.exec(html)) !== null) {
    catMatches.push({ index: cM.index, category: decode(cM[1].trim()) });
  }

  if (catMatches.length === 0) {
    // Pas de catégories : parser tous les produits sans catégorie
    return parseProductBlocks(html, '');
  }

  for (let i = 0; i < catMatches.length; i++) {
    const start = catMatches[i].index;
    const end = i + 1 < catMatches.length ? catMatches[i + 1].index : html.length;
    const section = html.slice(start, end);
    products.push(...parseProductBlocks(section, catMatches[i].category));
  }

  return products;
}

function parseProductBlocks(html: string, category: string): OrderProduct[] {
  const products: OrderProduct[] = [];

  // Chaque produit est dans un bloc avec class EXACTEMENT "m-orderProduct" (pas les sous-éléments)
  // (?=["\s]) garantit que "m-orderProduct" n'est pas suivi de "_" (m-orderProduct__name, etc.)
  const blockRe = /class="[^"]*m-orderProduct(?=["\s])[^"]*"[^>]*>/g;
  const blockStarts: number[] = [];
  let bM: RegExpExecArray | null;
  while ((bM = blockRe.exec(html)) !== null) {
    blockStarts.push(bM.index);
  }

  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : html.length;
    const block = html.slice(start, Math.min(end, start + 2000));

    // Nom et marque
    const descM = block.match(
      /m-orderProduct__name[^>]*>([\s\S]*?)<\/p>/,
    );
    const descHtml = descM?.[1] ?? '';
    const brandM = descHtml.match(/<strong[^>]*>\s*([^<]+)\s*<\/strong>/);
    const brand = brandM ? decode(brandM[1].trim()) : undefined;
    const nameRaw = descHtml.replace(/<strong[^>]*>[\s\S]*?<\/strong>/g, '');
    const name = decode(nameRaw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());

    if (!name) continue;

    // Quantité : "Quantité : 6" ou "x6" ou juste "6"
    const qtyM = block.match(/(?:Quantit[eé]\s*:\s*|[×x]\s*)(\d+)/i)
      ?? block.match(/m-orderProduct__quantity[^>]*>[^<]*?(\d+)/);
    const quantity = qtyM ? parseInt(qtyM[1], 10) : 1;

    // Prix
    const priceM = block.match(/m-orderProduct__price[^>]*>([^<]+)/);
    const priceFormatted = priceM ? decode(priceM[1].trim()) : '';
    const price = parsePrice(priceFormatted);

    products.push({ name, brand, quantity, price, priceFormatted, category });
  }

  return products;
}
