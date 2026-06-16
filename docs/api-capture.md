# API Auchan Drive — Documentation reverse-engineerée

> Capturé en juin 2026 sur `www.auchan.fr` (Drive Caluire, compte personnel)  
> Méthode : capture réseau Firefox DevTools + monkey-patch `fetch` en Node.js + analyse DOM  
> Tout est confirmé fonctionnel et couvert par des tests d'intégration + smoke test E2E.

---

## Architecture

Auchan Drive est une **SPA Hybris/Spartacus** (SAP Commerce Cloud) rendue côté serveur via un
framework propriétaire appelé **CREST** (Composant Rendu côté Serveur Auchan).

```
Browser / MCP client
  │
  ▼
www.auchan.fr  ←── SAP Hybris OCC backend
  │                 (Spring Boot, réponses JSON ou HTML CREST)
  ├── /recherche          HTML server-rendered (produits)
  ├── /cart               JSON (état du panier)
  ├── /cart/update        JSON (mutations panier)
  └── /offering-contexts  HTML CREST (drives disponibles)

api.auchan.fr  ←── API gateway (nécessite un token Bearer, non utilisé ici)
  └── /journey/search/point-of-service   401 sans Bearer token

api-adresse.data.gouv.fr  ←── Géocodage officiel FR (public, sans clé)
```

Le framework CREST permet de servir des **fragments HTML** pour les composants AJAX :
quand `Accept: application/crest` est envoyé, le serveur retourne un fragment HTML plutôt
qu'une page complète. Sans ce header, la même URL retourne une page vide (Express 404-like).

---

## Authentification

### Session (cookies)

La session Auchan Drive est entièrement cookie-based. Aucun token CSRF ni Authorization header
n'est nécessaire pour les endpoints utilisés.

| Cookie | Requis | Accessible | Description |
|--------|--------|------------|-------------|
| `lark-session` | **Oui** | HttpOnly | Session principale Lark (serveur Express) |
| `lark-consentId` | **Oui** | JS + HttpOnly | UUID consentement — utilisé dans le body `/cart/update` |
| `connect.sid` | **Oui** | HttpOnly | Session Express (panier serveur-side) |
| `datadome` | Recommandé | HttpOnly | Anti-bot DataDome — absence tolérée mais risque 403 |
| `lark-browser-uuid` | Non | JS | Tracking navigateur (peut être omis) |
| `lark-consent` | Non | JS | Flag numérique consentement |
| `OptanonConsent` | Non | JS | Cookies OneTrust (peut être omis) |
| `GCLB` | Non | JS | Google Cloud Load Balancer sticky session |

**Règle importante** : envoyer **tous** les cookies `www.auchan.fr` et `.auchan.fr`.
N'en sélectionner qu'un sous-ensemble (même les "requis") peut causer des erreurs aléatoires
car le serveur Express reconstruit l'état depuis `connect.sid`.

### Obtention des cookies

