# Modernisatie & Optimalisatie Plan (SVR PWA)

> **Status-update (v0.2.59):** dit plan is tegen de huidige codebase gecontroleerd. Punt 1 en 6 zijn achterhaald (zie toelichting per punt). Punt 4 is inmiddels uitgevoerd. Punten 2, 3 en 5 zijn nog actueel en onaangepakt — bespreekpunt voor gezamenlijke prioritering met de developers, niet in z'n eentje doorgevoerd i.v.m. regressierisico zonder testsuite.

Dit document bevat de concrete aanbevelingen van de Codebase Investigator (v86 Health Check) om de codebase stap-voor-stap te moderniseren en de afhankelijkheid van jQuery te verminderen zonder de performance negatief te beïnvloeden.

## 1. Kritieke Fix (Offline Ondersteuning) — ❌ ACHTERHAALD
*   **Bestand:** `sw.js`
*   **Probleem:** `js/pwa_install.js` ontbreekt in de `ASSETS_TO_CACHE` lijst.
*   **Actie:** Voeg `./js/pwa_install.js` toe aan de cache-lijst om ervoor te zorgen dat de installatie-logica ook offline werkt.
*   **Toelichting (v0.2.59):** `./js/pwa_install.js` staat al in `ASSETS_TO_CACHE` (regel 13 van `sw.js`). Dit punt was niet meer waar op moment van review.

## 2. Event Listeners Moderniseren
Vervang jQuery event handlers door native JavaScript listeners. Dit is veiliger voor de performance en vermindert overhead.
*   **Voorbeeld:**
    ```javascript
    // OUD
    $('#locateBtn').on('click', () => { ... });
    // NIEUW
    document.getElementById('locateBtn').addEventListener('click', () => { ... });
    ```
*   **Focus:** Alle `.on('click')` en `.on('scroll')` aanroepen in `local_app.js`.

## 3. UI Toggles & Zichtbaarheid
De functie `applyState` leunt zwaar op jQuery `.show()` en `.hide()`. Dit kan efficiënter.
*   **Actie:** Gebruik `element.style.display = 'block' / 'none'` of werk met CSS classes (`element.classList.add('hidden')`).
*   **Voordeel:** Snellere UI-transities.

## 4. DOM Manipulatie (Render Results) — ✅ UITGEVOERD (v0.2.59)
*   **Bestand:** `js/local_app.js` -> functie `renderResults`.
*   **Aanbeveling:** Vervang `$('#resultsList').empty().append(card)` door:
    ```javascript
    const container = document.getElementById('resultsList');
    container.innerHTML = '';
    // Bouw de HTML string eerst volledig op (batch)
    container.insertAdjacentHTML('beforeend', cardsHtml);
    ```
*   **BELANGRIJK:** Bij het moderniseren van de kaart-markers, gebruik `markerCluster.addLayers(markersArray)` in plaats van `addLayer()` in een loop om "main thread blocking" te voorkomen.
*   **Toelichting (v0.2.59):** Uitgevoerd. `renderResults` bouwt nu alle camping-kaarten op in een array en voegt ze in één `insertAdjacentHTML`-call in, en cluster-markers (buiten de top 10) worden gebatcht via `markerCluster.addLayers()` i.p.v. losse `addLayer()`-calls in de loop. `top10Layer` (max. 10 items, `L.featureGroup()`) is bewust ongewijzigd gelaten — geen batch-API beschikbaar en geen meetbare winst bij dat aantal.

## 5. Native Smooth Scrolling
De huidige scroll-naar-boven functie gebruikt jQuery `.animate()`.
*   **Actie:** Vervang door de native browser API:
    ```javascript
    document.getElementById('list-container').scrollTo({ top: 0, behavior: 'smooth' });
    ```
*   **Voordeel:** Veel soepelere animatie op mobiele apparaten.

## 6. Lokale Cache Robuustheid — ❌ ACHTERHAALD
*   **Actie:** Implementeer een `try-catch` blok rondom `JSON.parse(cached)` in de functie `loadCachedCampsites`.
*   **Voordeel:** Voorkomt dat de app crasht bij een corrupte `localStorage`.
*   **Toelichting (v0.2.59):** De functie `loadCachedCampsites` en de bijbehorende `localStorage`-cache (`svr_cache_campsites`) bestaan niet meer — deze zijn al in v0.2.30 verwijderd ten gunste van `data/campings.json` als single source of truth (zie AGENTS.md, "Completed Modernizations"). Dit punt verwijst naar architectuur die niet meer bestaat.
