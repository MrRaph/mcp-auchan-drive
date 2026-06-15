# CLAUDE.md — mcp-auchan-drive

MCP server pour Auchan Drive (auchan.fr). Permet à Claude de rechercher des produits, gérer un panier et préparer des commandes de courses, sans passer par le navigateur.

Inspiré de [mcp-leclerc-drive](https://github.com/skunkobi/mcp-leclerc-drive) dont on reprend l'architecture complète.

---

## Stack technique

- **Langage** : TypeScript (ESM, `"type": "module"`)
- **Runtime** : Node.js ≥ 18
- **MCP SDK** : `@modelcontextprotocol/sdk` (transport stdio)
- **Validation** : `zod`
- **Auth cookies** : `chrome-cookies-secure` (lit la session Chrome locale, inclus le cookie DataDome)
- **Build** : `tsc` → `dist/`

---

## Architecture

```
src/
  index.ts            # Serveur MCP : enregistrement des outils, transport stdio
  config.ts           # Config runtime (variables d'env)
  types.ts            # Types partagés : Product, CartItem, Cart
  store.ts            # État du magasin actif (persisté entre sessions)
  auth/
    cookies.ts        # CookieProvider : session Chrome ou override env
  auchan/
    client.ts         # Client HTTP Auchan Drive (API reverse-engineered)
    locator.ts        # Store locator (API Woosmap Auchan)
    throttle.ts       # Throttler anti-DataDome (sérialisation + backoff)
docs/
  api-capture.md      # Documentation de l'API Auchan reverse-engineerée
scripts/
  smoke-test.mjs      # Test end-to-end contre un vrai compte
```

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `AUCHAN_STORE_ID` | — | ID du magasin drive (ex. `"drive-lille-nord"`) |
| `AUCHAN_COOKIE` | — | Override manuel du header `Cookie` (headless/CI) |
| `AUCHAN_CHROME_PROFILE` | `"Default"` | Profil Chrome à lire pour les cookies |
| `AUCHAN_MIN_INTERVAL_MS` | `1000` | Délai minimum entre deux requêtes |
| `AUCHAN_JITTER_MS` | `400` | Jitter aléatoire entre requêtes |
| `AUCHAN_MAX_RETRIES` | `3` | Retries sur 403/429 (DataDome) |
| `AUCHAN_BACKOFF_BASE_MS` | `1500` | Backoff de base pour les retries |

**Auth par défaut (recommandé)** : se connecter à Auchan Drive dans Chrome une fois. Le serveur lit automatiquement la session (cookie DataDome inclus) depuis le profil Chrome local — sans copier-coller.

**Deploy headless** : renseigner `AUCHAN_COOKIE` avec le header `Cookie` capturé dans les DevTools.

---

## Outils MCP exposés

| Outil | Description |
|---|---|
| `search_product(query)` | Recherche dans le catalogue → produits avec prix, prix/kg, marque, disponibilité, id |
| `add_to_cart(product_id, quantity?)` | Ajoute un produit au panier |
| `remove_from_cart(product_id)` | Retire un produit du panier |
| `update_quantity(product_id, quantity)` | Met à jour la quantité (0 = retire) |
| `get_cart()` | Lit le panier complet avec total |
| `find_stores(query)` | Trouve les drives Auchan proches d'un code postal / ville |
| `set_store(store_id)` | Sélectionne le drive actif |
| `get_store()` | Affiche le drive actuellement sélectionné |

---

## Différences majeures avec Leclerc Drive

| Aspect | Leclerc Drive | Auchan Drive |
|---|---|---|
| Frontend | ASP.NET server-rendered | SPA React/Spartacus (client-rendered) |
| API type | Scraping HTML (globals JS injectés dans la page) | REST JSON (vraisemblablement SAP Hybris OCC) |
| Product IDs | Entiers (`iIdProduit`) | Codes alphanumériques (`C1350678`) + UUID |
| Images | `fd9-photos.leclercdrive.fr` | `cdn.auchan.fr/media/` |
| Store locator | `api-recherchemagasins.leclercdrive.fr` (Woosmap) | API Woosmap Auchan (à reverse-engineer) |
| Anti-bot | DataDome | DataDome (même mécanisme) |

---

## Protection anti-bot DataDome

Même mécanisme que Leclerc Drive :
- Le cookie `datadome` doit être rejoué dans chaque requête.
- Les requêtes en parallèle ou trop rapides déclenchent un challenge 403.
- Le `Throttler` sérialise toutes les requêtes avec délai + jitter + backoff.
- En cas de 403/429, invalider le cache de cookies et réessayer (re-lecture Chrome).

---

## Commandes de développement

```bash
npm install
npm run build          # tsc → dist/
npm run dev            # tsc --watch
npm run typecheck      # vérification de types sans emit
npm run inspect        # MCP Inspector
npm run smoke          # smoke test end-to-end
```

---

## Configuration Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "auchan-drive": {
      "command": "node",
      "args": ["/chemin/absolu/vers/mcp-auchan-drive/dist/index.js"],
      "env": {
        "AUCHAN_STORE_ID": "votre-store-id"
      }
    }
  }
}
```

---

## Reverse-engineering de l'API

Voir `docs/api-capture.md` pour la documentation complète des endpoints.

Auchan.fr est une SPA — toutes les requêtes sont des XHR/fetch visibles dans les DevTools (onglet Réseau). Protocole pour capturer :

1. Se connecter à Auchan Drive dans Chrome
2. Ouvrir DevTools → Réseau → filtrer `Fetch/XHR`
3. Effectuer une recherche, ajouter un produit au panier, lire le panier
4. Documenter chaque requête (URL, méthode, headers, body, réponse) dans `docs/api-capture.md`

L'API sous-jacente est probablement SAP Hybris OCC avec pattern `/{baseSiteId}/...` mais les URLs exactes et l'authentification nécessitent une capture live.

---

## Avertissement

Outil non officiel, non affilié à Auchan. Usage personnel uniquement, dans le respect des conditions d'utilisation du site. Ne pas abuser des requêtes automatisées.
