# Phase 4 — CookieProvider (TDD)

> **Objectif** : implémenter `src/auth/cookies.ts`, qui fournit le header `Cookie` soit depuis la variable d'env `AUCHAN_COOKIE`, soit depuis la session Chrome locale via `chrome-cookies-secure`.
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 0 terminée

---

## Tâches — RED (écrire les tests d'abord)

- [ ] Créer `tests/unit/auth/cookies.test.ts`
- [ ] Mocker le module `chrome-cookies-secure` avec `vi.mock('chrome-cookies-secure', ...)`
- [ ] Écrire un test (mode env) : retourne le cookie fixe configuré via `AUCHAN_COOKIE`
- [ ] Écrire un test (mode env) : `invalidate()` ne fait rien (no-op)
- [ ] Écrire un test (mode Chrome) : lit les cookies Chrome et les met en cache mémoire
- [ ] Écrire un test (mode Chrome) : ne re-lit pas Chrome si le cache a moins de 60 secondes
- [ ] Écrire un test (mode Chrome) : re-lit Chrome après un appel à `invalidate()`
- [ ] Écrire un test (mode Chrome) : lève une erreur lisible si `chrome-cookies-secure` retourne un cookie vide
- [ ] Écrire un test (mode Chrome) : lève une erreur lisible si `chrome-cookies-secure` lève une exception
- [ ] Vérifier que `npm test` affiche tous ces tests en rouge (FAIL)

## Tâches — GREEN (implémenter)

- [ ] Créer `src/auth/cookies.ts`
- [ ] Implémenter l'interface `CookieProvider` avec les méthodes `getCookie(): Promise<string>` et `invalidate(): void`
- [ ] Implémenter `createCookieProvider()` : si `process.env.AUCHAN_COOKIE` est défini, retourner un provider "env" (statique)
- [ ] Implémenter le provider "Chrome" : appeler `chrome-cookies-secure` sur le domaine `.auchan.fr` avec le profil `AUCHAN_CHROME_PROFILE` (défaut `"Default"`)
- [ ] Implémenter le cache mémoire (TTL 60 secondes)
- [ ] Implémenter `invalidate()` : vider le cache pour forcer une re-lecture
- [ ] Vérifier que `npm test` passe tous les tests en vert (PASS)

## Tâches — REFACTOR

- [ ] Extraire la constante `CACHE_TTL_MS = 60_000`
- [ ] Typer l'interface `CookieProvider` dans `src/types.ts`
- [ ] Vérifier que `npm test` passe toujours après refactor