**Via Firefox (recommandé)** : se connecter sur `www.auchan.fr`, laisser la page charger
complètement (DataDome JS s'exécute et set le cookie `datadome`). Lire `cookies.sqlite`
depuis le profil actif (`profiles.ini` → section `[Install...]` → `Default=`).

**Via Chrome** : `chrome-cookies-secure` lit le profil Chrome directement.

**Headless / CI** : copier le header Cookie complet depuis les DevTools → `AUCHAN_COOKIE`.

### Headers communs

Tous les endpoints Auchan Drive requièrent :

```http
Cookie: connect.sid=...; lark-session=...; lark-consentId=...; datadome=...
X-Requested-With: XMLHttpRequest
User-Agent: Mozilla/5.0 (...)
```

---

## GET /recherche — Recherche de produits

### Requête

```http
GET https://www.auchan.fr/recherche?text=café&pageSize=30
Accept: text/html
X-Requested-With: XMLHttpRequest
Cookie: <session>
```

### Réponse

La réponse est du **HTML server-rendered** (~337 Ko pour 30 produits avec session active).
Sans cookie de session valide, le serveur retourne un shell HTML vide (~145 Ko) sans produits.

Le fichier HTML contient tous les produits dans le DOM. Chaque produit est structuré ainsi :

```html
<!-- Carte produit -->
<li class="product-thumbnail list__item shadow--light product-thumbnail--column">

  <!-- Description (nom + marque) — environ 3000 chars AVANT le quantity-selector -->
  <p class="product-thumbnail__description" itemprop="name description">
    <strong itemprop="brand">AUCHAN BIO</strong>
    Café en grains 100% arabica intensité 8
  </p>

  <!-- Attributs (format, prix/kg) -->
  <div class="product-thumbnail__attributes">
    <span class="product-attribute" aria-label="Contenance : 1kg">1kg</span>
    <span data-seller-type="GROCERY" data-offer-type="DEFAULT"
          data-product-id="25c7e59b-22ea-44cb-a5b6-0a55d0ae1fab"
          data-offer-id="b4a5f23d-b3b8-5fda-9f17-bb7c0328add1">
      17,24€ / kg
    </span>
  </div>

  <!-- Prix principal -->
  <div class="product-price bolder text-dark-color">17,24€</div>
  <meta itemprop="price" content="17.24">

  <!-- Sélecteur de quantité — contient les IDs pour les mutations panier -->
  <!-- ATTENTION : la classe s'étend sur PLUSIEURS LIGNES (whitespace dans l'attribut) -->
  <div class="quantity-selector qa2c-wrapper quantity-selector--default
       "
       data-product-id="25c7e59b-22ea-44cb-a5b6-0a55d0ae1fab"
       data-offer-id="b4a5f23d-b3b8-5fda-9f17-bb7c0328add1"
       data-offer-type="DEFAULT"
       data-offer-with-delay="false"
       data-stock="23"
       data-open-offer-selector="false"
       data-disable-button="false"
       data-sales-restriction="false"
       data-seller-type="GROCERY"
       data-seller-id="b42fbf5b-51d4-42d0-bad8-abe4e6963846"
       data-delivery-channel="PICK_UP">
  </div>

</li>
```

### Extraction des données produit

| Champ | Source HTML | Note |
|-------|-------------|------|
| `productId` | `div.quantity-selector[data-product-id]` | UUID v4 |
| `offerId` | `div.quantity-selector[data-offer-id]` | UUID v4 Hybris |
| `sellerId` | `div.quantity-selector[data-seller-id]` | UUID stable par drive |
| `sellerType` | `div.quantity-selector[data-seller-type]` | Toujours `"GROCERY"` |
| `name` | Contenu texte de `p.product-thumbnail__description` (strip balises) | Inclut la marque |
| `brand` | `<strong>` dans `p.product-thumbnail__description` | Premier `<strong>` |
| `price` | `div.product-price` (regex `\d+[,.]\d{2}`) | En centimes |
| `pricePerKg` | Pattern `X,XX € / kg` dans le contexte | En centimes |
| `format` | `span.product-attribute` | Ex: `"250g"`, `"1kg"` |
| `catalogCode` | `href="/produit/pr-(C\d+)"` | Ex: `"C1264653"` |
| `available` | Absence de `disabled` sur le div quantity-selector | |

### Quirks importants

**Classe multi-lignes** : la classe CSS du `quantity-selector` contient un retour à la ligne
(`\n`) avant le guillemet fermant. La regex doit utiliser `[^>]` (pas `.`) pour traverser
les newlines dans les attributs :
```
/<div[^>]+data-product-id="[^"]+"[^>]*>/g
```

**Distance description/selector** : la `<p class="product-thumbnail__description">` est
~3000 chars AVANT le `<div class="quantity-selector">`. La fenêtre de contexte de parsing
doit être d'au moins 4000 chars en arrière.

**Entités HTML** : les noms de produits contiennent des entités numériques hexadécimales
(`&#xE9;` = `é`, `&#xF4;` = `ô`, `&#x20AC;` = `€`). Le décodeur doit les gérer.

---

## GET /cart — Lecture du panier

### Requête

```http
GET https://www.auchan.fr/cart
Accept: application/json
X-Requested-With: XMLHttpRequest
Cookie: <session>
```

### Réponse 200

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
          "offering": {
            "actualQuantity": 4,
            "maxQuantity": 14,
            "context": {
              "deliveryChannel": "PICK_UP",
              "seller": {
                "id": "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
                "name": "Drive Caluire",
                "type": "GROCERY"
              }
            },
            "prices": {
              "price": { "amount": 1649, "currency": "EUR" },
              "totalPrice": { "amount": 4354, "currency": "EUR" }
            }
          }
        }
      ]
    },
    "id": "438e38d8-958a-4c66-93be-f4de245a9c98",
    "version": 15
  }
}
```

### Extraction des champs clés

| Champ extrait | Chemin JSON |
|---------------|-------------|
| `cartId` | `cart.cart.id` (aussi `cart.id`) |
| `total` | `cart.cart.prices.totalPrice.amount` (centimes) |
| `items[].lineId` | `cart.cart.items[].id` (requis pour update/remove) |
| `items[].productId` | `cart.cart.items[].productId` |
| `items[].offerId` | `cart.cart.items[].offerId` |
| `items[].quantity` | `cart.cart.items[].desiredQuantity` |
| `items[].price` | `cart.cart.items[].offering.prices.price.amount` |
| `items[].sellerId` | `cart.cart.items[].offering.context.seller.id` |
| `items[].sellerType` | `cart.cart.items[].offering.context.seller.type` |

---

## POST /cart/update — Mutations du panier

Un seul endpoint gère les trois opérations : ajout, mise à jour de quantité, suppression.
La différence se joue sur la présence du champ `id` (cart line ID) et la valeur de `desiredQuantity`.

### Requête

```http
POST https://www.auchan.fr/cart/update
Content-Type: application/json
Accept: application/json
X-Requested-With: XMLHttpRequest
Cookie: <session>
```

### Body commun

```json
{
  "cartId": "<uuid>",
  "items": [ /* voir variantes ci-dessous */ ],
  "consentId": "<lark-consentId cookie value>",
  "reservationId": null,
  "mbaAvailabilityNeeded": true
}
```

### Variante ADD (article absent du panier)

Pas de champ `id` dans l'item. `productId`, `offerId`, `sellerId`, `sellerType` viennent
des `data-*` du DOM de recherche.

```json
{
  "items": [{
    "productId": "25c7e59b-22ea-44cb-a5b6-0a55d0ae1fab",
    "offerId":   "b4a5f23d-b3b8-5fda-9f17-bb7c0328add1",
    "sellerId":  "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
    "sellerType": "GROCERY",
    "desiredQuantity": 2,
    "desiredType": "DEFAULT"
  }]
}
```

### Variante UPDATE (article existant dans le panier)

Le champ `id` (cart line ID) est **obligatoire** pour une mise à jour. Sans lui, le serveur
crée un doublon au lieu de modifier la quantité.

```json
{
  "items": [{
    "id":         "5797d20b-68cc-4484-a711-69f3b5e8893c",
    "productId":  "25c7e59b-22ea-44cb-a5b6-0a55d0ae1fab",
    "offerId":    "b4a5f23d-b3b8-5fda-9f17-bb7c0328add1",
    "sellerId":   "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
    "sellerType": "GROCERY",
    "desiredQuantity": 1,
    "desiredType": "DEFAULT"
  }]
}
```

### Variante REMOVE (supprimer un article)

`desiredQuantity: 0` supprime l'article du panier. Le champ `id` reste obligatoire.

```json
{
  "items": [{
    "id":         "5797d20b-68cc-4484-a711-69f3b5e8893c",
    "productId":  "25c7e59b-22ea-44cb-a5b6-0a55d0ae1fab",
    "offerId":    "b4a5f23d-b3b8-5fda-9f17-bb7c0328add1",
    "sellerId":   "b42fbf5b-51d4-42d0-bad8-abe4e6963846",
    "sellerType": "GROCERY",
    "desiredQuantity": 0,
    "desiredType": "DEFAULT"
  }]
}
```

### Réponse 200

Même structure que `GET /cart` — le panier mis à jour est retourné directement.

### Source des valeurs

| Champ body | Source |
|------------|--------|
| `cartId` | `GET /cart` → `cart.cart.id` |
| `items[].id` | `GET /cart` → `cart.cart.items[n].id` (absent pour ADD) |
| `items[].productId` | Recherche DOM `data-product-id` ou `GET /cart` |
| `items[].offerId` | Recherche DOM `data-offer-id` ou `GET /cart` |
| `items[].sellerId` | Recherche DOM `data-seller-id` ou `GET /cart → offering.context.seller.id` |
| `items[].sellerType` | Recherche DOM `data-seller-type` ou `GET /cart` (toujours `"GROCERY"`) |
| `consentId` | Cookie `lark-consentId` (extrait depuis le header Cookie) |

---

## GET /offering-contexts — Store locator (drives disponibles)

### Contexte

Cet endpoint est déclenché par le widget "Choisir un drive" de la SPA. Il est servi par le
framework CREST du journey-renderer.

### Requête

```http
GET https://www.auchan.fr/offering-contexts?address.zipcode=69001&address.city=Lyon&address.country=France&location.latitude=45.7578&location.longitude=4.8320&accuracy=MUNICIPALITY&position=1&sellerType=GROCERY&filters.pos=&filters.slots=&filters.validStoreReferences=&channels=PICK_UP,SHIPPING
Accept: application/crest
X-Crest-Renderer: journey-renderer
X-Requested-With: XMLHttpRequest
Referer: https://www.auchan.fr/checkout/cart/
Cookie: <session>
```

### Headers critiques

| Header | Valeur requise | Effet si absent |
|--------|---------------|-----------------|
| `Accept` | `application/crest` | Retourne la page HTML complète au lieu du fragment → Express 404 |
| `X-Crest-Renderer` | `journey-renderer` | 500 serveur ou réponse vide |
| `address.zipcode` | Code postal FR (ex: `69001`) | 500 serveur — **obligatoire** |

### Paramètres de la query string

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `address.zipcode` | `69001` | Code postal — **obligatoire** (500 sans) |
| `address.city` | `Lyon` | Nom de la ville |
| `address.country` | `France` | Pays en toutes lettres (pas `FR`) |
| `location.latitude` | `45.7578` | Latitude décimale |
| `location.longitude` | `4.8320` | Longitude décimale |
| `accuracy` | `MUNICIPALITY` | Précision géographique |
| `position` | `1` | Position dans la liste (pagination) |
| `sellerType` | `GROCERY` | Type de vendeur |
| `filters.pos` | `` | Filtre type de point de vente (vide = tous) |
| `filters.slots` | `` | Filtre créneaux (vide = tous) |
| `filters.validStoreReferences` | `` | Filtre références (vide = tous) |
| `channels` | `PICK_UP,SHIPPING` | Canaux de livraison |

### Réponse 200 — Fragment HTML CREST

```html
<link rel="stylesheet" href="/xch/v8/journey-renderer/.../css/journey-offering-contexts-styles.min.css">
<link rel="stylesheet" href="/xch/v8/place-renderer/.../css/point-of-service-styles.min.css">

