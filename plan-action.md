# Plan d'action — MCP Auchan Drive (TDD)

> Basé sur l'analyse de [mcp-leclerc-drive](https://github.com/skunkobi/mcp-leclerc-drive) (TypeScript, stdio, cookie Chrome, DataDome).
> Approche **Test-Driven Development** : chaque fonctionnalité est précédée de ses tests (Red → Green → Refactor).

---

## Philosophie TDD appliquée à ce projet

Le cycle à suivre systématiquement :
1. **Red** — écrire un test qui échoue décrivant le comportement attendu
2. **Green** — implémenter le minimum de code pour faire passer le test
3. **Refactor** — nettoyer le code sans casser les tests

Trois niveaux de tests :
- **Tests unitaires** — logique pure (parsers, mappers, formatters, throttler). Aucun I/O réseau.
- **Tests d'intégration avec mocks HTTP** — le client Auchan appelé avec des réponses HTTP fixtures. Isole l'implémentation de l'API réelle.
- **Tests end-to-end (smoke)** — contre le vrai site Auchan Drive, avec un vrai compte. Exécutés manuellement avant chaque release.

---

## Phase 0 — Scaffold + infrastructure de test (½ journée)

**Objectif** : repo TypeScript qui compile, avec le test runner opérationnel.

### 0.1 Init projet

```bash
git init mcp-auchan-drive && npm init
```

Copier/adapter `tsconfig.json`, `package.json`, `.gitignore` depuis mcp-leclerc-drive.

### 0.2 Framework de test

Utiliser **Vitest** (natif ESM, TypeScript sans config supplémentaire, compatible `"type": "module"`).

```bash
npm install -D vitest @vitest/coverage-v8
```

`package.json` — ajouter :
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

