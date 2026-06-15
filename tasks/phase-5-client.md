# Phase 5 — AuchanClient (TDD)

> **Objectif** : implémenter `src/auchan/client.ts`, le client HTTP qui appelle l'API Auchan Drive. Toutes les requêtes passent par le Throttler. Les tests mockent le réseau avec MSW.
> **Durée estimée** : 1 journée
> **Prérequis** : Phase 1 (fixtures), Phase 2 (Throttler), Phase 3 (parsers), Phase 4 (CookieProvider)

---

## Tâches — Configuration MSW

- [ ] Créer `tests/integration/client.test.ts`
- [ ] Importer `setupServer` depuis `msw/node`
- [ ] Configurer un handler MSW pour la route de recherche (`GET .../products/search`) → retourne `search-response.json`
- [ ] Configurer un handler MSW pour la route de lecture du panier (`GET .../carts/...`) → retourne `cart-get-response.json`
- [ ] Configurer un handler MSW pour la route d'ajout au panier (`POST .../carts/.../entries`) → retourne `cart-add-response.json`
- [ ] Configurer un handler MSW pour la route de mise à jour quantité (`PATCH .../carts/.../entries/...`) → retourne `cart-update-response.json`
- [ ] Configurer un handler MSW pour la route de suppression (`DELETE .../carts/.../entries/...`) → retourne `cart-remove-response.json`
- [ ] Ajouter `beforeAll(() => server.listen())`, `afterEach(() => server.resetHandlers())`, `afterAll(() => server.close())`

## Tâches — RED `searchProducts`

- [ ] Écrire un test : retourne les produits mappés depuis la fixture de recherche
- [ ] Écrire un test : retourne `[]` si la réponse contient zéro résultat
- [ ] Écrire un test : lève une erreur avec message actionnable sur 401
- [ ] Écrire un test : invalide le cache cookie et retry sur 403 (DataDome)
- [ ] Écrire un test : lève une erreur après `maxRetries` tentatives consécutives sur 403

## Tâches — RED `addToCart`

- [ ] Écrire un test : envoie le bon body avec `productId` et `quantity`
- [ ] Écrire un test : retourne le panier mis à jour (Cart)
- [ ] Écrire un test : retry sur 429

## Tâches — RED `removeFromCart`

- [ ] Écrire un test : envoie la bonne requête DELETE avec l'`entryNumber` correct
- [ ] Écrire un test : retourne le panier mis à jour

## Tâches — RED `updateQuantity`

- [ ] Écrire un test : met à jour la quantité via PATCH
- [ ] Écrire un test : appelle `removeFromCart` si `quantity === 0`

## Tâches — RED `getCart`

- [ ] Écrire un test : retourne le panier complet avec total
- [ ] Écrire un test : retourne un panier vide si aucun article

## Tâches — Vérification RED

- [ ] Vérifier que `npm test` affiche tous ces tests en rouge (FAIL)

## Tâches — GREEN (implémenter)

- [ ] Créer `src/auchan/client.ts` avec la classe `AuchanClient`
- [ ] Injecter `CookieProvider` et `Throttler` dans le constructeur
- [ ] Implémenter `searchProducts(query: string): Promise<Product[]>`
- [ ] Implémenter `getCart(): Promise<Cart>`
- [ ] Implémenter `addToCart(productId: string, quantity: number): Promise<Cart>`
- [ ] Implémenter `removeFromCart(productId: string): Promise<Cart>` (trouver l'`entryNumber` depuis le panier courant)
- [ ] Implémenter `updateQuantity(productId: string, quantity: number): Promise<Cart>`
- [ ] Vérifier que `npm test` passe tous les tests en vert (PASS)

## Tâches — REFACTOR

- [ ] Extraire une fonction `buildHeaders()` qui assemble les headers avec le cookie et le token Bearer si présent
- [ ] Extraire une fonction `buildUrl(path: string)` qui assemble les URLs à partir du `baseSiteId` et du `storeId`
- [ ] Typer les erreurs avec une classe `AuchanError` (status, message)
- [ ] Vérifier que `npm test` passe toujours après refactor
