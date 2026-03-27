# Taak: Static Content Delivery implementeren in de SVR PWA

## Achtergrond

De SVR PWA haalt bij elke sessie via API calls live data op:
- Een JSON lijst met ~1300 campings (coördinaten, namen, IDs) voor de kaartmarkers
- Per filter-selectie (bijv. "Kindercamping") een nieuwe API call die dezelfde 1300 campings retourneert, maar met een markering welke campings aan het filter voldoen
- Per camping-selectie een aparte API call voor de detailgegevens

De content verandert slechts een paar keer per jaar. Dit maakt het ideaal voor **static content delivery**: een pre-gebouwde JSON file die bij app-start één keer wordt geladen en daarna volledig client-side wordt gebruikt.

---

## Infrastructuur (belangrijk voor het build-script)

### Hosting
De app draait op GitHub Pages met twee omgevingen:
- **Productie**: `https://e60manuels.github.io/SVRpwa/`
- **Staging**: `https://e60manuels.github.io/SVRpwa-test/`

### Cloudflare Worker proxy
De SVR-API (`svr.nl`) staat geen directe CORS-requests toe. Alle API-aanroepen lopen daarom via een **Cloudflare Worker proxy** die CORS omzeilt en sessie-cookies beheert:
- Proxybroncode: `bestanden/cloudflare_worker_proxy.js`
- Proxy-endpoint: geconfigureerd in `js/local_app.js`

Het build-script moet dus **via de proxy** aanroepen doen, niet rechtstreeks naar de SVR-API. Gebruik het proxy-endpoint zoals dat al in `local_app.js` staat geconfigureerd.

### Service Worker & cache-busting
- `sw.js` cached de app shell voor offline gebruik
- CSS en JS worden geversioned via query-parameters (bijv. `?v=0.2.26`) in `index.html`
- De nieuwe `campings.json` moet ook worden opgenomen in de cache-lijst van `sw.js`

---

## Infrastructuur (belangrijk voor het build-script)

- **Hosting**: GitHub Pages, twee omgevingen:
  - Productie: `https://e60manuels.github.io/SVRpwa/`
  - Staging: `https://e60manuels.github.io/SVRpwa-test/`
- **API-toegang via Cloudflare Worker proxy**: De SVR-API staat geen directe CORS-requests toe. Alle API calls lopen via een Cloudflare Worker proxy waarvan het endpoint geconfigureerd staat in `js/local_app.js`. Het build-script moet dus ook via dit proxy-endpoint werken, niet rechtstreeks naar svr.nl.
  - De proxy-broncode staat in `bestanden/cloudflare_worker_proxy.js` — raadpleeg dit bestand voor het juiste endpoint en eventuele sessie/cookie-afhandeling die het build-script nodig heeft.
- **Service Worker** (`sw.js`): cached de app shell. De nieuwe `campings.json` moet worden toegevoegd aan de cache-lijst in `sw.js` zodat de app ook offline werkt.
- **Cache-busting**: Versienummers worden beheerd via query-parameters in `index.html`. Dit is niet van toepassing op JSON databestanden, maar houd er rekening mee bij eventuele JS-aanpassingen.

---

## Technische context

### Cloudflare Worker proxy
De SVR API (svr.nl) staat geen directe CORS-requests toe. Alle API calls lopen daarom via een **Cloudflare Worker proxy**. De broncode staat in `bestanden/cloudflare_worker_proxy.js` en het proxy-endpoint is geconfigureerd in `js/local_app.js`.

Het build-script moet dus via ditzelfde proxy-endpoint werken — niet rechtstreeks naar svr.nl. Gebruik de bestaande `apiBase` of vergelijkbare constante uit `local_app.js` als basis-URL in het build-script.

### GitHub Pages structuur
De app draait op twee omgevingen:
- **Productie:** `https://e60manuels.github.io/SVRpwa/`
- **Staging:** `https://e60manuels.github.io/SVRpwa-test/`

De `campings.json` komt in `/data/campings.json` in de repository. Omdat de app al met relatieve paden werkt (zie `manifest.json`), werkt de fetch naar `./data/campings.json` automatisch in beide omgevingen.

### Service Worker
De huidige `sw.js` cached de App Shell. Voeg `./data/campings.json` toe aan de cache-lijst zodat de app ook offline werkt na de eerste load.

### Cache-busting
De app gebruikt query-parameters voor versiebeheer op CSS en JS (bijv. `?v=0.2.26`). Voor `campings.json` is dit niet nodig — de service worker cache wordt bij een update handmatig gebusted via de bestaande versioning aanpak.

---

## Technische context

- **Hosting**: GitHub Pages, twee omgevingen:
  - Productie: `https://e60manuels.github.io/SVRpwa/`
  - Staging: `https://e60manuels.github.io/SVRpwa-test/`
- **API-toegang via Cloudflare Worker proxy**: De SVR-API staat geen directe CORS-requests toe. Alle API calls lopen via een Cloudflare Worker proxy die CORS omzeilt en sessie-cookies beheert. Het proxy-endpoint is geconfigureerd in `js/local_app.js`. Het build-script moet dit zelfde proxy-endpoint gebruiken — niet de SVR-API rechtstreeks aanroepen.
- **Service Worker**: `sw.js` cached de App Shell. De nieuw toe te voegen `data/campings.json` moet worden opgenomen in de cache-lijst van de service worker.
- **Cache-busting**: Versiebeheer via query-parameters in `index.html` (bijv. `?v=0.2.26`). Dit is niet van toepassing op de JSON data file.