`vitest.config.ts` :
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/**'] }
  }
})
```

### 0.3 Structure des tests

```
tests/
  unit/
    auchan/
      parser.test.ts      # tests des fonctions de parsing des réponses API
      mapper.test.ts      # tests Product/Cart mapping
      throttle.test.ts    # tests du Throttler (delays, retries, backoff)
    auth/
      cookies.test.ts     # tests du CookieProvider
    formatting.test.ts    # tests formatProduct / formatCart
  integration/
    client.test.ts        # AuchanClient avec fetch mocké (MSW ou vi.mock)
    locator.test.ts       # StoreLocator avec fetch mocké
  e2e/
    smoke-test.mjs        # test live contre le vrai Auchan Drive (hors CI)
  fixtures/
    search-response.json  # réponse API search capturée en Phase 1
    cart-response.json    # réponse API get_cart capturée en Phase 1
    add-response.json     # réponse API add_to_cart capturée en Phase 1
    stores-response.json  # réponse API store locator capturée en Phase 1
```

### 0.4 Mock HTTP

Utiliser **`vi.mock`** de Vitest ou **MSW (Mock Service Worker)** en mode Node pour intercepter les appels `fetch` dans les tests d'intégration :

```bash
npm install -D msw
```

### 0.5 Vérification

- `npm test` → 0 tests, 0 échecs (infrastructure vide, mais fonctionnelle)
- `npm run build` → compile sans erreur

---

## Phase 1 — Reverse-engineering de l'API Auchan (1–2 jours) ⚠️ Point critique

Cette phase produit les **fixtures de test** dont toutes les phases suivantes dépendent.

### 1.1 Capture réseau

Ouvrir Auchan Drive dans Chrome, DevTools → Réseau → Fetch/XHR, effectuer chaque opération et sauvegarder la réponse brute dans `tests/fixtures/` :

| Opération | Fixture à sauvegarder |
|---|---|
| Recherche `"café"` | `search-response.json` |
| Lecture du panier | `cart-get-response.json` |
| Ajout d'un produit | `cart-add-response.json` |
| Mise à jour quantité | `cart-update-response.json` |
| Suppression d'un article | `cart-remove-response.json` |
| Store locator (code postal) | `stores-response.json` |

Documenter chaque endpoint dans `docs/api-capture.md` (URL, méthode, headers, body, réponse).

### 1.2 Points d'attention

**Auth** : Auchan utilise probablement OAuth2/Keycloak (token JWT `Authorization: Bearer ...`) en plus des cookies. Identifier si le token est dans le cookie store Chrome ou dans `localStorage`.

**cartId** : Hybris OCC utilise un `cartId` par session. Capturer comment il est obtenu et maintenu.

**IDs produits** : les URLs ont deux formats — UUID interne et code catalogue `C1350678`. Identifier lequel sert pour les mutations panier.

**DataDome** : valider que `chrome-cookies-secure` lit bien les cookies du domaine `.auchan.fr`.

---

## Phase 2 — Throttler (½ journée, TDD)

Le Throttler est de la logique pure, idéale pour commencer le TDD.

### Red — écrire les tests d'abord

`tests/unit/auchan/throttle.test.ts` :

```typescript
describe('Throttler', () => {
  it('exécute une tâche et retourne son résultat')
  it('attend au moins minIntervalMs entre deux appels')
  it('ajoute un jitter aléatoire entre 0 et jitterMs')
  it('retry sur une erreur retryable (403/429) avec backoff exponentiel')
  it('lève une erreur après maxRetries tentatives')
  it('ne retente pas sur une erreur non-retryable (400, 500)')
  it('sérialise les appels (pas de parallélisme)')
})
```

### Green — implémenter `src/auchan/throttle.ts`

Copier depuis mcp-leclerc-drive et adapter jusqu'à ce que tous les tests passent.

### Refactor

Extraire les constantes, typer les options, supprimer le code mort.

---

## Phase 3 — Parsers et mappers (½ journée, TDD)

Fonctions pures qui transforment les réponses JSON de l'API Auchan en types internes.

### Red — écrire les tests avec les fixtures de Phase 1

`tests/unit/auchan/parser.test.ts` :

```typescript
import searchFixture from '../../fixtures/search-response.json'
import cartFixture from '../../fixtures/cart-get-response.json'

describe('parseSearchResults', () => {
  it('extrait les produits depuis la réponse de recherche')
  it('retourne un tableau vide si aucun résultat')
  it('ignore les entrées sans ID produit')
  it('décode les entités HTML dans les libellés')
})

describe('mapProduct', () => {
  it('mappe id, label, brand, price depuis un produit brut')
  it('calcule available depuis le champ stock')
  it('retourne pricePerUnit si présent')
  it('retourne nutriScore si présent')
})

describe('parseCart', () => {
  it('extrait les items et le total depuis la réponse panier')
  it('retourne un panier vide si entries est vide')
  it('calcule correctement itemCount')
})
```

`tests/unit/formatting.test.ts` :

```typescript
describe('formatProduct', () => {
  it('inclut label, marque, prix et id')
  it('omet la marque si absente')
  it('affiche ⚠️ si indisponible')
  it('affiche le prix/kg si présent')
})

describe('formatCart', () => {
  it('affiche "Panier vide." si aucun article')
  it('liste chaque article avec quantité et total de ligne')
  it('affiche le total général')
})
```

### Green — implémenter les parsers

Écrire `src/auchan/parser.ts` et les fonctions `formatProduct` / `formatCart` dans `src/index.ts`.

### Refactor

Nettoyer les types, extraire les helpers (`parseEuro`, `decodeEntities`).

---

## Phase 4 — CookieProvider (½ journée, TDD)

### Red

`tests/unit/auth/cookies.test.ts` :

```typescript
describe('createCookieProvider (mode env)', () => {
  it('retourne le cookie fixe configuré via AUCHAN_COOKIE')
  it('invalidate() est un no-op en mode env')
})

describe('createCookieProvider (mode Chrome)', () => {
  it('lit les cookies Chrome et les cache en mémoire')
  it('ne re-lit pas Chrome si le cache est encore valide (< 60s)')
  it('re-lit Chrome après invalidate()')
  it('lève une erreur lisible si Chrome renvoie un cookie vide')
  it('lève une erreur lisible si chrome-cookies-secure échoue')
})
```

Mocker `chrome-cookies-secure` avec `vi.mock('chrome-cookies-secure', ...)`.

### Green — implémenter `src/auth/cookies.ts`

Adapter depuis mcp-leclerc-drive (changer le domaine `auchan.fr`).

---

## Phase 5 — AuchanClient (1 jour, TDD)

C'est le cœur du projet. Les tests mockent le réseau avec MSW.

### Red

`tests/integration/client.test.ts` — configurer MSW pour intercepter les appels et retourner les fixtures :

```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import searchFixture from '../fixtures/search-response.json'
import cartFixture from '../fixtures/cart-get-response.json'

const server = setupServer(
  http.get('https://www.auchan.fr/*/products/search', () =>
    HttpResponse.json(searchFixture)),
  http.get('https://www.auchan.fr/*/users/*/carts/*', () =>
    HttpResponse.json(cartFixture)),
  // ... autres endpoints
)

describe('AuchanClient.searchProducts', () => {
  it('retourne les produits mappés depuis la réponse API')
  it('retourne [] si la réponse contient zéro résultat')
  it('lève une erreur avec message actionnable sur 401')
  it('retry sur 403 (DataDome) et invalide le cookie cache')
  it('lève une erreur après maxRetries tentatives sur 403')
})

describe('AuchanClient.addToCart', () => {
  it('POST le bon body avec productId et quantity')
  it('retourne le panier mis à jour')
  it('retry sur 429')
})

describe('AuchanClient.removeFromCart', () => {
  it('supprime le produit et retourne le panier mis à jour')
})

describe('AuchanClient.updateQuantity', () => {
  it('met à jour la quantité')
  it('appelle removeFromCart si quantity = 0')
})

