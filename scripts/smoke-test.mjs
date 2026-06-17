#!/usr/bin/env node
/**
 * smoke-test.mjs — Test end-to-end contre le vrai site Auchan Drive
 *
 * Prérequis :
 *   - npm run build (dist/ doit exister)
 *   - Être connecté à Auchan Drive dans Chrome
 *     OU renseigner AUCHAN_COOKIE avec le header Cookie capturé dans DevTools
 *   - (Optionnel) SMOKE_QUERY=votre-ville  (défaut: "Lyon")
 *
 * Usage :
 *   npm run smoke
 *   SMOKE_QUERY=Lille npm run smoke
 */

import { AuchanClient } from '../dist/auchan/client.js';
import { StoreLocator } from '../dist/auchan/locator.js';
import { StoreManager } from '../dist/store.js';
import { Throttler } from '../dist/auchan/throttle.js';
import { createCookieProvider } from '../dist/auth/cookies.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

let step = 0;
let failed = 0;

function ok(msg) {
  step++;
  console.log(`  ✅ Étape ${step} OK — ${msg}`);
}

function fail(msg, err) {
  step++;
  failed++;
  console.error(`  ❌ Étape ${step} FAIL — ${msg}`);
  if (err) console.error(`     ${err instanceof Error ? err.message : String(err)}`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── Initialisation ───────────────────────────────────────────────────────────

const searchQuery = process.env.SMOKE_QUERY ?? 'Lyon';
const cookieProvider = createCookieProvider();
const throttler = new Throttler();
const client = new AuchanClient(cookieProvider, throttler);
const locator = new StoreLocator(cookieProvider, throttler);
const storeManager = new StoreManager();

console.log('\n🛒  Auchan Drive — Smoke Test\n');
console.log(`  Recherche de drives autour de : ${searchQuery}`);
if (process.env.AUCHAN_COOKIE) {
  console.log('  Auth : variable AUCHAN_COOKIE');
} else if ((process.env.AUCHAN_BROWSER ?? '').toLowerCase() === 'firefox') {
  const profile = process.env.AUCHAN_FIREFOX_PROFILE ?? '(profil actif, auto-détecté)';
  console.log(`  Auth : cookies Firefox — ${profile}`);
} else {
  console.log(`  Auth : cookies Chrome (profil ${process.env.AUCHAN_CHROME_PROFILE ?? 'Default'})`);
}
console.log();

// ── Étape 1 — find_stores (peut être sautée via AUCHAN_STORE_ID) ──────────────

let storeId = process.env.AUCHAN_STORE_ID;
if (storeId) {
  step++;
  console.log(`  ⏭️  Étape ${step} SKIP — find_stores (AUCHAN_STORE_ID=${storeId} déjà défini)\n`);
} else {
  try {
    const stores = await locator.findStores(searchQuery);
    assert(stores.length > 0, 'Aucun drive trouvé');
    storeId = stores[0].id;
    ok(`${stores.length} drives trouvés — premier : ${stores[0].name} (id: ${storeId})`);
    console.log('     Drives disponibles :');
    for (const s of stores.slice(0, 5)) {
      const dist = s.distance != null ? ` — ${(s.distance / 1000).toFixed(1)} km` : '';
      console.log(`       • ${s.name} [${s.id}]${dist}`);
    }
    console.log();
  } catch (err) {
    fail('find_stores a échoué', err);
    console.error(
      '\n  💡 L\'endpoint store locator Auchan n\'est pas encore connu.' +
      '\n     Pour le capturer : ouvrez www.auchan.fr dans Firefox → DevTools → Réseau → XHR,' +
      '\n     cliquez "Choisir un drive", notez le seller.id, puis relancez :' +
      '\n     AUCHAN_STORE_ID=<votre-id> AUCHAN_BROWSER=firefox npm run smoke' +
      '\n     ⏩ Continuation des étapes 3-8 (search / promos / cart) en utilisant la session Firefox...\n',
    );
  }
}

// ── Étape 2 — set_store (sautée si storeId introuvable) ──────────────────────

if (storeId) {
  try {
    await storeManager.setActiveStore(storeId);
    const state = await storeManager.getActiveStore();
    assert(state?.storeId === storeId, 'StoreManager n\'a pas persisté le storeId');
    ok(`Drive actif défini : ${storeId}`);
  } catch (err) {
    fail('set_store / get_store a échoué', err);
  }
} else {
  step++;
  console.log(`  ⏭️  Étape ${step} SKIP — set_store (aucun storeId disponible, session Firefox utilisée)\n`);
}

// ── Étape 3 — search_product ─────────────────────────────────────────────────

let firstProduct;
try {
  const products = await client.search('café');
  assert(products.length > 0, 'Aucun produit retourné pour "café"');
  firstProduct = products[0];
  ok(`${products.length} produits trouvés — premier : "${firstProduct.name}" (${(firstProduct.price / 100).toFixed(2)} €)`);
  console.log(`     productId : ${firstProduct.productId}`);
  console.log(`     offerId   : ${firstProduct.offerId}`);
  console.log();
} catch (err) {
  fail('search_product a échoué', err);
  // Pas de process.exit — étapes suivantes peuvent encore être partiellement testées
}

// ── Étape 4 — search_promos ──────────────────────────────────────────────────

try {
  const promos = await client.searchPromos();
  assert(promos.length > 0, 'Aucun produit en promo retourné (page /boutique/promos vide)');
  ok(`${promos.length} produits en promo trouvés — premier : "${promos[0].name}" (${(promos[0].price / 100).toFixed(2)} €)`);
  console.log(`     productId : ${promos[0].productId}`);
  console.log();
} catch (err) {
  fail('search_promos a échoué', err);
}

// ── Étape 5 — add_to_cart ─────────────────────────────────────────────────────

if (firstProduct) {
  try {
    const cart = await client.addToCart(
      firstProduct.productId,
      firstProduct.offerId,
      firstProduct.sellerId,
      firstProduct.sellerType,
      2,
    );
    const line = cart.items.find((i) => i.productId === firstProduct.productId);
    assert(line, `Produit ${firstProduct.productId} absent du panier après ajout`);
    assert(line.quantity === 2, `Quantité attendue 2, obtenu ${line.quantity}`);
    ok(`add_to_cart OK — quantité : ${line.quantity}, total panier : ${(cart.total / 100).toFixed(2)} €`);
  } catch (err) {
    fail('add_to_cart a échoué', err);
  }
} else {
  step++;
  console.log(`  ⏭️  Étape ${step} SKIP — add_to_cart (search_product a échoué)\n`);
}

// ── Étape 6 — get_cart ───────────────────────────────────────────────────────

try {
  const cart = await client.getCart();
  assert(cart.itemCount >= 1, 'Panier vide après add_to_cart');
  assert(cart.total > 0, 'Total panier nul');
  ok(`get_cart OK — ${cart.itemCount} article(s), total : ${(cart.total / 100).toFixed(2)} €`);
} catch (err) {
  fail('get_cart a échoué', err);
}

// ── Étape 7 — update_quantity ────────────────────────────────────────────────

if (firstProduct) {
  try {
    const cart = await client.updateQuantity(firstProduct.productId, 1);
    const line = cart.items.find((i) => i.productId === firstProduct.productId);
    assert(line, `Produit absent du panier après update_quantity`);
    assert(line.quantity === 1, `Quantité attendue 1, obtenu ${line.quantity}`);
    ok(`update_quantity OK — nouvelle quantité : ${line.quantity}`);
  } catch (err) {
    fail('update_quantity a échoué', err);
  }
} else {
  step++;
  console.log(`  ⏭️  Étape ${step} SKIP — update_quantity (search_product a échoué)\n`);
}

// ── Étape 8 — remove_from_cart ───────────────────────────────────────────────

if (firstProduct) {
  try {
    const cart = await client.removeFromCart(firstProduct.productId);
    const line = cart.items.find((i) => i.productId === firstProduct.productId);
    assert(!line, 'Produit encore présent dans le panier après remove_from_cart');
    ok(`remove_from_cart OK — panier contient désormais ${cart.itemCount} article(s)`);
  } catch (err) {
    fail('remove_from_cart a échoué', err);
  }
} else {
  step++;
  console.log(`  ⏭️  Étape ${step} SKIP — remove_from_cart (search_product a échoué)\n`);
}

// ── Résultat ─────────────────────────────────────────────────────────────────

console.log();
if (failed === 0) {
  console.log(`✅  Smoke test complet — toutes les étapes ont réussi.\n`);
} else {
  console.error(`❌  Smoke test terminé avec ${failed} échec(s).\n`);
  process.exit(1);
}
