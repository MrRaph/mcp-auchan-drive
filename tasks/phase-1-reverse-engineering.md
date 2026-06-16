# Phase 1 — Reverse-engineering de l'API Auchan

> **Objectif** : capturer les réponses réelles de l'API Auchan Drive et les documenter. Ces fixtures servent de base à tous les tests des phases suivantes.
> **Durée estimée** : 1–2 jours
> **Prérequis** : un compte Auchan Drive actif, Chrome, un drive sélectionné
> **Statut** : ✅ COMPLÉTÉ (15 juin 2026, via Claude in Chrome MCP + XHR monkey-patch)

---

## Tâches — Capture réseau

- [x] Ouvrir `https://www.auchan.fr` dans Chrome et se connecter à son compte
- [x] Sélectionner un drive Auchan (mode "Drive") — Drive Caluire actif
- [x] Capturer la requête de recherche — `GET /recherche?text=<query>` (HTML server-rendered)
- [x] Documenter le parsing HTML dans `docs/api-capture.md` (sélecteurs CSS, data-attributes)
- [x] Sauvegarder les IDs parsés dans `tests/fixtures/search-parsed-products.json`
- [x] Capturer et documenter `GET /cart` → `tests/fixtures/cart-get-response.json`
- [x] Capturer et documenter `POST /cart/update` (add) — body sans champ `id`
- [x] Capturer et documenter `POST /cart/update` (update quantité) — body avec `id`
- [x] Capturer et documenter `POST /cart/update` (remove) — `desiredQuantity: 0`
- [x] Sauvegarder le body type dans `tests/fixtures/cart-update-request.json`

## Tâches — Store locator

- [x] Identifier l'endpoint d'autocomplétion : `GET /geocoding/autocomplete?query=<text>`
- [x] Identifier l'endpoint de liste des drives : `GET /offering-contexts` (params documentés)
- [x] Sauvegarder les params dans `tests/fixtures/offering-contexts-params.json`
- [x] Documenter dans `docs/api-capture.md`
- [ ] ⚠️ Capturer une vraie réponse JSON de `/offering-contexts` (endpoint accessible uniquement via XHR natif de la page — à documenter ultérieurement)

## Tâches — Authentification

- [x] Confirmer : pas de token Bearer — auth uniquement cookie-based
- [x] Identifier les cookies requis : `lark-session` (HttpOnly), `datadome` (HttpOnly), `lark-consentId` (accessible JS)
- [x] Documenter le `consentId` : cookie `lark-consentId`, utilisé dans le body de `/cart/update`
- [x] Documenter le `cartId` : obtenu via `GET /cart` → `response.cart.cart.id`
- [x] Confirmer : pas de CSRF token requis dans les headers

## Tâches — Identification des IDs produit

- [x] Deux formats d'ID documentés :
  - **Code catalogue** : `C1264653` (dans l'URL du produit, après `/pr-`)
  - **UUID produit** : `d2b82432-fe6b-4d95-a52f-3a6a65150092` (dans DOM `data-product-id` et dans les requêtes panier)
- [x] L'UUID (pas le code catalogue) est utilisé dans les mutations panier
- [x] `offerId` (UUID) également requis pour les mutations : `e5847037-0b45-5aa0-9f76-47b576787256`
- [x] `sellerId` (UUID) = ID du magasin drive, constant par store
- [x] Documenter dans `docs/api-capture.md`

---

## Résumé des endpoints découverts

| Endpoint | Méthode | Usage |
|----------|---------|-------|
| `/recherche?text=<q>` | GET | Recherche produits (HTML) |
| `/cart` | GET | Lire le panier |
| `/cart/update` | POST | Add / Update quantité / Remove |
| `/geocoding/autocomplete?query=<t>` | GET | Autocomplétion adresse |
| `/offering-contexts` | GET | Liste des drives par localisation |
| `/journey/locator/configuration` | GET | Config store locator |