describe('AuchanClient.getCart', () => {
  it('retourne le panier complet avec total')
  it('retourne un panier vide si aucun article')
})
```

### Green — implémenter `src/auchan/client.ts`

Faire passer chaque test groupe par groupe, dans l'ordre du plan.

### Refactor

Extraire les helpers URL, typer les erreurs, nettoyer les retries.

---

## Phase 6 — StoreLocator (½ journée, TDD)

### Red

`tests/integration/locator.test.ts` :

```typescript
describe('StoreLocator.findStores', () => {
  it('retourne les drives proches triés par distance')
  it('retourne [] si aucun drive trouvé')
  it('mappe correctement id, nom, adresse, distance, type')
  it('lève une erreur si le code postal est invalide')
})
```

### Green — implémenter `src/auchan/locator.ts`

### Refactor

---

## Phase 7 — Serveur MCP et index (½ journée, TDD)

### Red

`tests/unit/formatting.test.ts` (déjà couvert en Phase 3).

Tests de l'enregistrement des outils — vérifier que le serveur MCP expose bien les 8 outils avec les bons noms et schémas :

```typescript
describe('MCP server tools', () => {
  it('expose search_product avec le paramètre query')
  it('expose add_to_cart avec product_id et quantity optionnel')
  it('expose remove_from_cart avec product_id')
  it('expose update_quantity avec product_id et quantity')
  it('expose get_cart sans paramètre')
  it('expose find_stores avec le paramètre query')
  it('expose set_store avec store_id')
  it('expose get_store sans paramètre')
})
```

### Green — implémenter `src/index.ts`

Reprendre la structure de mcp-leclerc-drive, adapter les noms `AUCHAN_*`.

---

## Phase 8 — Tests end-to-end (smoke) (1 jour)

Ces tests s'exécutent **manuellement** contre le vrai site (pas en CI, car ils nécessitent un compte Auchan et un cookie valide).

### Rédiger `scripts/smoke-test.mjs`

Scénario complet :

```javascript
// 1. find_stores → trouver le drive
// 2. set_store → sélectionner le drive
// 3. search_product("café") → ≥ 1 résultat, récupérer products[0].id
// 4. add_to_cart(id, 2) → panier avec 2 unités
// 5. get_cart() → vérifier total > 0
// 6. update_quantity(id, 1) → panier avec 1 unité
// 7. remove_from_cart(id) → panier vide
// Chaque étape : assertion + log clair en cas d'échec
```

### Checklist de validation manuelle

- [ ] `npm run smoke` passe du début à la fin sur un compte réel
- [ ] 5 appels en séquence rapide ne déclenchent pas de 403 DataDome
- [ ] Après `invalidate()` du cookie, le retry re-lit bien Chrome
- [ ] `npm run inspect` → les 8 outils sont visibles dans le MCP Inspector
- [ ] Test sous Claude Desktop avec une requête en langage naturel

---

## Phase 9 — Documentation et publication (½ journée)

- Rédiger `README.md` (présentation, installation, config, outils, architecture)
- Rédiger `CONTRIBUTING.md` (setup dev, TDD, smoke test, guide de reverse-engineering)
- Vérifier la couverture de tests (`npm run test:coverage`) — objectif > 80% sur `src/`
- Optionnel : publier sur npm + soumettre au MCP registry

---

## Risques et mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| **Auth JWT** : token Bearer en plus des cookies | Élevée | Variable d'env `AUCHAN_TOKEN` ; tests mockent le header |
| **cartId requis** : Hybris OCC crée/lit un cartId par session | Élevée | Test dédié sur la création/récupération du cartId ; caché dans le state |
| **Session liée au drive** : impossible de changer sans reconnexion | Moyenne | Test d'erreur explicite dans `set_store` ; message d'erreur actionnable |
| **API instable** : Auchan met à jour ses endpoints | Faible | Fixtures versionées + erreurs claires sur parsing inattendu |
| **DataDome** plus agressif | Faible | `Throttler` avec retry couvert par tests unitaires |

---

## Estimation totale

| Phase | Durée estimée |
|---|---|
| 0 — Scaffold + infra test | ½ jour |
| 1 — Reverse-engineering API | 1–2 jours |
| 2 — Throttler (TDD) | ½ jour |
| 3 — Parsers / mappers (TDD) | ½ jour |
| 4 — CookieProvider (TDD) | ½ jour |
| 5 — AuchanClient (TDD) | 1 jour |
| 6 — StoreLocator (TDD) | ½ jour |
| 7 — Serveur MCP (TDD) | ½ jour |
| 8 — Smoke tests E2E | 1 jour |
| 9 — Documentation | ½ jour |
| **Total** | **6–7 jours** |

---

## Prochaine action immédiate

**Phase 0.1** : initialiser le projet et installer Vitest.

```bash
git init mcp-auchan-drive
cd mcp-auchan-drive
npm init -y
npm install @modelcontextprotocol/sdk zod chrome-cookies-secure
npm install -D typescript @types/node vitest @vitest/coverage-v8 msw
npm run test  # doit afficher "0 tests"
```

Puis **Phase 1** : capturer l'API Auchan dans Chrome DevTools pour créer les fixtures.
