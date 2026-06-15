# Phase 3 — Parsers et mappers (TDD)

> **Objectif** : implémenter les fonctions pures qui transforment les réponses JSON brutes de l'API Auchan en types internes (`Product`, `Cart`, `CartItem`).
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 0 terminée, Phase 1 terminée (fixtures disponibles)

---

## Tâches — Types partagés

- [ ] Créer `src/types.ts` avec l'interface `Product` (id, label, brand?, price, pricePerUnit?, available, nutriScore?)
- [ ] Ajouter l'interface `CartItem` (productId, label, quantity, unitPrice, totalPrice)
- [ ] Ajouter l'interface `Cart` (items: CartItem[], total: number, itemCount: number)

## Tâches — RED (écrire les tests d'abord)

- [ ] Créer `tests/unit/auchan/parser.test.ts`
- [ ] Importer la fixture `tests/fixtures/search-response.json`
- [ ] Importer la fixture `tests/fixtures/cart-get-response.json`
- [ ] Écrire un test : `parseSearchResults` extrait les produits depuis la fixture de recherche
- [ ] Écrire un test : `parseSearchResults` retourne `[]` si aucun résultat
- [ ] Écrire un test : `parseSearchResults` ignore les entrées sans ID produit
- [ ] Écrire un test : `mapProduct` mappe id, label, brand, price depuis un produit brut
- [ ] Écrire un test : `mapProduct` calcule `available` depuis le champ stock
- [ ] Écrire un test : `mapProduct` retourne `pricePerUnit` si présent dans la réponse
- [ ] Écrire un test : `parseCart` extrait items et total depuis la fixture panier
- [ ] Écrire un test : `parseCart` retourne un panier vide si `entries` est vide ou absent
- [ ] Écrire un test : `parseCart` calcule correctement `itemCount`
- [ ] Créer `tests/unit/formatting.test.ts`
- [ ] Écrire un test : `formatProduct` inclut label, marque, prix et id
- [ ] Écrire un test : `formatProduct` omet la marque si absente
- [ ] Écrire un test : `formatProduct` affiche "⚠️ Indisponible" si `available` est false
- [ ] Écrire un test : `formatProduct` affiche le prix/kg si `pricePerUnit` est présent
- [ ] Écrire un test : `formatCart` affiche "Panier vide." si aucun article
- [ ] Écrire un test : `formatCart` liste chaque article avec quantité et total de ligne
- [ ] Écrire un test : `formatCart` affiche le total général en bas
- [ ] Vérifier que `npm test` affiche tous ces tests en rouge (FAIL)

## Tâches — GREEN (implémenter)

- [ ] Créer `src/auchan/parser.ts` avec les fonctions `parseSearchResults`, `mapProduct`, `parseCart`
- [ ] Implémenter `parseSearchResults` en se basant sur la structure réelle de `search-response.json`
- [ ] Implémenter `mapProduct` en mappant les champs bruts vers l'interface `Product`
- [ ] Implémenter `parseCart` en se basant sur la structure réelle de `cart-get-response.json`
- [ ] Créer `src/auchan/formatter.ts` avec les fonctions `formatProduct` et `formatCart`
- [ ] Vérifier que `npm test` passe tous les tests en vert (PASS)

## Tâches — REFACTOR

- [ ] Extraire un helper `parseEuro(str)` si le prix est une chaîne à convertir en nombre
- [ ] Extraire un helper `decodeEntities(str)` si les libellés contiennent des entités HTML
- [ ] Vérifier que `npm test` passe toujours après refactor
