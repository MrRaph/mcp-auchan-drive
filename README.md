# mcp-auchan-drive

Serveur MCP pour [Auchan Drive](https://www.auchan.fr). Permet à Claude de rechercher des produits, gérer un panier et préparer des commandes de courses — sans passer par le navigateur.

Inspiré de [mcp-leclerc-drive](https://github.com/skunkobi/mcp-leclerc-drive) dont il reprend l'architecture.

> ⚠️ Outil non officiel, non affilié à Auchan. Usage personnel uniquement.

---

## Fonctionnalités

- Recherche de produits dans le catalogue Auchan Drive (prix, prix/kg, marque, disponibilité)
- Gestion du panier (ajouter, retirer, modifier les quantités)
- Sélection du drive le plus proche (par ville ou code postal)
- Lecture du programme de fidélité Waaoh (cagnotte, Jour W!, défis)
- Authentification automatique via les cookies Chrome ou Firefox locaux

---

## Prérequis

- Node.js ≥ 18
- Chrome **ou** Firefox installé avec une session Auchan Drive active

---

## Installation

```bash
git clone https://github.com/MrRaph/mcp-auchan-drive.git
cd mcp-auchan-drive
npm install
npm run build
```

---

## Configuration

### Claude Desktop

Ajouter dans `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) :

```json
{
  "mcpServers": {
    "auchan-drive": {
      "command": "node",
      "args": ["/chemin/absolu/vers/mcp-auchan-drive/dist/index.js"],
      "env": {
        "AUCHAN_BROWSER": "firefox"
      }
    }
  }
}
```

Redémarrer Claude Desktop après modification.

### Claude Code (CLI)

Ajouter dans `~/.claude/settings.json` (section `mcpServers`) ou via la commande
`claude mcp add` :

```bash
claude mcp add auchan-drive node /chemin/vers/dist/index.js --env AUCHAN_BROWSER=firefox
```

### Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `AUCHAN_STORE_ID` | — | ID drive actif (UUID vendeur, optionnel — peut être défini via `set_store`) |
| `AUCHAN_COOKIE` | — | Override manuel du header Cookie complet (mode headless/CI) |
| `AUCHAN_BROWSER` | `chrome` | Navigateur source des cookies : `chrome` ou `firefox` |
| `AUCHAN_CHROME_PROFILE` | `Default` | Profil Chrome à lire pour les cookies |
| `AUCHAN_FIREFOX_PROFILE` | — | Profil Firefox : nom du profil ou chemin absolu vers `cookies.sqlite` |
| `AUCHAN_MIN_INTERVAL_MS` | `1000` | Délai minimum entre deux requêtes (anti-DataDome) |
| `AUCHAN_JITTER_MS` | `400` | Jitter aléatoire ajouté au délai |
| `AUCHAN_MAX_RETRIES` | `3` | Nombre de retries sur 403/429 (DataDome) |
| `AUCHAN_BACKOFF_BASE_MS` | `1500` | Base du backoff exponentiel |

---

## Authentification

Le serveur lit automatiquement les cookies de session depuis le navigateur local.
**Aucune configuration manuelle de cookies n'est nécessaire** si vous êtes connecté.

### Firefox (recommandé sur macOS sans Chrome)

```json
{ "env": { "AUCHAN_BROWSER": "firefox" } }
```

Le serveur détecte automatiquement le profil actif via `profiles.ini`.

**Important** : naviguer sur `www.auchan.fr` dans Firefox avant de lancer Claude pour
que le cookie anti-bot `datadome` soit présent. Sans lui, certaines requêtes risquent
un 403.

### Chrome (défaut)

```json
{ "env": {} }
```

Le serveur lit les cookies via `chrome-cookies-secure` depuis le profil `Default`.
Pour un autre profil : `AUCHAN_CHROME_PROFILE=Profil 2`.

### Mode headless / CI

```json
{ "env": { "AUCHAN_COOKIE": "connect.sid=...; lark-session=...; lark-consentId=...; datadome=..." } }
```

Copier le header `Cookie` complet depuis les DevTools du navigateur (onglet Réseau → n'importe
quelle requête vers `www.auchan.fr` → Headers de requête → Cookie).

---

## Outils MCP exposés

| Outil | Paramètres | Description |
|---|---|---|
| `search_product` | `query: string` | Recherche dans le catalogue → liste de produits avec prix, marque, disponibilité |
| `add_to_cart` | `product_id: string`, `quantity?: number` | Ajoute un produit au panier (utiliser `search_product` d'abord) |
| `remove_from_cart` | `product_id: string` | Retire complètement un produit du panier |
| `update_quantity` | `product_id: string`, `quantity: number` | Modifie la quantité (0 = retire l'article) |
| `get_cart` | — | Lit le panier complet avec le total |
| `find_stores` | `query: string` | Trouve les drives Auchan proches d'une ville ou d'un code postal |
| `set_store` | `store_id: string`, `store_name?: string` | Sélectionne le drive actif |
| `get_store` | — | Affiche le drive actuellement sélectionné |
| `get_loyalty_info` | — | Lit le programme de fidélité : cagnotte, carte Waaoh, Jour W!, défis |

### Exemple de session Claude — courses

```
Utilisateur : Trouve un drive Auchan près de chez moi (Lyon)

Claude : [find_stores("Lyon")]
         Voici les drives disponibles :
         • Auchan Drive Supermarché Caluire — 3.2 km
         • Auchan Drive Caluire — 4.1 km
         • Auchan Drive Lyon Saint-Priest — 7.8 km
         …

Utilisateur : Prends le Drive Caluire

Claude : [set_store("8dede798-9649-4481-acea-486d00396e73")]
         ✅ Drive actif : Auchan Drive Supermarché Caluire

Utilisateur : Cherche du café moulu

Claude : [search_product("café moulu")]
         Voici les cafés disponibles :
         • Café Carte Noire Pur Arabica 250g — 4,99 € (19,96 €/kg)
         • Café L'Or Espresso 500g — 7,49 € (14,98 €/kg)
         …

Utilisateur : Ajoute 2 paquets du Carte Noire

Claude : [add_to_cart("acfdc139-...", 2)]
         ✅ Panier mis à jour — 2× Café Carte Noire Pur Arabica 250g (9,98 €)
```

### Exemple de session Claude — fidélité

```
Utilisateur : C'est quoi mon solde de cagnotte Waaoh ?

Claude : [get_loyalty_info()]
         Votre programme de fidélité Waaoh :
         • Carte n° 0491355117428 — CHARRAT Raphaël
         • Cagnotte : 3,46 € (valable jusqu'au 04/06/2026)
         • Jour W! activé : chaque mercredi, 10 % cagnottés sur les produits frais des Halles
         • Défis Waaoh : 0,00 € en cours (jusqu'au 30 juin 2026)
```

---

## Comment ça marche

### Architecture générale

Auchan Drive est une SPA Hybris/Spartacus (SAP Commerce Cloud) rendue côté serveur via un
framework propriétaire appelé CREST. Le serveur MCP reverse-engineer les APIs XHR que la
SPA appelle :

```
Claude (MCP client)
  │
  ▼
mcp-auchan-drive (Node.js / stdio)
  ├── CookieProvider    ← lit les cookies depuis Chrome ou Firefox
  ├── Throttler         ← sérialise les requêtes (anti-DataDome)
  ├── AuchanClient      ← appelle /recherche, /cart, /cart/update, /fidelite/accueil
  └── StoreLocator      ← géocodage + /offering-contexts
```

### Flux search → panier

1. `search_product("café")` → `GET /recherche?text=café` → HTML ~337 Ko parsé par regex
2. `add_to_cart(productId, ...)` → `GET /cart` pour obtenir le `cartId`, puis `POST /cart/update`
3. Le `sellerId` vient des `data-*` attributes du DOM de recherche (pas d'appel API séparé)

### Flux store locator

1. `find_stores("Lyon")` → `GET api-adresse.data.gouv.fr` pour obtenir lat/lng + code postal
2. `GET /offering-contexts` avec `Accept: application/crest` et `X-Crest-Renderer: journey-renderer`
3. Parse le fragment HTML retourné pour extraire les `<div.journeyPosItem data-id="...">`
4. `set_store(id)` → mémorise le drive dans `store-state.json` (le drive est aussi lié à la session)

### Flux fidélité

1. `get_loyalty_info()` → `GET /fidelite/accueil` → HTML ~350 Ko parsé par regex
2. La page est entièrement server-side rendered — les données (cagnotte, carte, Jour W!, défis) sont dans le DOM initial
3. Pas d'endpoint REST JSON dédié : les fragments `/fragments/loyalty/*` sont des Server-Side Includes internes inaccessibles directement

### Pourquoi le panier est vide après le smoke test

Le smoke test (`npm run smoke`) est un test end-to-end **non destructif** :
il ajoute un produit pour tester, puis le supprime. Le panier est vide à la fin par
conception. Pour ajouter définitivement un article via le MCP, utiliser l'outil `add_to_cart`
via Claude sans appeler `remove_from_cart`.

---

## Développement

```bash
npm run dev            # compilation TypeScript en watch
npm run typecheck      # vérification des types sans emit
npm run inspect        # MCP Inspector (test interactif des outils)
npm test               # tests unitaires et d'intégration (Vitest)
npm run test:coverage  # couverture de tests
npm run smoke          # test end-to-end contre un vrai compte Auchan
```

### Smoke test

```bash
# Avec Firefox (macOS sans Chrome)
AUCHAN_BROWSER=firefox npm run smoke

# Avec un drive connu (saute l'étape find_stores)
AUCHAN_STORE_ID=8dede798-9649-4481-acea-486d00396e73 AUCHAN_BROWSER=firefox npm run smoke

# Avec une autre ville
SMOKE_QUERY=Lille AUCHAN_BROWSER=firefox npm run smoke
```

---

## Architecture du code

```
src/
  index.ts              # Serveur MCP : enregistrement des outils, transport stdio
  config.ts             # Config runtime (variables d'env)
  types.ts              # Types partagés : Product, CartItem, Cart, Store, LoyaltyInfo
  store.ts              # État du drive actif (persisté dans store-state.json)
  auth/
    cookies.ts          # CookieProvider : Chrome, Firefox, ou override env
  auchan/
    client.ts           # Client HTTP : /recherche, /cart, /cart/update, /fidelite/accueil
    locator.ts          # Store locator : api-adresse.data.gouv.fr + /offering-contexts
    parser.ts           # Parser HTML /recherche → SearchProduct[]
    loyalty-parser.ts   # Parser HTML /fidelite/accueil → LoyaltyInfo
    cart-mapper.ts      # Mapper JSON /cart → Cart
    throttle.ts         # Throttler anti-DataDome (sérialisation + backoff)
docs/
  api-capture.md        # Documentation complète des endpoints reverse-engineerés
scripts/
  smoke-test.mjs        # Test end-to-end contre un vrai compte (7 étapes)
tests/
  unit/                 # Tests unitaires (logique pure, sans I/O réseau)
  integration/          # Tests avec fetch mocké (AuchanClient, StoreLocator)
  fixtures/             # Réponses API capturées pour les tests
```

Voir [docs/api-capture.md](./docs/api-capture.md) pour la documentation complète des
endpoints, headers requis, structure des réponses et quirks découverts.

---

## Licence

MIT
