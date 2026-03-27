# Plan: Implementatie Static Content Delivery voor SVR PWA

Dit plan beschrijft de transitie van API-gebaseerde filtering naar een Static Content Delivery model voor de "Overige filters", terwijl Landen/Gebieden filters via de API blijven lopen.

## 1. Build-script: `build-campings-json.js`

Er wordt een Node.js script ontwikkeld dat de volgende acties uitvoert:
- **Sessiebeheer**: Inloggen op SVR via de Cloudflare proxy met behulp van omgevingsvariabelen (`SVR_EMAIL`, `SVR_PASSWORD`).
- **Filter Mapping**: Scrapen van `https://www.svr.nl/objects` om een lijst van alle faciliteiten (Overige filters) en hun IDs op te bouwen.
- **Data Ophalen**: 
    1. Ophalen van de basislijst van alle campings (ID, Naam, Stad, Coördinaten).
    2. Per faciliteit-ID een API-call uitvoeren om te bepalen welke campings deze faciliteit hebben.
- **Output**: Genereren van `data/campings.json` met de volgende structuur:
  ```json
  {
    "updated": "2026-03-27T...",
    "campings": [
      {
        "id": "guid",
        "naam": "...",
        "stad": "...",
        "lat": 52.123,
        "lng": 6.456,
        "filters": ["fac_id_1", "fac_id_2"]
      }
    ]
  }
  ```

## 2. PWA Aanpassingen (`js/local_app.js`)

### A. Data laden
Een nieuwe functie `loadStaticCampsites()` wordt toegevoegd die bij initialisatie `data/campings.json` ophaalt en opslaat in `window.staticCampsites`.

### B. Zoeklogica (`performSearch`)
De `performSearch` functie wordt aangepast:
1. **Detectie**: Controleer of er filters actief zijn die behoren tot de categorie "Landen" of "Gebieden".
2. **Besluitvorming**:
   - Indien Landen/Gebieden actief: Voer de huidige `fetchWithRetry` API-call uit.
   - Indien alleen Overige filters actief: Filter de `window.staticCampsites` array lokaal met `array.filter()`.
3. **Rendering**: Geef de resultaten door aan de bestaande `renderResults()` functie.

## 3. Service Worker (`sw.js`)

- Voeg `./data/campings.json` toe aan de `ASSETS_TO_CACHE` array.
- Bij een update van de data moet de `CACHE_NAME` in `sw.js` handmatig worden opgehoogd (zoals gebruikelijk in dit project).

## 4. Map-structuur
- Nieuwe map aanmaken: `/data/` voor de opslag van het gegenereerde JSON bestand.

## 5. Voordelen & Risicobeheer
- **Snelheid**: Filters reageren onmiddellijk.
- **Offline**: Zoeken werkt zonder internetverbinding (voor de campings in de JSON).
- **Fallback**: De huidige API-omgeving blijft de fallback voor complexe geografische filters (Landen/Gebieden).
- **Referentie**: De huidige v0.2.26 op productie dient als stabiele fallback.

## Verificatiestappen
1. Run `node build-campings-json.js` en controleer de output in `data/campings.json`.
2. Open de PWA op Staging en controleer in de Network tab of er GEEN API-calls meer plaatsvinden bij het wijzigen van overige filters.
3. Test de offline werking door de vliegtuigmodus in te schakelen.
