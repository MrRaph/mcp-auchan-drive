# Phase 6 — StoreLocator (TDD)

> **Objectif** : implémenter `src/auchan/locator.ts`, qui interroge l'API Woosmap Auchan pour trouver les drives proches d'une ville ou d'un code postal.
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 1 (fixture `stores-response.json`), Phase 2 (Throttler)

---

## Tâches — RED (écrire les tests d'abord)

- [ ] Créer `tests/integration/locator.test.ts`
- [ ] Configurer un handler MSW pour la route du store locator → retourne `stores-response.json`
- [ ] Écrire un test : retourne les drives proches triés par distance
- [ ] Écrire un test : retourne `[]` si aucun drive trouvé dans la réponse
- [ ] Écrire un test : mappe correctement les champs `id`, `name`, `address`, `distance`, `type`
- [ ] Écrire un test : lève une erreur explicite si le paramètre `query` est vide
- [ ] Vérifier que `npm test` affiche tous ces tests en rouge (FAIL)

## Tâches — GREEN (implémenter)

- [ ] Créer `src/auchan/locator.ts` avec la classe ou fonction `StoreLocator`
- [ ] Implémenter `findStores(query: string): Promise<Store[]>` (interface `Store` : id, name, address, distance?, type)
- [ ] Ajouter l'interface `Store` dans `src/types.ts`
- [ ] Construire l'URL vers l'API Woosmap Auchan (se baser sur la capture de `docs/api-capture.md`)
- [ ] Parser la réponse avec une fonction `parseStores(raw: unknown): Store[]`
- [ ] Vérifier que `npm test` passe tous les tests en vert (PASS)

## Tâches — REFACTOR

- [ ] Extraire la constante d'URL de l'API Woosmap dans `src/config.ts`
- [ ] Vérifier que `npm test` passe toujours après refactor
