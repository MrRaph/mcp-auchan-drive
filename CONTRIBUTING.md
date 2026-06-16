# Guide de contribution — mcp-auchan-drive

---

## Setup développement

```bash
git clone https://github.com/MrRaph/mcp-auchan-drive.git
cd mcp-auchan-drive
npm install
npm run build   # compile src/ → dist/
npm test        # 60+ tests, doit passer en vert
```

Pour les tests, `sqlite3` et `msw` ont des scripts post-install. Si npm bloque :

```bash
npm approve-scripts sqlite3 msw tldjs
```

---

## Cycle TDD

Ce projet suit une approche **Red → Green → Refactor** stricte.

**Avant d'écrire du code** :
1. Écrire un test qui échoue décrivant le comportement attendu (**Red**)
2. Implémenter le minimum de code pour faire passer ce test (**Green**)
3. Nettoyer le code sans casser les tests (**Refactor**)

Trois niveaux de tests :

| Niveau | Répertoire | Quand l'utiliser |
|---|---|---|
| Unitaires | `tests/unit/` | Logique pure (parsers, mappers, throttler) — aucun I/O |
| Intégration | `tests/integration/` | Client HTTP avec `fetchFn` mocké (vi.fn()) |
| End-to-end | `scripts/smoke-test.mjs` | Contre le vrai site — exécuté manuellement |

Lancer les tests :

```bash
npm test                  # tous les tests
npm run test:watch        # en mode watch (développement)
npm run test:coverage     # rapport de couverture (objectif > 80%)
```

---

## Ajouter une fixture

Les fixtures sont des réponses API réelles capturées dans Chrome DevTools.

**Procédure de capture** :

1. Ouvrir [auchan.fr](https://www.auchan.fr) dans Chrome, se connecter au drive
2. Ouvrir DevTools → onglet **Réseau** → filtrer **Fetch/XHR**
3. Effectuer l'opération à capturer (recherche, ajout panier, etc.)
4. Cliquer sur la requête → **Réponse** → copier le corps JSON
5. Sauvegarder dans `tests/fixtures/<nom-descriptif>.json`

Fixtures actuelles :

| Fichier | Endpoint capturé |
|---|---|
| `cart-get-response.json` | `GET /cart` |
| `cart-add-response.json` | `POST /cart/update` (ajout) |
| `cart-update-response.json` | `POST /cart/update` (modification quantité) |
| `cart-remove-response.json` | `POST /cart/update` (suppression) |
| `stores-response.json` | `GET /offering-contexts` |
| `search-parsed-products.json` | Produits parsés depuis `GET /recherche` |

---

## Lancer le smoke test

Le smoke test s'exécute contre le vrai site Auchan Drive. Il nécessite :
- Chrome ouvert et connecté à Auchan Drive, **OU**
- La variable `AUCHAN_COOKIE` renseignée avec le header Cookie des DevTools

```bash
npm run smoke                     # drive autour de Lyon (défaut)
SMOKE_QUERY=Lille npm run smoke   # drive autour de Lille
```

Le script effectue 7 opérations dans l'ordre et affiche `✅ Étape N OK` ou `❌ Étape N FAIL` pour chaque étape. Il nettoie le panier à la fin (remove_from_cart).

---

## Mettre à jour la documentation API

Si Auchan modifie ses endpoints, mettre à jour `docs/api-capture.md` :

1. Capturer les nouvelles requêtes dans DevTools (voir section "Ajouter une fixture")
2. Identifier ce qui a changé : URL, headers, structure du body/réponse
3. Mettre à jour `docs/api-capture.md` avec les nouvelles valeurs
4. Mettre à jour les fixtures JSON correspondantes dans `tests/fixtures/`
5. Mettre à jour le code impacté dans `src/auchan/` (client, parser, locator)
6. Vérifier que `npm test` passe toujours
7. Vérifier que `npm run smoke` fonctionne contre le vrai site

---

## Structure des commits

Messages en français ou en anglais, format conventionnel :

```
feat: ajouter l'outil clear_cart
fix: corriger le parsing du prix au kilo quand absent
test: ajouter les tests d'intégration du locator
docs: mettre à jour api-capture.md après changement d'endpoint
```

---

## Anti-bot DataDome

Auchan utilise DataDome. Pour éviter les 403 :

- Ne **jamais** faire de requêtes parallèles — toutes les requêtes passent par le `Throttler`
- Le délai minimum entre requêtes est de 1000 ms + jitter aléatoire (0–400 ms)
- En cas de 403, le `Throttler` invalide le cache de cookies et retry avec backoff exponentiel
- Maximum 3 retries (configurable via `AUCHAN_MAX_RETRIES`)

Le `Throttler` est couvert par des tests unitaires dans `tests/unit/auchan/throttle.test.ts`.
