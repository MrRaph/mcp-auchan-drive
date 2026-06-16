# Phase 2 — Throttler (TDD)

> **Objectif** : implémenter `src/auchan/throttle.ts`, qui sérialise les requêtes HTTP et gère les retries avec backoff pour éviter les blocages DataDome.
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 0 terminée (Vitest opérationnel)

---

## Tâches — RED (écrire les tests d'abord)

- [x] Créer le fichier `tests/unit/auchan/throttle.test.ts`
- [x] Écrire un test : "exécute une tâche et retourne son résultat"
- [x] Écrire un test : "attend au moins `minIntervalMs` entre deux appels successifs"
- [x] Écrire un test : "ajoute un jitter aléatoire entre 0 et `jitterMs`"
- [x] Écrire un test : "retry sur une erreur 403 avec backoff exponentiel"
- [x] Écrire un test : "retry sur une erreur 429 avec backoff exponentiel"
- [x] Écrire un test : "lève une erreur après `maxRetries` tentatives"
- [x] Écrire un test : "ne retente pas sur une erreur 400"
- [x] Écrire un test : "ne retente pas sur une erreur 500"
- [x] Écrire un test : "sérialise les appels (le 2e appel attend la fin du 1er)"
- [x] Vérifier que les tests tournent (via runner natif Node.js — vitest 4.x incompatible Linux sandbox)

## Tâches — GREEN (implémenter)

- [x] Créer le fichier `src/auchan/throttle.ts`
- [x] Implémenter la classe ou fonction `Throttler` avec les options : `minIntervalMs`, `jitterMs`, `maxRetries`, `backoffBaseMs`
- [x] Implémenter la file d'attente (queue) pour sérialiser les requêtes
- [x] Implémenter la logique de délai (`sleep` + jitter aléatoire)
- [x] Implémenter la détection des erreurs retryables (403, 429)
- [x] Implémenter le backoff exponentiel : `backoffBaseMs * 2^tentative`
- [x] 9/9 tests passent en vert ✓

## Tâches — REFACTOR

- [x] Extraire les constantes par défaut en haut du fichier
- [x] Typer explicitement les options avec une interface `ThrottlerOptions`
- [x] Supprimer tout code mort ou commentaires temporaires
- [x] TypeScript clean (tsc --noEmit sans erreurs)

> ✅ COMPLÉTÉ (15 juin 2026) — 9/9 tests verts, implémentation propre
