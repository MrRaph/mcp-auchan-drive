# Phase 1 — Reverse-engineering de l'API Auchan

> **Objectif** : capturer les réponses réelles de l'API Auchan Drive et les documenter. Ces fixtures servent de base à tous les tests des phases suivantes.
> **Durée estimée** : 1–2 jours
> **Prérequis** : un compte Auchan Drive actif, Chrome, un drive sélectionné

---

## Tâches — Capture réseau

- [ ] Ouvrir `https://www.auchan.fr` dans Chrome et se connecter à son compte
- [ ] Sélectionner un drive Auchan (mode "Drive")
- [ ] Ouvrir les DevTools Chrome → onglet "Réseau" → filtre "Fetch/XHR"
- [ ] Vider l'historique réseau (bouton 🚫)
- [ ] Taper "café" dans la barre de recherche et valider
- [ ] Sauvegarder la réponse JSON de la requête de recherche dans `tests/fixtures/search-response.json`
- [ ] Documenter dans `docs/api-capture.md` : URL exacte, méthode, headers de la requête, corps de la réponse (structure)
- [ ] Ouvrir le panier (icône panier en haut à droite)
- [ ] Sauvegarder la réponse JSON de la requête de lecture du panier dans `tests/fixtures/cart-get-response.json`
- [ ] Documenter dans `docs/api-capture.md` : URL exacte, méthode, headers, structure de la réponse
- [ ] Ajouter le premier produit de la recherche au panier
- [ ] Sauvegarder la réponse JSON de la requête d'ajout dans `tests/fixtures/cart-add-response.json`
- [ ] Documenter dans `docs/api-capture.md` : URL, méthode, body de la requête, structure de la réponse
- [ ] Modifier la quantité du produit ajouté (passer de 1 à 2)
- [ ] Sauvegarder la réponse JSON dans `tests/fixtures/cart-update-response.json`
- [ ] Documenter dans `docs/api-capture.md`
- [ ] Supprimer le produit du panier
- [ ] Sauvegarder la réponse JSON dans `tests/fixtures/cart-remove-response.json`
- [ ] Documenter dans `docs/api-capture.md`

## Tâches — Store locator

- [ ] Dans les DevTools, rechercher les requêtes vers `woosmap` ou `stores` lors du chargement de la page de sélection de drive
- [ ] Sauvegarder la réponse JSON dans `tests/fixtures/stores-response.json`
- [ ] Documenter dans `docs/api-capture.md`

## Tâches — Authentification

- [ ] Identifier si un token `Authorization: Bearer ...` est présent dans les headers des requêtes XHR
- [ ] Si oui : noter la forme du token (JWT ?) et comment l'obtenir (cookie ? localStorage ?)
- [ ] Identifier le nom exact du cookie `datadome` dans l'onglet Application → Cookies → `auchan.fr`
- [ ] Noter tous les cookies présents sur le domaine `.auchan.fr` dans `docs/api-capture.md`
- [ ] Identifier le `cartId` utilisé dans les URLs des requêtes panier et documenter comment il est obtenu initialement

## Tâches — Identification des IDs produit

- [ ] Dans la réponse `search-response.json`, identifier le champ utilisé comme identifiant produit pour les mutations panier
- [ ] Vérifier si l'ID dans l'URL du produit (ex. `C1350678`) est le même que celui envoyé dans le body d'`add_to_cart`
- [ ] Documenter les deux formats d'ID (code catalogue vs UUID) dans `docs/api-capture.md`
