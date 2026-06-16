# Phase 0 — Scaffold + infrastructure de test

> **Objectif** : dépôt TypeScript qui compile, avec le test runner Vitest opérationnel.
> **Durée estimée** : ½ journée
> **Prérequis** : Node.js ≥ 18, npm

---

## Tâches

- [x] Créer le fichier `package.json` avec `"type": "module"`, scripts `build`, `dev`, `typecheck`, `inspect`, `test`, `test:watch`, `test:coverage`, `smoke`
- [ ] Installer les dépendances runtime : `npm install @modelcontextprotocol/sdk zod chrome-cookies-secure`
- [ ] Installer les dépendances dev : `npm install -D typescript @types/node vitest @vitest/coverage-v8 msw`
- [x] Créer le fichier `tsconfig.json` (target ES2022, module NodeNext, strict true, outDir dist)
- [x] Créer le fichier `.gitignore` (node_modules, dist, .env, *.lock sauf package-lock.json)
- [x] Créer le fichier `vitest.config.ts` avec environment node et coverage v8 sur `src/**`
- [x] Créer le dossier `src/` vide
- [x] Créer le dossier `src/auth/` vide
- [x] Créer le dossier `src/auchan/` vide
- [x] Créer le dossier `docs/` vide
- [x] Créer le dossier `scripts/` vide
- [x] Créer le dossier `tests/unit/auchan/` vide
- [x] Créer le dossier `tests/unit/auth/` vide
- [x] Créer le dossier `tests/integration/` vide
- [x] Créer le dossier `tests/fixtures/` vide
- [x] Créer `docs/api-capture.md` avec les titres des sections à remplir (search, cart, add, update, remove, stores)
- [x] Vérifier que `npm run build` s'exécute sans erreur (le dossier `src/` est vide, aucun fichier à compiler — c'est normal)
- [x] Vérifier que `npm test` s'exécute sans erreur et affiche "0 tests"