<section class="journey__offering-contexts">

  <div class="journey-offering-context__wrapper journeyPosItem shadow--light"
       data-id="d240e702-a1ab-e800-34fe-d683523ebab0"
       data-lat="45.698731"
       data-lng="4.766401"
       data-restricted="false"
       data-type="DRIVE"
       data-zipcode="69630"
       data-city="CHAPONOST">

    <div class="journey-offering-context__container">
      <div class="journey-offering-context__main-infos-wrapper">
        <div class="place-pos__wrapper">
          <div class="place-pos__wrapper place-pos__wrapper--row">
            <i aria-hidden="true" class="place-pos__type-logo icon-drive"></i>
            <div class="place-pos__main-infos">
              <span class="place-pos__type-name">Drive</span>
              <span class="place-pos__name">Auchan Drive Saint-Genis (Chapônost)</span>
              <span class="place-pos__address">1 Allée des Saules, 69630 Chaponost</span>
            </div>
          </div>
          <span class="place-pos__availability">Ouvert jusqu'à 19h30</span>
        </div>
      </div>
      <!-- Distance en km dans un span de texte libre -->
      <span>5.14 km</span>
    </div>

  </div>

  <!-- Répété pour chaque drive trouvé (~20-23 drives dans un rayon de 30km) -->

