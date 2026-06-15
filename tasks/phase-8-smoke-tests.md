# Phase 8 — Tests end-to-end (smoke)

> **Objectif** : valider le fonctionnement complet du MCP contre le vrai site Auchan Drive, avec un vrai compte.
> **Durée estimée** : 1 journée
> **Prérequis** : Phase 7 terminée, un compte Auchan Drive actif, Chrome ouvert et connecté
> ⚠️ Ces tests s'exécutent **manuellement** — ils ne font pas partie de la CI.

---

## Tâches — Rédiger le script smoke

- [ ] Créer `scripts/smoke-test.mjs`
- [ ] Importer le serveur MCP compilé depuis `../dist/index.js` ou appeler les fonctions directement
- [ ] Étape 1 : appeler `find_stores("votre ville")` → vérifier qu'au moins 1 drive est retourné, afficher le premier résultat
- [ ] Étape 2 : appeler `set_store(<id du premier drive>)` → vérifier le message de confirmation
- [ ] Étape 3 : appeler `search_product("café")` → vérifier que ≥ 1 produit est retourné, stocker `products[0].id`
- [ ] Étape 4 : appeler `add_to_cart(<id>, 2)` → vérifier que le panier contient 2 unités
- [ ] Étape 5 : appeler `get_cart()` → vérifier que `total > 0` et `itemCount >= 1`
- [ ] Étape 6 : appeler `update_quantity(<id>, 1)` → vérifier que la quantité est bien passée à 1
- [ ] Étape 7 : appeler `remove_from_cart(<id>)` → vérifier que le panier est vide
- [ ] Chaque étape doit afficher un log clair : `✅ Étape N OK` ou `❌ Étape N FAIL : <message>`
- [ ] Ajouter le script `"smoke": "node scripts/smoke-test.mjs"` dans `package.json`

## Tâches — Validation manuelle (checklist)

- [ ] Exécuter `npm run smoke` : toutes les étapes passent du début à la fin sur un compte réel
- [ ] Faire 5 appels `search_product` en séquence rapide → aucun 403 DataDome déclenché
- [ ] Appeler `invalidate()` sur le `CookieProvider` puis refaire une requête → le cookie est bien re-lu depuis Chrome
- [ ] Exécuter `npm run inspect` → vérifier que les 8 outils sont visibles dans le MCP Inspector avec leurs paramètres corrects
- [ ] Configurer le MCP dans Claude Desktop (voir `CLAUDE.md`) et faire une requête en langage naturel : "Cherche du café sur Auchan Drive"
- [ ] Vérifier que Claude retourne des résultats cohérents avec le catalogue réel
