# Phase 2 — Throttler (TDD)

> **Objectif** : implémenter `src/auchan/throttle.ts`, qui sérialise les requêtes HTTP et gère les retries avec backoff pour éviter les blocages DataDome.
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 0 terminée (Vitest opérationnel)

---

## Tâches — RED (écrire les tests d'abord)

- [ ] Créer le fichier `tests/unit/auchan/throttle.test.ts`
- [ ] Écrire un test : "exécute une tâche et retourne son résultat"
- [ ] Écrire un test : "attend au moins `minIntervalMs` entre deux appels successifs"
- [ ] Écrire un test : "ajoute un jitter aléatoire entre 0 et `jitterMs`"
- [ ] Écrire un test : "retry sur une erreur 403 avec backoff exponentiel"
- [ ] Écrire un test : "retry sur une erreur 429 avec backoff exponentiel"
- [ ] Écrire un test : "lève une erreur après `maxRetries` tentatives"
- [ ] Écrire un test : "ne retente pas sur une erreur 400"
- [ ] Écrire un test : "ne retente pas sur une erreur 500"
- [ ] Écrire un test : "sérialise les appels (le 2e appel attend la fin du 1er)"
- [ ] Vérifier que `npm test` affiche tous ces tests en rouge (FAIL)

## Tâches — GREEN (implémenter)

- [ ] Créer le fichier `src/auchan/throttle.ts`
- [ ] Implémenter la classe ou fonction `Throttler` avec les options : `minIntervalMs`, `jitterMs`, `maxRetries`, `backoffBaseMs`
- [ ] Implémenter la file d'attente (queue) pour sérialiser les requêtes
- [ ] Implémenter la logique de délai (`sleep` + jitter aléatoire)
- [ ] Implémenter la détection des erreurs retryables (403, 429)
- [ ] Implémenter le backoff exponentiel : `backoffBaseMs * 2^tentative`
- [ ] Vérifier que `npm test` passe tous les tests en vert (PASS)

## Tâches — REFACTOR

- [ ] Extraire les constantes par défaut en haut du fichier
- [ ] Typer explicitement les options avec une interface `ThrottlerOptions`
- [ ] Supprimer tout code mort ou commentaires temporaires
- [ ] Vérifier que `npm test` passe toujours après refactor