</section>
```

### Extraction des données store

| Champ | Source HTML |
|-------|-------------|
| `id` | `div.journeyPosItem[data-id]` (UUID stable du vendeur) |
| `type` | `div.journeyPosItem[data-type]` (ex: `"DRIVE"`) |
| `name` | `span.place-pos__name` (dans le bloc du store) |
| `address` | `span.place-pos__address` ou construction `data-city + data-zipcode` |
| `distance` | Pattern `(\d+[,.]?\d*)\s*km` dans le bloc du store (converti en mètres) |
| `lat/lng` | `data-lat` / `data-lng` (pour calcul de distance si besoin) |

### ID vendeur = ID drive

Le `data-id` (`sellerId`) est l'identifiant stable du drive Auchan. Il est utilisé :
- Dans `data-seller-id` des résultats de recherche (produits contextuels au drive)
- Dans le body de `/cart/update` comme `sellerId`
- Pour sélectionner/mémoriser le drive actif

Exemples de sellers IDs connus (Lyon, juin 2026) :

| Drive | Seller ID |
|-------|-----------|
| Auchan Drive Supermarché Caluire | `8dede798-9649-4481-acea-486d00396e73` |
| Auchan Drive Caluire | `53482316-4a17-12fb-76c2-c8f5a22db3a1` |
| Auchan Drive Supermarché Sathonay-Camp | `d22c9cb8-0b85-4243-a8fa-e737a25cada5` |
| Auchan Drive Lyon Saint-Priest | `de403e35-da83-2dce-a6fb-42dc17c57f95` |
| Auchan Drive Saint-Genis (Chapônost) | `d240e702-a1ab-e800-34fe-d683523ebab0` |

---

## Géocodage — api-adresse.data.gouv.fr

Le store locator Auchan requiert un code postal (`address.zipcode`), non fourni par Nominatim
pour les grandes villes. L'API officielle du gouvernement français résout ce problème.

### Requête

```http
GET https://api-adresse.data.gouv.fr/search/?q=Lyon&limit=1&type=municipality
Accept: application/json
User-Agent: mcp-auchan-drive/1.0
```

### Réponse 200 (GeoJSON)

```json
{
  "features": [{
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [4.8320, 45.7580]
    },
    "properties": {
      "label": "Lyon",
      "score": 0.9512,
      "citycode": "69123",
      "postcode": "69001",
      "city": "Lyon",
      "context": "69, Rhône, Auvergne-Rhône-Alpes",
      "type": "municipality"
    }
  }]
}
```

**Coordonnées** : `features[0].geometry.coordinates` = `[longitude, latitude]` (ordre GeoJSON).

### Résultats pour les principales villes

| Requête | Code postal retourné | Ville normalisée |
|---------|---------------------|------------------|
| `Lyon` | `69001` | Lyon |
| `Paris` | `75001` | Paris |
| `Lille` | `59000` | Lille |
| `Bordeaux` | `33000` | Bordeaux |
| `Irigny` | `69540` | Irigny |
| `69540` | `69540` | Irigny |

---

## GET /fidelite/accueil — Programme de fidélité

### Contexte

La page de fidélité est **entièrement server-side rendered** par le framework CREST d'Auchan.
Les données du compte (cagnotte, carte, Jour W!, défis) sont intégrées dans le HTML initial ;
il n'existe pas d'endpoint REST JSON public pour les obtenir directement.

Les fragments `GET /fragments/loyalty/balance/expiry` et
`GET /fragments/loyalty/waooh-challenges-light` visibles dans les DevTools sont des
Server-Side Includes (SSI) appelés uniquement depuis le cluster interne lors du rendu SSR.
Ils retournent 404 quand appelés directement depuis le client, même avec un Bearer token valide.

### Requête

```http
GET https://www.auchan.fr/fidelite/accueil
Accept: text/html
X-Requested-With: XMLHttpRequest
Cookie: <session>
```

### Réponse 200 — Page HTML (~350 Ko)

Extrait des sections pertinentes du DOM :

```html
<!-- Carte de fidélité -->
<div class="o-cardSelector__cardNumberAndName">
  <div class="o-cardSelector__cardNumber">N° <strong>0491355117428</strong></div>
  <div class="o-cardSelector__cardName">CHARRAT Raphaël</div>
