# Phase 0 — Scaffold + infrastructure de test

> **Objectif** : dépôt TypeScript qui compile, avec le test runner Vitest opérationnel.
> **Durée estimée** : ½ journée
> **Prérequis** : Node.js ≥ 18, npm

---

## Tâches

- [ ] Créer le fichier `package.json` avec `"type": "module"`, scripts `build`, `dev`, `typecheck`, `inspect`, `test`, `test:watch`, `test:coverage`, `smoke`
- [ ] Installer les dépendances runtime : `npm install @modelcontextprotocol/sdk zod chrome-cookies-secure`
- [ ] Installer les dépendances dev : `npm install -D typescript @types/node vitest @vitest/coverage-v8 msw`
- [ ] Créer le fichier `tsconfig.json` (target ES2022, module NodeNext, strict true, outDir dist)
- [ ] Créer le fichier `.gitignore` (node_modules, dist, .env, *.lock sauf package-lock.json)
- [ ] Créer le fichier `vitest.config.ts` avec environment node et coverage v8 sur `src/**`
- [ ] Créer le dossier `src/` vide
- [ ] Créer le dossier `src/auth/` vide
- [ ] Créer le dossier `src/auchan/` vide
- [ ] Créer le dossier `docs/` vide
- [ ] Créer le dossier `scripts/` vide
- [ ] Créer le dossier `tests/unit/auchan/` vide
- [ ] Créer le dossier `tests/unit/auth/` vide
- [ ] Créer le dossier `tests/integration/` vide
- [ ] Créer le dossier `tests/fixtures/` vide
- [ ] Créer `docs/api-capture.md` avec les titres des sections à remplir (search, cart, add, update, remove, stores)
- [ ] Vérifier que `npm run build` s'exécute sans erreur (le dossier `src/` est vide, aucun fichier à compiler — c'est normal)
- [ ] Vérifier que `npm test` s'exécute sans erreur et affiche "0 tests"
