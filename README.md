# mcp-auchan-drive

Serveur MCP pour [Auchan Drive](https://www.auchan.fr). Permet à Claude de rechercher des produits, gérer un panier, consulter ses commandes et préparer ses courses — sans passer par le navigateur.

Inspiré de [mcp-leclerc-drive](https://github.com/skunkobi/mcp-leclerc-drive) dont il reprend l'architecture.

> ⚠️ Outil non officiel, non affilié à Auchan. Usage personnel uniquement.

---

## Fonctionnalités

- Recherche de produits dans le catalogue Auchan Drive (prix, prix/kg, marque, disponibilité)
- Recherche des promotions en cours (par mot-clé ou par rayon)
- Gestion du panier (ajouter, retirer, modifier les quantités)
- Sélection du drive le plus proche (par ville ou code postal)
- Consultation des commandes récentes (statut, total, magasin)
- Lecture des produits favoris (achetés régulièrement, avec promos en cours)
- Lecture du programme de fidélité Waaoh (cagnotte, Jour W!, défis)
- Historique des transactions de cagnotte
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

### Firefox (recommandé)

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
| `search_promos` | `query?: string`, `category?: string` | Produits en promotion (sans arg = toutes les promos) |
| `add_to_cart` | `product_id: string`, `quantity?: number` | Ajoute un produit au panier (utiliser `search_product` d'abord) |
| `remove_from_cart` | `product_id: string` | Retire complètement un produit du panier |
| `update_quantity` | `product_id: string`, `quantity: number` | Modifie la quantité (0 = retire l'article) |
| `get_cart` | — | Lit le panier complet avec le total |
| `find_stores` | `query: string` | Trouve les drives Auchan proches d'une ville ou d'un code postal |
| `set_store` | `store_id: string`, `store_name?: string` | Sélectionne le drive actif |
| `get_store` | — | Affiche le drive actuellement sélectionné |
| `get_loyalty_info` | — | Lit le programme de fidélité : cagnotte, carte Waaoh, Jour W!, défis |
| `get_loyalty_history` | — | Historique des transactions de cagnotte des 3 derniers mois |
| `get_orders` | `period?: string` | Historique des commandes (`10days`, `30days`, `3months`…) |
| `get_favorites` | — | Liste des produits favoris avec prix actuels et promos en cours |

### Exemple de session Claude — courses

```
Utilisateur : Trouve un drive Auchan près de chez moi (Lyon)

Claude : [find_stores("Lyon")]
         Voici les drives disponibles :
         • Auchan Drive Supermarché Caluire — 3.2 km
         • Auchan Drive Caluire — 4.1 km
         …

Utilisateur : Prends le Drive Caluire

Claude : [set_store("8dede798-9649-4481-acea-486d00396e73")]
         ✅ Drive actif : Auchan Drive Supermarché Caluire

Utilisateur : Cherche du café moulu

Claude : [search_product("café moulu")]
         • Café Carte Noire Pur Arabica 250g — 4,99 € (19,96 €/kg)
         • Café L'Or Espresso 500g — 7,49 € (14,98 €/kg)
         …

Utilisateur : Ajoute 2 paquets du Carte Noire

Claude : [add_to_cart("acfdc139-...", 2)]
         ✅ Panier mis à jour — 2× Café Carte Noire Pur Arabica 250g (9,98 €)
```

### Exemple de session Claude — promos et favoris

```
Utilisateur : Y a-t-il des promos sur la viande ?

Claude : [search_promos(category: "ca-n02")]
         • Poulet rôti fermier Label Rouge 1,2kg — 8,99 € (-20%)
         • Bœuf haché 15%MG 4×100g — 3,49 € (-30%)
         …

Utilisateur : Quels sont mes produits habituels ?

Claude : [get_favorites()]
         Vos favoris (23 produits) :
         Eaux, jus, sodas :
         • ORANGINA Boisson gazeuse 1,5l — 1,93 € (-50% sur le 2ème)
         • EVIAN Eau minérale 6×1,5l — 3,50 €
         …
```

### Exemple de session Claude — suivi commandes

```
Utilisateur : Qu'est-ce que j'ai commandé récemment ?

Claude : [get_orders(period: "30days")]
         2 commandes sur les 30 derniers jours :
         • 14 juin 2026 — Auchan Drive Caluire — 38,62 € — Enregistrée (14 produits)
         • 07 juin 2026 — Auchan Drive Caluire — 52,10 € — Livrée (21 produits)

Utilisateur : Combien j'ai cagnotté ce mois-ci ?

Claude : [get_loyalty_history()]
         3 transactions en juin 2026 :
         • 14/06 — Drive Caluire — +0,39 €
         • 07/06 — Drive Caluire — +0,52 €
         • 03/06 — Magasin Chapônost — +1,20 €
         Total : +2,11 €
```

---

## Comment ça marche

### Architecture générale

Auchan Drive est une SPA rendue côté serveur via un framework propriétaire appelé CREST.
Le serveur MCP reverse-engineer les XHR que la SPA appelle :

```
Claude (MCP client)
  │
  ▼
mcp-auchan-drive (Node.js / stdio)
  ├── CookieProvider    ← lit les cookies depuis Chrome ou Firefox
  ├── Throttler         ← sérialise les requêtes (anti-DataDome)
  ├── AuchanClient      ← /recherche, /cart, /fidelite/*, /client/*
  └── StoreLocator      ← géocodage + /offering-contexts
```

### Flux search → panier

1. `search_product("café")` → `GET /recherche?text=café` → HTML parsé par regex
2. `add_to_cart(productId)` → `GET /cart` pour obtenir le `cartId`, puis `POST /cart/update`
3. Le `sellerId` vient des `data-*` attributes du DOM de recherche (pas d'appel API séparé)

### Flux store locator

1. `find_stores("Lyon")` → `GET api-adresse.data.gouv.fr` pour obtenir lat/lng + code postal
2. `GET /offering-contexts?accuracy=MUNICIPALITY&channels=PICK_UP,SHIPPING&…` avec `Accept: application/crest`
3. Parse le fragment HTML retourné pour extraire les `<div.journeyPosItem data-id="…">`
4. `set_store(id)` → mémorise le drive dans `store-state.json`

### Flux fidélité et commandes

- `get_loyalty_info()` → `GET /fidelite/accueil` → HTML parsé par regex
- `get_loyalty_history()` → `GET /fidelite/ma-carte/historique` → HTML parsé par regex
- `get_orders(period)` → `GET /client/mes-commandes?days=90` → HTML parsé par regex
- `get_favorites()` → `GET /client/mes-produits-preferes` → HTML parsé par regex

Toutes ces pages sont server-side rendered — les données sont dans le DOM initial,
pas dans des endpoints REST JSON dédiés.

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
# Avec Firefox (recommandé)
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
  index.ts                  # Serveur MCP : enregistrement des 13 outils, transport stdio
  config.ts                 # Config runtime (variables d'env)
  types.ts                  # Types partagés : Product, CartItem, Cart, Store,
                            #   FavoriteProduct, Order, OrderPeriod,
                            #   LoyaltyInfo, LoyaltyTransaction
  store.ts                  # État du drive actif (persisté dans store-state.json)
  auth/
    cookies.ts              # CookieProvider : Chrome, Firefox, ou override env
  auchan/
    client.ts               # Client HTTP : search, cart, loyalty, orders, favorites
    locator.ts              # Store locator : api-adresse.data.gouv.fr + /offering-contexts
    throttle.ts             # Throttler anti-DataDome (sérialisation + backoff)
    parser.ts               # Parser HTML /recherche → SearchProduct[]
    loyalty-parser.ts       # Parser HTML /fidelite/accueil → LoyaltyInfo
    loyalty-history-parser.ts # Parser HTML /fidelite/ma-carte/historique → LoyaltyTransaction[]
    orders-parser.ts        # Parser HTML /client/mes-commandes → Order[]
    favorites-parser.ts     # Parser HTML /client/mes-produits-preferes → FavoriteProduct[]
    cart-mapper.ts          # Mapper JSON /cart → Cart
    html-utils.ts           # Utilitaires partagés : parsePrice, decode
docs/
  api-capture.md            # Documentation complète des endpoints reverse-engineerés
scripts/
  smoke-test.mjs            # Test end-to-end contre un vrai compte (7 étapes)
tests/
  unit/                     # Tests unitaires (logique pure, sans I/O réseau)
  integration/              # Tests avec fetch mocké (AuchanClient, StoreLocator)
  fixtures/                 # Réponses API capturées pour les tests
```

Voir [docs/api-capture.md](./docs/api-capture.md) pour la documentation complète des
endpoints, headers requis, structure des réponses et quirks découverts.

---

## Licence

MIT