</div>

<!-- Solde de la cagnotte principale -->
<div class="t-myLoyalty__amount o-loyaltyMyCard__amount">
  <div class="o-loyaltyMyCard__row">
    <span>Ma cagnotte au 04/06/2026</span>
    <span class="a-waaohTag a-waaohTag--xlarge a-waaohTag--transparent">3,46 €</span>
  </div>
</div>

<!-- Numéro de compte Waooh (distinct du numéro de carte) -->
<div class="-waaohAccountID">Mon numéro de compte Waooh : 74041146</div>

<!-- Jour W! -->
<div class="m-discountClubBox">
  <div class="m-discountClubBox__title -waaoh">Votre jour W! est activé !</div>
  <div class="m-discountClubBox__title -noBold">
    Chaque <strong>mercredi</strong>, vous bénéficiez de
    <strong>10 % cagnottés sur tous les produits frais des Halles*</strong>
  </div>
</div>

<!-- Défis Waaoh -->
<section class="t-myLoyalty__section t-myLoyalty__section--challenges">
  <div class="m-emptyBox__title -noBold">
    <strong>Jusqu'au 30 juin 2026</strong>, profitez des Défis Waaoh…
  </div>
  <div class="a-waaohChallengeTag">
    Cagnotte Défis Waaoh
    <span class="a-waaohChallengeTag__amount">0,00 €</span>
  </div>
