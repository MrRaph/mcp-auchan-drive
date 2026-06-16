/**
 * index.ts — Serveur MCP Auchan Drive
 *
 * Expose 8 outils via le protocole MCP (stdio) :
 *   search_product, add_to_cart, remove_from_cart, update_quantity,
 *   get_cart, find_stores, set_store, get_store
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AuchanClient } from './auchan/client.js';
import { StoreLocator } from './auchan/locator.js';
import { StoreManager } from './store.js';
import { Throttler } from './auchan/throttle.js';
import { createCookieProvider } from './auth/cookies.js';
import type { SearchProduct } from './auchan/parser.js';

// Cache de recherche : productId → SearchProduct complet
// Nécessaire car add_to_cart reçoit seulement productId mais client.addToCart()
// a besoin de offerId / sellerId / sellerType
const searchCache = new Map<string, SearchProduct>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Encapsule n'importe quelle valeur sérialisable en CallToolResult. */
function ok(value: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

/** Encapsule une erreur en CallToolResult avec isError:true. */
function fail(err: unknown): { content: [{ type: 'text'; text: string }]; isError: true } {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cookieProvider = createCookieProvider();
  const throttler = new Throttler();
  const client = new AuchanClient(cookieProvider, throttler);
  const locator = new StoreLocator(cookieProvider, throttler);
  const storeManager = new StoreManager();

  const server = new McpServer({ name: 'auchan-drive', version: '0.1.0' });

  // ── 1. search_product ────────────────────────────────────────────────────────
  server.registerTool(
    'search_product',
    {
      description: 'Recherche des produits dans le catalogue Auchan Drive.',
      inputSchema: { query: z.string().describe('Terme de recherche (ex : "lait demi-écrémé")') },
    },
    async ({ query }) => {
      try {
        const results = await client.search(query);
        for (const p of results) searchCache.set(p.productId, p);
        return ok(results);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 2. add_to_cart ───────────────────────────────────────────────────────────
  server.registerTool(
    'add_to_cart',
    {
      description:
        'Ajoute un produit au panier. Nécessite d\'avoir d\'abord appelé search_product.',
      inputSchema: {
        product_id: z.string().describe('UUID du produit (data-product-id)'),
        quantity: z.number().int().min(1).default(1).describe('Quantité à ajouter'),
      },
    },
    async ({ product_id, quantity }) => {
      try {
        const cached = searchCache.get(product_id);
        if (!cached) {
          return fail(
            new Error(`Produit "${product_id}" absent du cache. Lancez search_product d'abord.`),
          );
        }
        const cart = await client.addToCart(
          cached.productId,
          cached.offerId,
          cached.sellerId,
          cached.sellerType,
          quantity,
        );
        return ok(cart);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 3. remove_from_cart ──────────────────────────────────────────────────────
  server.registerTool(
    'remove_from_cart',
    {
      description: 'Retire complètement un produit du panier.',
      inputSchema: {
        product_id: z.string().describe('UUID du produit à retirer'),
      },
    },
    async ({ product_id }) => {
      try {
        const cart = await client.removeFromCart(product_id);
        return ok(cart);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 4. update_quantity ───────────────────────────────────────────────────────
  server.registerTool(
    'update_quantity',
    {
      description: 'Met à jour la quantité d\'un article dans le panier (0 = retire l\'article).',
      inputSchema: {
        product_id: z.string().describe('UUID du produit'),
        quantity: z.number().int().min(0).describe('Nouvelle quantité (0 pour retirer)'),
      },
    },
    async ({ product_id, quantity }) => {
      try {
        const cart = await client.updateQuantity(product_id, quantity);
        return ok(cart);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 5. get_cart ──────────────────────────────────────────────────────────────
  server.registerTool(
    'get_cart',
    {
      description: 'Lit le contenu complet du panier avec le total.',
      inputSchema: {},
    },
    async () => {
      try {
        const cart = await client.getCart();
        return ok(cart);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 6. find_stores ───────────────────────────────────────────────────────────
  server.registerTool(
    'find_stores',
    {
      description: 'Trouve les drives Auchan proches d\'un code postal ou d\'une ville.',
      inputSchema: {
        query: z.string().describe('Code postal ou nom de ville (ex : "59000" ou "Lille")'),
      },
    },
    async ({ query }) => {
      try {
        const stores = await locator.findStores(query);
        return ok(stores);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 7. set_store ─────────────────────────────────────────────────────────────
  server.registerTool(
    'set_store',
    {
      description: 'Sélectionne le drive Auchan actif pour les prochaines requêtes.',
      inputSchema: {
        store_id: z.string().describe('Identifiant du drive (ex : "drive-lille-nord")'),
        store_name: z.string().optional().describe('Nom lisible du drive (optionnel)'),
      },
    },
    async ({ store_id, store_name }) => {
      try {
        await storeManager.setActiveStore(store_id, store_name);
        return ok({ success: true, storeId: store_id, storeName: store_name ?? null });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ── 8. get_store ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_store',
    {
      description: 'Affiche le drive Auchan actuellement sélectionné.',
      inputSchema: {},
    },
    async () => {
      try {
        const state = await storeManager.getActiveStore();
        if (!state) return ok({ active: false, message: 'Aucun drive sélectionné.' });
        return ok({ active: true, storeId: state.storeId, storeName: state.storeName ?? null });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ─── Connexion ───────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[auchan-drive] Fatal error:', err);
  process.exit(1);
});