---

## Wat we willen bereiken

### 1. Build-script: `build-campings-json.js`

Maak een Node.js script dat lokaal gedraaid kan worden en een `campings.json` genereert:

**Stap 1** — Haal de volledige campinglijst op via de proxy (alle ~1300 campings met ID, naam, coördinaten en eventuele basisvelden). Gebruik het proxy-endpoint uit `local_app.js`.

**Stap 2** — Loop door alle ~70 "Overige filters" (bijv. Kindercamping, Broodjesservice, Zwembad, etc.). De volledige filterlijst staat in de app — gebruik die bestaande lijst als input. Doe per filter één API call via de proxy en noteer welke camping-IDs dit filter als marker hebben.

**Stap 3** — Voeg alles samen tot één object per camping:
```json
{
  "id": 1234,
  "naam": "Camping De Berk",
  "lat": 52.123,
  "lng": 6.456,
  "filters": ["kindercamping", "broodjesservice"]
}
```

**Stap 4** — Schrijf het resultaat naar `/data/campings.json`.

---

### 2. App aanpassen: gebruik `campings.json` in plaats van API

Pas de bestaande modules aan zodat:

- Bij app-start wordt `/data/campings.json` één keer opgehaald en in geheugen gehouden
- De kaartmarkers worden gevuld vanuit deze lokale data (geen API call meer)
- **Overige filters** werken volledig client-side: filter het in-memory array op `camping.filters.includes(filterNaam)`
- **Landen en gebieden filters** blijven werken via de bestaande API calls — dit hoeft niet te veranderen
- Detaildata per camping blijft via API (geen wijziging nodig)

---

### 3. Service Worker updaten

Voeg `/data/campings.json` toe aan de cache-lijst in `sw.js` zodat de file ook offline beschikbaar is na de eerste load. Let op de bestaande versiebeheerstrategie.

### 4. Hosting op GitHub Pages

De `campings.json` wordt geplaatst in de `/data/` map van de repository en is daarmee automatisch beschikbaar op zowel de productie- als stagingomgeving. De relatieve paden (zoals al toegepast in `manifest.json`) zorgen dat beide omgevingen werken zonder extra configuratie.

---

## Infrastructuur & omgevingen

### Cloudflare Worker proxy
De SVR-API (svr.nl) staat geen directe CORS-requests toe. Alle API calls lopen daarom via een **Cloudflare Worker proxy**. De broncode staat in `bestanden/cloudflare_worker_proxy.js`, het proxy-endpoint is geconfigureerd in `js/local_app.js`.

Het build-script moet dezelfde proxy gebruiken als de app — dus niet rechtstreeks naar svr.nl, maar via het geconfigureerde Cloudflare-subdomein. Lees het endpoint uit `js/local_app.js` en gebruik dat als base URL in het build-script.

### GitHub Pages omgevingen
Er zijn twee omgevingen, beide gehost op GitHub Pages:
- **Productie**: `https://e60manuels.github.io/SVRpwa/`
- **Staging**: `https://e60manuels.github.io/SVRpwa-test/`

Het manifest gebruikt relatieve paden (`./`) zodat dezelfde code in beide submappen werkt. De `campings.json` moet ook op een relatief pad staan (`./data/campings.json`) zodat dit in beide omgevingen werkt.

### Cache-busting
`index.html` gebruikt query-parameters voor versioning op CSS en JS (bijv. `?v=0.2.26`). Na implementatie van de static delivery: voeg `campings.json` **niet** toe aan cache-busting — de Service Worker beheert deze file via `sw.js`. Controleer wel of `sw.js` de `/data/campings.json` opneemt in de App Shell cache, zodat de file offline beschikbaar is.

---

## Wat ongewijzigd blijft

- Landen/gebieden filters → blijven API calls via de Cloudflare proxy
- Camping detailpagina → blijft API call bij selectie via de Cloudflare proxy
- Kaartbibliotheek (Leaflet.js), clustering, en UI → geen wijzigingen
- Cloudflare Worker proxy zelf → geen wijzigingen

## Extra aanpassing: service worker

Voeg `/data/campings.json` toe aan de cache-lijst in `sw.js` zodat de file onderdeel wordt van de app shell cache en offline beschikbaar is na de eerste load.

---

## Verwacht resultaat

- Nul API calls voor overige filters na de initiële load
- Kaart laadt direct vanuit lokale JSON, geen wachttijd op API
- App werkt grotendeels offline na eerste load
- `build-campings-json.js` is het enige script dat gedraaid moet worden als SVR de content bijwerkt

---

## Vraag aan Gemini

Bekijk de bestaande codebase en:
1. Schrijf het `build-campings-json.js` build-script op basis van de bestaande API-aanroepen en filterlijst die al in de code staan
2. Pas de relevante modules aan om `campings.json` te gebruiken zoals hierboven beschreven
3. Geef aan welke bestanden je hebt aangepast en wat er per bestand veranderd is