</section>
```

### Extraction des données fidélité

| Champ | Sélecteur / Pattern | Note |
|-------|---------------------|------|
| `card.number` | `div.o-cardSelector__cardNumber > strong` | Numéro de carte à 13 chiffres |
| `card.holder` | `div.o-cardSelector__cardName` | Nom et prénom |
| `balance.amountFormatted` | `span.a-waaohTag--xlarge.a-waaohTag--transparent` | Ex: `"3,46 €"` |
| `balance.amountCents` | Parsé depuis `amountFormatted` | En centimes (346) |
| `balance.expiryDate` | Pattern `Ma cagnotte au (JJ/MM/AAAA)` | Date d'expiration |
| `waoohAccountNumber` | `div.-waaohAccountID` | Distinct du numéro de carte |
| `jourW.active` | Présence de `"jour W! est activé"` | Boolean |
| `jourW.day` | `<strong>` après `"Chaque "` dans `m-discountClubBox` | Ex: `"mercredi"` |
| `jourW.benefit` | `<strong>` après `"vous bénéficiez de"` | Ex: `"10 % cagnottés…"` |
| `challenges.deadline` | `<strong>Jusqu'au …</strong>` (apostrophe U+2019) | Ex: `"30 juin 2026"` |
| `challenges.cagnotteFormatted` | `span.a-waaohChallengeTag__amount` | Ex: `"0,00 €"` |
| `challenges.cagnotteCents` | Parsé depuis `cagnotteFormatted` | En centimes |

### Quirk important — apostrophe typographique

Le mot `Jusqu'au` dans le HTML source utilise l'apostrophe **typographique droite** U+2019 (`'`)
et non l'apostrophe ASCII U+0027 (`'`). La regex de parsing doit utiliser le bon caractère :

