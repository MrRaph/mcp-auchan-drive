# Phase 7 — Serveur MCP (TDD)

> **Objectif** : implémenter `src/index.ts` (point d'entrée du serveur MCP), `src/config.ts` (variables d'env) et `src/store.ts` (persistance du drive actif).
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 2 à 6 terminées

---

## Tâches — Config et state

- [ ] Créer `src/config.ts` : lire et valider toutes les variables d'env (`AUCHAN_STORE_ID`, `AUCHAN_COOKIE`, `AUCHAN_CHROME_PROFILE`, `AUCHAN_MIN_INTERVAL_MS`, `AUCHAN_JITTER_MS`, `AUCHAN_MAX_RETRIES`, `AUCHAN_BACKOFF_BASE_MS`)
- [ ] Créer `src/store.ts` : stocker l'`storeId` actif en mémoire, avec `getStore()` et `setStore(id)`

## Tâches — RED (écrire les tests d'abord)

- [ ] Créer `tests/unit/server.test.ts`
- [ ] Écrire un test : le serveur expose l'outil `search_product` avec le paramètre `query` (string, requis)
- [ ] Écrire un test : le serveur expose l'outil `add_to_cart` avec `product_id` (string, requis) et `quantity` (number, optionnel, défaut 1)
- [ ] Écrire un test : le serveur expose l'outil `remove_from_cart` avec `product_id` (string, requis)
- [ ] Écrire un test : le serveur expose l'outil `update_quantity` avec `product_id` (string, requis) et `quantity` (number, requis)
- [ ] Écrire un test : le serveur expose l'outil `get_cart` sans paramètre
- [ ] Écrire un test : le serveur expose l'outil `find_stores` avec `query` (string, requis)
- [ ] Écrire un test : le serveur expose l'outil `set_store` avec `store_id` (string, requis)
- [ ] Écrire un test : le serveur expose l'outil `get_store` sans paramètre
- [ ] Vérifier que `npm test` affiche tous ces tests en rouge (FAIL)

## Tâches — GREEN (implémenter)

- [ ] Créer `src/index.ts` en important `Server` depuis `@modelcontextprotocol/sdk/server/index.js`
- [ ] Instancier `AuchanClient`, `StoreLocator`, `CookieProvider` et `Throttler` avec la config
- [ ] Enregistrer l'outil `search_product` : appelle `client.searchProducts(query)`, retourne `formatProduct` pour chaque résultat
- [ ] Enregistrer l'outil `add_to_cart` : appelle `client.addToCart(product_id, quantity)`, retourne `formatCart`
- [ ] Enregistrer l'outil `remove_from_cart` : appelle `client.removeFromCart(product_id)`, retourne `formatCart`
- [ ] Enregistrer l'outil `update_quantity` : appelle `client.updateQuantity(product_id, quantity)`, retourne `formatCart`
- [ ] Enregistrer l'outil `get_cart` : appelle `client.getCart()`, retourne `formatCart`
- [ ] Enregistrer l'outil `find_stores` : appelle `locator.findStores(query)`, retourne la liste formatée
- [ ] Enregistrer l'outil `set_store` : appelle `setStore(store_id)`, confirme par un message texte
- [ ] Enregistrer l'outil `get_store` : appelle `getStore()`, retourne l'id ou "Aucun drive sélectionné"
- [ ] Connecter le transport stdio : `new StdioServerTransport()` puis `server.connect(transport)`
- [ ] Vérifier que `npm run build` compile sans erreur
- [ ] Vérifier que `npm test` passe tous les tests en vert (PASS)

## Tâches — REFACTOR

- [ ] S'assurer que chaque handler retourne un message d'erreur lisible en cas d'exception (pas de stack trace brute)
- [ ] Vérifier que `npm test` passe toujours après refactor
