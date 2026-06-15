# Phase 9 — Documentation et publication

> **Objectif** : finaliser la documentation pour les utilisateurs et les contributeurs, vérifier la couverture de tests, et publier optionnellement le package.
> **Durée estimée** : ½ journée
> **Prérequis** : Phase 8 terminée et validée

---

## Tâches — README.md

- [ ] Vérifier que `README.md` décrit correctement les prérequis (Node.js ≥ 18, Chrome connecté)
- [ ] Vérifier que la section "Installation" est à jour avec les commandes exactes
- [ ] Vérifier que la section "Outils MCP exposés" liste les 8 outils avec leurs paramètres réels
- [ ] Ajouter un exemple de requête en langage naturel dans Claude Desktop
- [ ] Ajouter un exemple de résultat de `search_product` (extrait de la fixture ou d'un vrai run)

## Tâches — CONTRIBUTING.md

- [ ] Créer `CONTRIBUTING.md`
- [ ] Documenter le setup dev en 5 commandes (clone, npm install, build, test, smoke)
- [ ] Documenter le cycle TDD (Red → Green → Refactor) appliqué à ce projet
- [ ] Documenter comment ajouter une fixture (capturer dans Chrome DevTools, sauvegarder dans `tests/fixtures/`)
- [ ] Documenter comment lancer le smoke test et ce qu'il vérifie
- [ ] Documenter comment mettre à jour `docs/api-capture.md` si Auchan change ses endpoints

## Tâches — Couverture de tests

- [ ] Exécuter `npm run test:coverage`
- [ ] Vérifier que la couverture globale de `src/` est ≥ 80 %
- [ ] Identifier les fichiers sous le seuil et écrire les tests manquants

## Tâches — Publication (optionnel)

- [ ] Ajouter les champs `"name"`, `"version"`, `"description"`, `"main"`, `"bin"` dans `package.json`
- [ ] Ajouter `"files": ["dist/"]` pour n'inclure que le build dans le package npm
- [ ] Exécuter `npm publish --dry-run` pour vérifier ce qui sera publié
- [ ] Si OK : `npm publish` (compte npm requis)
- [ ] Soumettre le MCP au registre officiel MCP (si un formulaire de soumission est disponible)