```typescript
html.match(/<strong>Jusqu'au ([^<]+)<\/strong>/)
//                       ↑ U+2019, pas U+0027
```

### Endpoints observés lors du chargement de /fidelite/accueil

| Endpoint | Type | Rôle |
|----------|------|------|
| `GET /auth/user-info` | JSON | Token JWT + `rcw_id` (non utilisé pour la fidélité) |
| `GET /fragments/loyalty/balance/expiry?accountId=…` | SSI interne | Fragment cagnotte (SSR only) |
| `GET /fragments/loyalty/waooh-challenges-light?id=…` | SSI interne | Fragment défis (SSR only) |
| `GET /cart` | JSON | Panier courant (chargé en parallèle) |

---

## Anti-bot DataDome

Auchan utilise DataDome pour protéger ses APIs contre le scraping automatisé.

### Comportement

- Le cookie `datadome` est généré par un challenge JavaScript lors du premier chargement
  de page dans un navigateur réel.
- Sans `datadome`, les requêtes directes fonctionnent souvent (pas de blocage systématique
  sur `/recherche` et `/cart`), mais les requêtes trop rapides ou en parallèle déclenchent un 403.
- Un 403 DataDome retourne du HTML (page de défi), pas une réponse JSON.

### Mitigation

- **Throttler** : sérialiser toutes les requêtes avec un délai minimum de 1000ms + jitter 0–400ms.
- **Backoff** : en cas de 403/429, attendre `backoffBase * 2^tentative` ms avant retry.
- **Invalidation cookie** : en cas de 403, vider le cache cookie et relire depuis le navigateur
  (le challenge DataDome peut avoir renouvelé le token `datadome`).
- **Max retries** : 3 tentatives par défaut.

### Variables d'environnement

```
AUCHAN_MIN_INTERVAL_MS=1000   # délai minimum entre requêtes
AUCHAN_JITTER_MS=400          # jitter aléatoire (0 à cette valeur)
AUCHAN_MAX_RETRIES=3          # nombre de retries sur 403/429
AUCHAN_BACKOFF_BASE_MS=1500   # base du backoff exponentiel
```

---

## Endpoints explorés mais non utilisés

| Endpoint | Méthode | Status | Résultat |
|----------|---------|--------|----------|
| `https://api.auchan.fr/journey/search/point-of-service` | GET | 401 | Nécessite Bearer token — non obtenu |
| `https://api.auchan.fr/offering-contexts` | GET | 404 | Mauvais domaine |
| `/journey/search/point-of-service` (www) | GET | 400 | Spring Boot — params inconnus |
| `/geocoding/autocomplete` | GET | 404 | Non exposé directement |
| `/journey/locator/configuration` | GET | — | Non testé |

L'API `api.auchan.fr` nécessite un Bearer token JWT probablement obtenu via un flow OAuth
Lark/Keycloak. Le token n'est pas dans les cookies — il est probablement stocké en
`localStorage` ou `sessionStorage` et donc inaccessible depuis Node.js.

---

## Flux complet — De la recherche à l'ajout au panier

```
1. Géocodage (si nécessaire)
   GET api-adresse.data.gouv.fr/search/?q=Lyon&type=municipality
   → lat=45.7578, lng=4.8320, postcode=69001, city=Lyon

2. Store locator
   GET /offering-contexts?address.zipcode=69001&...
   Headers: Accept: application/crest, X-Crest-Renderer: journey-renderer
   → HTML avec <div.journeyPosItem data-id="<sellerId>">

3. Sélection du drive (local uniquement)
   → Stocker sellerId dans store-state.json

4. Recherche produit
   GET /recherche?text=café
   → HTML ~337Ko
   → Parser: div.quantity-selector[data-product-id, data-offer-id, data-seller-id]
   → productId, offerId, sellerId extraits du DOM

5. Lecture cartId
   GET /cart
   → JSON: cart.cart.id

6. Ajout au panier
   POST /cart/update
   Body: { cartId, items: [{ productId, offerId, sellerId, sellerType, desiredQuantity }], consentId }
   → JSON: panier mis à jour
```
