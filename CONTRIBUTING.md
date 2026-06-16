# Guide de contribution — mcp-auchan-drive

---

## Setup développement

```bash
git clone https://github.com/MrRaph/mcp-auchan-drive.git
cd mcp-auchan-drive
npm install
npm run build       # compile TypeScript → dist/
npm run dev         # watch mode
npm run typecheck   # vérification sans emit
```

Lancer les tests :

```bash
npm test                 # tous les tests (unit + integration)
npm run test:coverage    # couverture (seuils : stmt 80%, branch 64%, fn 80%, lines 80%)
```

---

## Lancer le smoke test (E2E réel)

Le smoke test appelle le vrai site Auchan Drive. Il requiert une session active.

```bash
# Firefox (recommandé sur macOS sans Chrome)
AUCHAN_BROWSER=firefox npm run smoke

# Chrome
npm run smoke

# Avec un drive connu pour sauter l'étape find_stores
AUCHAN_STORE_ID=8dede798-9649-4481-acea-486d00396e73 AUCHAN_BROWSER=firefox npm run smoke

# Avec une autre ville de recherche
SMOKE_QUERY=Bordeaux AUCHAN_BROWSER=firefox npm run smoke
```

Le smoke test couvre 7 étapes : find_stores → set_store → search_product →
add_to_cart → get_cart → update_quantity → remove_from_cart.
Il se nettoie lui-même (supprime ce qu'il ajoute).

---

## Structure des tests

```
tests/
  unit/
    store.test.ts               # StoreManager (persistance JSON)
    auth/
      firefox-cookies.test.ts   # FirefoxCookieProvider (SQLite réel en /tmp)
  integration/
    client.test.ts              # AuchanClient (fetch mocké)
    locator.test.ts             # StoreLocator (fetch mocké)
  fixtures/
    cart-get-response.json      # Réponse réelle GET /cart
    cart-add-response.json      # Réponse réelle POST /cart/update (ajout)
    cart-update-response.json   # Réponse réelle POST /cart/update (modif)
    cart-remove-response.json   # Réponse réelle POST /cart/update (suppression)
    stores-response.json        # Ancienne fixture JSON (conservée pour référence)
```

Les tests d'intégration utilisent `vi.fn()` pour mocker `fetch`. Injecter le fetch mocké
via le dernier paramètre des constructeurs (`new AuchanClient(cookies, throttler, baseUrl, fetchFn)`).

---

## Ajouter un nouvel endpoint

### 1. Capturer la requête dans Firefox

1. Ouvrir `www.auchan.fr` dans Firefox → se connecter
2. F12 → Réseau → filtrer **XHR** ou **Fetch**
3. Effectuer l'action dans l'interface (ex: cliquer "Choisir un drive")
4. Clic droit sur la requête → **Copier → Copier en tant que cURL**
5. Tester le cURL pour confirmer qu'il fonctionne
6. Identifier les headers indispensables (tester en les retirant un par un)

### 2. Identifier les headers critiques

Pour `/offering-contexts`, deux headers non évidents étaient requis. Méthode de débogage :

```bash
# Tester l'endpoint avec les cookies Firefox
AUCHAN_BROWSER=firefox node --input-type=module << 'EOF'
import { createCookieProvider } from './dist/auth/cookies.js';
const cookie = await createCookieProvider().getCookie().catch(() => '');
const r = await fetch('https://www.auchan.fr/mon-endpoint?params=...', {
  headers: {
    Cookie: cookie,
    'Accept': 'application/crest',           // ← à tester
    'X-Crest-Renderer': 'journey-renderer',  // ← à tester
    'X-Requested-With': 'XMLHttpRequest',
  }
});
console.log(r.status, await r.text().then(t => t.slice(0, 200)));
EOF
```

### 3. Parser la réponse

Si la réponse est du **HTML CREST** (fragment) : utiliser des regex sur les `data-*` attributes
et les classes CSS. Voir `src/auchan/parser.ts` et `src/auchan/locator.ts` pour des exemples.

Si la réponse est du **JSON** : typer la structure avec des interfaces TypeScript dans le fichier
correspondant. Voir `src/auchan/client.ts`.

### 4. Documenter l'endpoint

Ajouter une section dans `docs/api-capture.md` avec :
- URL complète et paramètres
- Headers requis (et effet de leur absence)
- Exemple de requête et de réponse
- Structure des données extraites
- Quirks ou comportements inattendus

### 5. Écrire les tests

- Ajouter une fixture dans `tests/fixtures/` (réponse réelle ou construite)
- Ajouter les cas de test dans `tests/integration/`
- Vérifier que la couverture reste au-dessus des seuils

---

## Capturer un cookie de session

### Depuis Firefox (automatique)

Le serveur lit `cookies.sqlite` du profil actif. Pour vérifier les cookies disponibles :

```bash
AUCHAN_BROWSER=firefox node --input-type=module << 'EOF'
import { createCookieProvider } from './dist/auth/cookies.js';
const cookie = await createCookieProvider().getCookie();
console.log('Cookies présents :', cookie.split(';').map(c => c.trim().split('=')[0]));
EOF
```

### Pour le mode headless / CI

1. Dans Firefox : F12 → Réseau → n'importe quelle requête vers `www.auchan.fr`
2. Chercher le header **Cookie** dans les headers de requête
3. Copier la valeur entière → `AUCHAN_COOKIE="connect.sid=...; lark-session=...; ..."`

---

## DataDome — Notes importantes

DataDome est le système anti-bot d'Auchan. En développement :

- **Ne pas faire de requêtes en parallèle** — déclenche immédiatement un 403
- **Respecter le Throttler** — toujours passer par `this.throttler.run(async () => {...})`
- Le cookie `datadome` s'obtient automatiquement en naviguant sur `www.auchan.fr`
  dans Firefox (le JS DataDome s'exécute et set le cookie)
- En cas de 403 : appeler `cookieProvider.invalidate()` avant retry (force une relecture)
- Comparer les headers exacts avec ceux du DevTools Firefox pour déboguer

---

## Framework CREST

Auchan utilise un framework propriétaire appelé **CREST** pour les fragments HTML des
composants AJAX. Signes d'un endpoint CREST :

- Header requis : `Accept: application/crest` (pas `application/json`)
- Sans ce header : la même URL retourne une page HTML complète ou une erreur Express
- Header `X-Crest-Renderer` : identifie le renderer responsable (ex: `journey-renderer`)
- La réponse est toujours du **HTML** (pas du JSON), même pour des données structurées

Solution : parser le HTML retourné avec des regex sur les `data-*` attributes et classes CSS.

---

## Publier sur npm

```bash
npm run build        # compiler
npm test             # vérifier que tout passe
npm publish --dry-run  # prévisualiser
npm publish          # publier (requiert npm login)
```

Le script `prepublishOnly` lance automatiquement build + test avant publication.
