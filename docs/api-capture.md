# API Auchan Drive — Documentation reverse-engineerée

> Capturé le 15 juin 2026 sur `www.auchan.fr` (Drive Caluire, compte Raphaël)  
> Méthode : XHR monkey-patch + `performance.getEntriesByType('resource')` + lecture DOM

---

## Authentification

### Cookies requis

| Cookie | Type | Description |
|--------|------|-------------|
| `lark-session` | HttpOnly | Session principale — lue via `chrome-cookies-secure` |
| `datadome` | HttpOnly | Anti-bot DataDome — lue via `chrome-cookies-secure` |
| `lark-consentId` | JS-accessible | UUID consent — utilisé dans le body de `/cart/update` |

**Accès par défaut** : se connecter à Auchan Drive dans Chrome une fois.  
Le serveur lit les cookies via `chrome-cookies-secure` depuis le profil Chrome local.

**Headers requis sur toutes les requêtes :**
```
Cookie: lark-session=...; datadome=...; lark-consentId=...
X-Requested-With: XMLHttpRequest
Accept: application/json
```

**cartId** : obtenu via `GET /cart` → `response.cart.cart.id`  
**consentId** : cookie `lark-consentId` (lisible via JS / chrome-cookies-secure)

---

## Search — Recherche de produits

**Requête**
- URL : `GET https://www.auchan.fr/recherche?text=<query>`
- Méthode : GET
- Headers : `Accept: text/html`

**Important :** La recherche retourne du **HTML server-rendered** (pas de JSON).  
Les données produit sont dans le DOM via `data-*` attributes.

**Parsing HTML — sélecteurs CSS :**

```
div.quantity-selector[data-product-id]   → conteneur avec tous les IDs
  data-product-id   → UUID produit  (ex: "acfdc139-5da2-4e2c-b652-5687fa2932b1")
  data-offer-id     → UUID offre    (ex: "19f46dfd-f09f-5533-9958-a71f53c6adbb")
  data-seller-id    → UUID vendeur  (ex: "b42fbf5b-51d4-42d0-bad8-abe4e6963846")
  data-seller-type  → Type vendeur  (ex: "GROCERY")

p.product-thumbnail__description   → nom/description du produit
article strong                     → marque (premier élément)
div.product-price                  → prix (ex: "2,98€")
span (contenant "€ / kg")          → prix au kilo (ex: "11,92€ / kg")
span.product-attribute             → format/poids (ex: "250g")
a[href*="/pr-"]                    → URL produit (ex: "/produit/pr-C1264653")
```

**Code produit** : extrait du href après `/pr-` → `C1264653`  
**UUID produit** : `data-product-id` → utilisé pour les opérations panier

**Réponse** (`tests/fixtures/search-response.json`) — voir fichier fixture
```json
{
  "productId": "acfdc139-5da2-4e2c-b652-5687fa2932b1",
  "offerId": "19f46dfd-f09f-5533-9958-a71f53c6adbb",
  "sellerId": "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
  "sellerType": "GROCERY",
  "name": "Beurre tendre doux 82%MG",
  "brand": "ELLE & VIRE",
  "price": 298,
  "pricePerKg": 1192,
  "format": "250g",
  "available": true,
  "url": "/elle-vire-beurre-tendre/pr-C1234567"
}
```

**Note :** Le `sellerId` est constant par magasin (ne change pas entre produits).  
Drive Caluire : `sellerId = b42fbf5b-51d4-42d0-bad8-abe4e6963846`

---

## Cart GET — Lecture du panier

**Requête**
- URL : `GET https://www.auchan.fr/cart`
- Méthode : GET
- Headers : `Accept: application/json`, `X-Requested-With: XMLHttpRequest`

Variante acceptée : `/cart?consentId=<uuid>` (même résultat)

