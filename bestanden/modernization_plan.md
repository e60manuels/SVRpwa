# Modernisatie & Optimalisatie Plan (SVR PWA)

Dit document bevat de concrete aanbevelingen van de Codebase Investigator (v86 Health Check) om de codebase stap-voor-stap te moderniseren en de afhankelijkheid van jQuery te verminderen zonder de performance negatief te beïnvloeden.

## 1. Kritieke Fix (Offline Ondersteuning)
*   **Bestand:** `sw.js`
*   **Probleem:** `js/pwa_install.js` ontbreekt in de `ASSETS_TO_CACHE` lijst.
*   **Actie:** Voeg `./js/pwa_install.js` toe aan de cache-lijst om ervoor te zorgen dat de installatie-logica ook offline werkt.

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

## 4. DOM Manipulatie (Render Results)
*   **Bestand:** `js/local_app.js` -> functie `renderResults`.
*   **Aanbeveling:** Vervang `$('#resultsList').empty().append(card)` door:
    ```javascript
    const container = document.getElementById('resultsList');
    container.innerHTML = '';
    // Bouw de HTML string eerst volledig op (batch)
    container.insertAdjacentHTML('beforeend', cardsHtml);
    ```
*   **BELANGRIJK:** Bij het moderniseren van de kaart-markers, gebruik `markerCluster.addLayers(markersArray)` in plaats van `addLayer()` in een loop om "main thread blocking" te voorkomen.

## 5. Native Smooth Scrolling
De huidige scroll-naar-boven functie gebruikt jQuery `.animate()`.
*   **Actie:** Vervang door de native browser API:
    ```javascript
    document.getElementById('list-container').scrollTo({ top: 0, behavior: 'smooth' });
    ```
*   **Voordeel:** Veel soepelere animatie op mobiele apparaten.

## 6. Lokale Cache Robuustheid
*   **Actie:** Implementeer een `try-catch` blok rondom `JSON.parse(cached)` in de functie `loadCachedCampsites`.
*   **Voordeel:** Voorkomt dat de app crasht bij een corrupte `localStorage`.