**Réponse 200** (`tests/fixtures/cart-get-response.json`)
```json
{
  "revisedItems": [],
  "cart": {
    "cart": {
      "id": "438e38d8-958a-4c66-93be-f4de245a9c98",
      "version": 15,
      "lastModifiedAt": "2026-06-15T14:12:51.646+02:00",
      "contentWarnings": [],
      "prices": {
        "totalPrice": { "amount": 4354, "currency": "EUR" }
      },
      "items": [
        {
          "id": "5797d20b-68cc-4484-a711-69f3b5e8893c",
          "productId": "d2b82432-fe6b-4d95-a52f-3a6a65150092",
          "offerId": "e5847037-0b45-5aa0-9f76-47b576787256",
          "desiredQuantity": 4,
          "desiredType": "DEFAULT",
          "deltaQuantity": 0,
          "createdAt": "2026-06-15T14:12:51.646+02:00",
          "offering": {
            "actualQuantity": 4,
            "maxQuantity": 14,
            "context": {
              "deliveryChannel": "PICK_UP",
              "seller": {
                "id": "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
                "name": "Drive Caluire",
                "type": "GROCERY",
                "external": false
              }
            },
            "prices": {
              "price": { "amount": 1649, "currency": "EUR" },
              "totalDiscount": { "amount": 1121, "currency": "EUR" },
              "totalLoyalty": { "amount": 0, "currency": "EUR" },
              "totalPrice": { "amount": 4354, "currency": "EUR" }
            },
            "stockDetail": {}
          }
        }
      ]
    },
    "items": [],
    "changes": [],
    "id": "438e38d8-958a-4c66-93be-f4de245a9c98",
    "version": 15
  }
}
```

**Champs clés à extraire :**
- `cart.cart.id` → `cartId` (requis dans POST /cart/update)
- `cart.cart.items[].id` → cart line ID (requis pour update/remove)
- `cart.cart.items[].productId` → UUID produit
- `cart.cart.items[].offerId` → UUID offre
- `cart.cart.items[].desiredQuantity` → quantité courante
- `cart.cart.items[].offering.context.seller.id` → sellerId
- `cart.cart.items[].offering.context.seller.type` → sellerType ("GROCERY")
- `cart.cart.items[].offering.prices.price.amount` → prix unitaire en centimes
- `cart.cart.prices.totalPrice.amount` → total panier en centimes

---

## Cart ADD — Ajout au panier

**Requête** (même endpoint que UPDATE et REMOVE)
- URL : `POST https://www.auchan.fr/cart/update`
- Méthode : POST
- Headers : `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`

**Body** (article absent du panier — pas de champ `id`) :
```json
{
  "cartId": "438e38d8-958a-4c66-93be-f4de245a9c98",
  "items": [
    {
      "productId": "acfdc139-5da2-4e2c-b652-5687fa2932b1",
      "offerId": "19f46dfd-f09f-5533-9958-a71f53c6adbb",
      "sellerType": "GROCERY",
      "desiredQuantity": 1,
      "desiredType": "DEFAULT",
      "sellerId": "b42fbf5b-51d4-42d0-bad8-abe4e6963846"
    }
  ],
  "consentId": "3ea0e513-0026-47aa-968d-ea2f46d539f6",
  "reservationId": null,
  "mbaAvailabilityNeeded": true
}
```

**Réponse 200** (`tests/fixtures/cart-add-response.json`) : même structure que GET /cart

---

## Cart UPDATE — Modification de quantité

**Requête**
- URL : `POST https://www.auchan.fr/cart/update`
- Méthode : POST
- Headers : `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`

**Body** (article existant — champ `id` obligatoire) :
```json
{
  "cartId": "438e38d8-958a-4c66-93be-f4de245a9c98",
  "items": [
    {
      "productId": "d2b82432-fe6b-4d95-a52f-3a6a65150092",
      "offerId": "e5847037-0b45-5aa0-9f76-47b576787256",
      "sellerType": "GROCERY",
      "desiredQuantity": 3,
      "desiredType": "DEFAULT",
      "sellerId": "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
      "id": "5797d20b-68cc-4484-a711-69f3b5e8893c"
    }
  ],
  "consentId": "3ea0e513-0026-47aa-968d-ea2f46d539f6",
  "reservationId": null,
  "mbaAvailabilityNeeded": true
}
```

**Réponse 200** (`tests/fixtures/cart-update-response.json`) : même structure que GET /cart

---

## Cart REMOVE — Suppression d'un article

**Requête**
- URL : `POST https://www.auchan.fr/cart/update`
- Méthode : POST
- Headers : `Accept: application/json`, `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`

**Body** (`desiredQuantity: 0` = suppression) :
```json
{
  "cartId": "438e38d8-958a-4c66-93be-f4de245a9c98",
  "items": [
    {
      "productId": "d2b82432-fe6b-4d95-a52f-3a6a65150092",
      "offerId": "e5847037-0b45-5aa0-9f76-47b576787256",
      "sellerType": "GROCERY",
      "desiredQuantity": 0,
      "desiredType": "DEFAULT",
      "sellerId": "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
      "id": "5797d20b-68cc-4484-a711-69f3b5e8893c"
    }
  ],
  "consentId": "3ea0e513-0026-47aa-968d-ea2f46d539f6",
  "reservationId": null,
  "mbaAvailabilityNeeded": true
}
```

**Réponse 200** (`tests/fixtures/cart-remove-response.json`) : panier sans l'article supprimé

---

## Sources des valeurs — Récapitulatif

| Champ | Source |
|-------|--------|
| `cartId` | `GET /cart` → `response.cart.cart.id` |
| `items[].id` | `GET /cart` → `response.cart.cart.items[].id` (absent pour ADD) |
| `items[].productId` | DOM `data-product-id` ou `GET /cart` |
| `items[].offerId` | DOM `data-offer-id` ou `GET /cart` |
| `items[].sellerId` | DOM `data-seller-id` ou `GET /cart` → `offering.context.seller.id` |
| `items[].sellerType` | DOM `data-seller-type` ou `GET /cart` → `offering.context.seller.type` |
| `consentId` | Cookie `lark-consentId` (via `chrome-cookies-secure`) |

**Pas de CSRF token requis** — l'authentification est uniquement cookie-based.

---

## Store Locator — Recherche de drives

### 4a. Autocomplétion d'adresse

**URL :** `GET /geocoding/autocomplete?query=<text>`

Retourne des suggestions d'adresses avec coordonnées GPS (lat/lng).  
Utilisé pour l'autocomplétion dans le modal "Choisir un drive".

**Réponse** : liste de suggestions avec `address.zipcode`, `address.city`, `address.country`, `location.latitude`, `location.longitude`

### 4b. Recherche de drives

**URL :** `GET /offering-contexts`

**Query params** (observés via XHR interception) :
```
address.zipcode              = "69000"
address.city                 = "Lyon"
address.country              = "FR"
location.latitude            = "45.7640"
location.longitude           = "4.8357"
accuracy                     = "1"
position                     = "1"
sellerType                   = "GROCERY"
filters.pos                  = "DRIVE"
filters.slots                = "true"
filters.validStoreReferences = (optionnel)
channels                     = "PICK_UP"
```

**Headers :**
```
Accept: application/json
X-Requested-With: XMLHttpRequest
```

**Réponse 200** (`tests/fixtures/stores-response.json`) : liste des drives disponibles avec :
- Nom, adresse, distance
- `sellerId` (UUID du vendeur = ID du drive)
- Prochains créneaux disponibles

**Note :** Cet endpoint nécessite le contexte de session complet (cookies + session initialisée via `/journey/locator/configuration`).

### 4c. Config store locator

**URL :** `GET /journey/locator/configuration`

Retourne la configuration du widget (endpoints, icons de carte, Woosmap API key).

---

## Autres endpoints observés

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/cart/config` | GET | Config widget panier |
| `/journey/locator/configuration` | GET | Config store locator |
| `/journey/search/point-of-service` | GET | Alt. recherche drives (params à confirmer) |
| `/cart-renderer/cart/loyalty-caution/config` | GET | Config fidélité |
| `/reminder/overlay` | GET | Overlay rappel panier |
| `https://api.auchan.fr/coupons/v1/events/<cartId>?api-key=dfd9f7af-...` | GET | Coupons (cross-origin CORS) |

---

## Notes DataDome

- Cookie `datadome` requis sur chaque requête
- Requêtes parallèles ou trop rapides → 403
- En cas de 403 : invalider le cache cookie, re-lire depuis Chrome, retry
- Délai minimum recommandé : **1000ms + jitter aléatoire (0–400ms)**
- Max retries : 3, backoff exponentiel (base 1500ms)
