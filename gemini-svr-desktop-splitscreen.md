# SVR PWA — Desktop Split-Screen Redesign (v0.2.37)

## Context

Dit is een implementatieprompt voor de SVR Campings PWA. De app is een static PWA
(vanilla JS/HTML/CSS, geen build step) gehost op GitHub Pages. De bestanden die
gewijzigd worden zijn `css/local_style.css`, `css/custom_styles.css` en `js/local_app.js`.

Na implementatie moet je de wijzigingen deployen naar de staging-omgeving:
```bash
git add -A
git commit -m "v0.2.37: Desktop split-screen redesign — kaart links, lijst rechts, unified rechter paneel"
git push staging main
```

---

## Doel

De desktop layout (≥768px) volledig herontwerpen zodat:

- **Links (50%)**: altijd de kaart
- **Rechts (50%)**: standaard de lijst, maar ook het detailpaneel en het filterpaneel openen hier
- De actieknoppen stack rechtsonder in de rechterhelft staan
- De toggle-knop hergebruikt wordt als universele sluitknop voor detail én filter
- Mobiel (< 768px) volledig ongewijzigd blijft

---

## Gewenste layout

```
┌─────────────────────────────────────────────────────────────┐
│  [====Zoekveld====]  [filter-chips bar]  [ℹ]               │
├──────────────────────────┬──────────────────────────────────┤
│      KAART (50%)         │  LIJST / DETAIL / FILTER (50%)   │
│      Links               │      Rechts                      │
│                          │                                  │
│  [marker popup INFO] ───▶│  DETAIL opent hier               │
│                          │  [knoppen stack rechtsonder]     │
│  [filter-icoon] ────────▶│  FILTER opent hier               │
└──────────────────────────┴──────────────────────────────────┘
```

**Rechter paneel — één paneel tegelijk (mutex):**

| Situatie | Rechts zichtbaar |
|---|---|
| Standaard | Lijst |
| Info-knop in marker popup | Detail (lijst verdwijnt) |
| Info-knop in lijst-tegel | Detail (lijst verdwijnt) |
| Filter-icoon | Filter (lijst verdwijnt) |
| Toggle-knop (als detail/filter open) | Lijst (terug) |

---

## Wijzigingen per bestand

### 1. `css/local_style.css`

#### 1a. Verwijder de bestaande desktop split-screen CSS (regel ≈566–744)

Verwijder het volledige blok van de comment `/* DESKTOP RESPONSIVE - SPLIT SCREEN (v0.2.35) */`
tot het einde van het bestand (inclusief alle `@media (min-width: 768px)` en
`@media (min-width: 1024px)` blokken die betrekking hebben op split-screen,
detail-container positionering en filter-overlay positionering).

#### 1b. Voeg aan het einde van het bestand toe:

```css
/* ========================================
   DESKTOP SPLIT-SCREEN LAYOUT (v0.2.37)
   Kaart links — Lijst/Detail/Filter rechts
   ======================================== */

@media (min-width: 768px) {

    /* Kleinere UI-elementen */
    .search-container { height: 36px; }
    .search-container input { font-size: 14px; }
    .map-stack-btn { width: 40px; height: 40px; }
    .map-stack-btn i { font-size: 16px; }
    .card-body h3 { font-size: 22px; }
    .card-body .card-location, .card-body .card-distance { font-size: 14px; }
    .active-filter-chip { font-size: 10px; height: 24px; }
    .help-text { font-size: 12px; }

    /* Suggesties gecentreerd */
    .suggestions-list {
        left: 50% !important;
        transform: translateX(-50%);
        max-width: 400px;
    }

    /* === KAART: altijd links 50% === */
    #map-container {
        position: absolute;
        top: var(--header-height);
        left: 0;
        width: 50%;
        height: calc(100vh - var(--header-height));
        right: auto !important;
        transform: none !important;
    }

    /* === LIJST: altijd rechts 50%, standaard zichtbaar === */
    #list-container {
        position: absolute;
        top: var(--header-height);
        right: 0;
        left: auto !important;
        width: 50%;
        height: calc(100vh - var(--header-height));
        background: #f5f5f5;
        box-shadow: -2px 0 8px rgba(0,0,0,0.1);
        transform: none !important;
        max-width: none !important;
        display: block !important; /* altijd zichtbaar tenzij paneel open */
    }

    /* === RECHTER PANEEL (Detail of Filter) ===
       Beide openen rechts, over de lijst heen.
       Standaard verborgen; wordt zichtbaar via JS (display:block). */
    #detail-container,
    #svr-filter-overlay {
        position: absolute !important;
        top: var(--header-height) !important;
        right: 0 !important;
        left: auto !important;
        width: 50% !important;
        height: calc(100vh - var(--header-height)) !important;
        transform: none !important;
        border-radius: 0 !important;
        box-shadow: -2px 0 8px rgba(0,0,0,0.15) !important;
        z-index: 1500 !important;
    }

    /* Detail sheet vult het paneel volledig */
    #detail-container .detail-sheet-content {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        height: 100% !important;
        max-height: 100% !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        transform: none !important; /* geen slide-up animatie op desktop */
        transition: none !important;
    }

    /* Splash verbergen op desktop */
    #detail-container .detail-splash {
        display: none !important;
    }

    /* Filter content vult het paneel volledig */
    #svr-filter-overlay .svr-overlay-header,
    #svr-filter-overlay #svr-filter-overlay-content,
    #svr-filter-overlay .svr-overlay-footer {
        /* Bestaande mobile stijlen zijn OK, paneel erft de juiste afmetingen */
    }

    /* Backdrop nooit tonen op desktop */
    #svr-filter-backdrop {
        display: none !important;
    }

    /* === ACTIEKNOPPEN: rechtsonder in de rechterhelft === */
    .map-actions-stack {
        position: fixed;
        right: 12px !important;
        bottom: calc(20px + var(--safe-area-inset-bottom));
        z-index: 2000;
    }

    /* Knoppen verbergen als detail of filter open is */
    body.panel-open .map-actions-stack {
        display: none !important;
    }

    /* Toggle-knop: toon sluit-icoon als paneel open is */
    body.panel-open #toggleView i {
        /* Icoon wordt via JS gewisseld naar fa-xmark */
    }

    /* Camping-cards: desktop optimalisatie */
    .camping-card { max-width: none; margin: 0 0 12px 0; }
}

@media (min-width: 1024px) {
    .search-container { height: 32px; }
    .search-container input { font-size: 13px; }
    #searchIcon { font-size: 14px; }
    .map-stack-btn { width: 36px; height: 36px; }
    .map-stack-btn i { font-size: 14px; }
    .active-filter-chip { font-size: 9px; height: 22px; padding: 0 8px; }
    .active-filter-chip i { font-size: 12px; }
    .card-body h3 { font-size: 20px; }
}
```

---

### 2. `css/custom_styles.css`

#### 2a. Verwijder de bestaande desktop `@media`-blokken

Verwijder de volgende blokken volledig uit `custom_styles.css` (ze worden
vervangen door de nieuwe CSS in `local_style.css`):

- Het blok `/* DESKTOP RESPONSIVE - Detail View (v0.2.31) */` met alle
  `@media (min-width: 768px)`, `@media (min-width: 1024px)` en
  `@media (min-width: 1440px)` varianten die `.detail-sheet-content` stijlen.

Laat de rest van `custom_styles.css` volledig intact.

---

### 3. `js/local_app.js`

Voer de volgende **gerichte wijzigingen** uit. Wijzig niets buiten de genoemde
functies/regels, tenzij expliciet vermeld.

---

#### 3a. Nieuwe hulpfunctie `openRightPanel()` toevoegen

Voeg **direct na de sluitende `}` van `setDesktopViewMode()`** (na regel ≈1203)
de volgende nieuwe functie toe:

```javascript
/**
 * Opent een paneel rechts op desktop (detail of filter).
 * Sluit eerst het andere paneel als dat open is.
 * @param {'detail'|'filter'} type
 */
function openRightPanel(type) {
    const isDesktop = window.innerWidth >= 768;
    if (!isDesktop) return; // Mobile heeft eigen logica

    const detailEl = document.getElementById('detail-container');
    const filterEl = document.getElementById('svr-filter-overlay');

    // Sluit het tegenovergestelde paneel eerst
    if (type === 'detail') {
        filterEl.style.display = 'none';
        filterEl.classList.remove('open');
    } else {
        detailEl.style.display = 'none';
        detailEl.classList.remove('open');
    }

    document.body.classList.add('panel-open');
    // Toggle-icoon → sluit-icoon
    $('#toggleView i').attr('class', 'fas fa-xmark');
}

/**
 * Sluit het actieve rechter paneel en toont de lijst weer.
 */
function closeRightPanel() {
    const isDesktop = window.innerWidth >= 768;
    if (!isDesktop) return;

    const detailEl = document.getElementById('detail-container');
    const filterEl = document.getElementById('svr-filter-overlay');

    detailEl.style.display = 'none';
    detailEl.classList.remove('open');
    filterEl.style.display = 'none';
    filterEl.classList.remove('open');

    document.body.classList.remove('panel-open');
    // Toggle-icoon → standaard lijst-icoon (op desktop niet meer relevant)
    $('#toggleView i').attr('class', 'fas fa-list');
}

// Expose voor gebruik in event handlers
window.closeRightPanel = closeRightPanel;
```

---

#### 3b. `setDesktopViewMode()` vereenvoudigen

Vervang de bestaande `setDesktopViewMode()` functie volledig door:

```javascript
function setDesktopViewMode(mode) {
    // Op desktop is er maar één layout: kaart links, lijst/paneel rechts.
    // De body-class split-mode/map-only/list-only is niet meer nodig.
    // We houden 'split-mode' als standaard body-class voor backward compatibility.
    document.body.classList.remove('split-mode', 'map-only-mode', 'list-only-mode');
    document.body.classList.add('split-mode');
    isListView = false;

    // Sluit eventuele open panelen
    closeRightPanel();

    // Zorg dat de kaart de juiste grootte heeft
    setTimeout(() => {
        if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize();
        }
    }, 100);
}
```

---

#### 3c. Toggle-knop handler aanpassen

Vervang de bestaande `$('#toggleView').on('click', ...)` handler volledig door:

```javascript
// Toggle knop:
// - Desktop: sluit het actieve rechter paneel (detail of filter) → lijst terug
// - Mobile: wissel tussen kaart en lijst
$('#toggleView').on('click', () => {
    const isDesktop = window.innerWidth >= 768;

    if (isDesktop) {
        if (document.body.classList.contains('panel-open')) {
            // Paneel is open → sluiten, detail ook sluiten via history
            if (history.state && history.state.view === 'detail') {
                window.handleDetailBack();
            } else {
                // Filter of ander paneel: direct sluiten
                closeRightPanel();
                window.hideFilterOverlay && window.hideFilterOverlay();
            }
        }
        // Als geen paneel open: toggle doet niets op desktop
    } else {
        // Mobile: toggle tussen kaart en lijst
        isListView = !isListView;
        applyState({ view: isListView ? 'list' : 'map' });
        history.pushState({ view: isListView ? 'list' : 'map' }, "");
    }
});
```

---

#### 3d. `showSVRDetailPage()` aanpassen

Vervang in de functie `window.showSVRDetailPage` het gehele desktop-blok
(`if (isDesktop) { ... }`) door:

```javascript
if (isDesktop) {
    // Verwijder eventuele oude context-klassen (niet meer nodig maar veilig)
    detailOverlay.classList.remove('detail-from-map', 'detail-from-list');

    // Splash verbergen op desktop (CSS doet dit al, maar voor zekerheid)
    if (splashScreen) splashScreen.style.display = 'none';

    // Verwijder bestaande inhoud (behalve splash)
    const elementsToClear = Array.from(detailSheet.children);
    elementsToClear.forEach(el => el.remove());

    // Open het rechter paneel
    openRightPanel('detail');

    detailOverlay.style.display = 'block';

    // Push state voor backknop-ondersteuning
    history.pushState({ view: 'detail', objectId: objectId, source: source }, "", `#detail/${objectId}`);
    renderDetail(objectId);
    return; // Vroeg terugkeren, rest van de functie is mobile-only
}
```

Zorg dat de bestaande mobile-code na dit blok ongewijzigd blijft.

---

#### 3e. `handleDetailBack()` aanpassen

Vervang in `window.handleDetailBack` het desktop-blok (`if (isDesktop) { ... }`) door:

```javascript
if (isDesktop) {
    closeRightPanel();
    detailOverlay.classList.remove('detail-from-map', 'detail-from-list');
    detailOverlay.style.display = 'none';
    if (splashScreen) splashScreen.style.display = 'none';

    if (history.state && history.state.view === 'detail') {
        history.back();
    }
    return;
}
```

---

#### 3f. `toggle_filters()` aanpassen

Vervang in `window.toggle_filters` het desktop-blok (`if (isDesktop) { ... } else { ... }`) door:

```javascript
if (isDesktop) {
    const filterEl = document.getElementById('svr-filter-overlay');
    
    // Toggle: als filter al open is, sluit het
    if (document.body.classList.contains('panel-open') && filterEl.style.display === 'block') {
        closeRightPanel();
        return;
    }

    // Open filter rechts
    openRightPanel('filter');
    filterEl.style.display = 'block';
    filterEl.classList.add('open');

    // Push state voor backknop
    history.pushState({ view: 'filters' }, "");

    if (content.children.length === 0 && !window.isFetchingFilters) await fetchFilterData();
} else {
    // Mobile: fullscreen overlay met backdrop
    backdrop.style.display = 'block';
    overlay.style.transform = '';
    setTimeout(() => { overlay.classList.add('open'); backdrop.classList.add('open'); }, 10);
    history.pushState({ view: 'filters' }, "");
    if (content.children.length === 0 && !window.isFetchingFilters) await fetchFilterData();
}
```

---

#### 3g. `hideFilterOverlay()` aanpassen

Vervang de bestaande `window.hideFilterOverlay` volledig door:

```javascript
window.hideFilterOverlay = function() {
    const isDesktop = window.innerWidth >= 768;
    const filterEl = document.getElementById('svr-filter-overlay');
    const backdropEl = document.getElementById('svr-filter-backdrop');

    if (isDesktop) {
        closeRightPanel();
        filterEl.style.display = 'none';
        filterEl.classList.remove('open');
    } else {
        filterEl.classList.remove('open');
        backdropEl.classList.remove('open');
        filterEl.style.transform = '';
        setTimeout(() => {
            if (!filterEl.classList.contains('open')) {
                backdropEl.style.display = 'none';
            }
        }, 500);
    }
};
```

---

#### 3h. `focusOnMarker()` aanpassen voor desktop

Vervang in `window.focusOnMarker` de eerste regel `applyState({ view: 'map' });` door:

```javascript
const isDesktop = window.innerWidth >= 768;
if (!isDesktop) {
    applyState({ view: 'map' });
}
// Op desktop: kaart is altijd zichtbaar, geen state-switch nodig
```

---

#### 3i. Initialisatie desktop mode

Vervang het blok:

```javascript
// Initialize desktop mode on load
if (window.innerWidth >= 768) {
    setDesktopViewMode('split');
}
```

door:

```javascript
// Initialiseer desktop layout
if (window.innerWidth >= 768) {
    document.body.classList.add('split-mode');
    // Zorg dat kaart correct geladen wordt
    setTimeout(() => { map && map.invalidateSize(); }, 200);
}
```

---

#### 3j. `onpopstate` desktop-tak uitbreiden

Zoek in `window.onpopstate` het blok dat begint met `if (e.state) {` en voeg
**bovenaan dat blok** (vóór de bestaande code) toe:

```javascript
const isDesktopPop = window.innerWidth >= 768;
if (isDesktopPop) {
    // Op desktop: herstel body-class en sluit panelen indien nodig
    if (!e.state || (e.state.view !== 'detail' && e.state.view !== 'filters')) {
        closeRightPanel();
    }
    if (e.state && e.state.view === 'detail' && e.state.objectId) {
        // Detail heropenen via history (bijv. forward-navigatie)
        openRightPanel('detail');
        document.getElementById('detail-container').style.display = 'block';
        renderDetail(e.state.objectId);
    }
    if (!e.state || e.state.view === 'map' || e.state.view === 'list' || e.state.view === 'split') {
        // Standaard desktop: niets te doen, kaart en lijst zijn altijd zichtbaar
        map && setTimeout(() => map.invalidateSize(), 100);
    }
    return; // Desktop afgehandeld, mobile-logica overslaan
}
```

---

#### 3k. Window resize handler aanpassen

Vervang het bestaande `window.addEventListener('resize', ...)` blok door:

```javascript
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        map && map.invalidateSize();

        const isDesktop = window.innerWidth >= 768;
        if (isDesktop && !document.body.classList.contains('split-mode')) {
            document.body.classList.add('split-mode');
            document.body.classList.remove('map-only-mode', 'list-only-mode');
        }
    }, 100);
});
```

---

## Controlelijst na implementatie

Controleer het volgende handmatig in de browser (desktop, breedte ≥768px):

- [ ] Kaart staat **links**, lijst staat **rechts** bij eerste load
- [ ] Klikken op **INFO in een marker popup** → detail opent rechts, lijst verdwijnt, actieknoppen verdwijnen
- [ ] Klikken op **INFO in een lijst-tegel** → detail opent rechts, lijst verdwijnt, actieknoppen verdwijnen
- [ ] **Terugknop** in detailpaneel (pijl-links) sluit detail, lijst verschijnt weer, actieknoppen verschijnen weer
- [ ] **Browser backknop** doet hetzelfde als terugknop in detailpaneel
- [ ] **Toggle-knop** sluit detail als detail open is
- [ ] Klikken op **Filter-icoon** → filter opent rechts, lijst verdwijnt, actieknoppen verdwijnen
- [ ] **Toggle-knop** sluit filter als filter open is
- [ ] Filter en detail kunnen **niet tegelijk** open zijn (openen van de één sluit de ander)
- [ ] **KAART-knop** in lijst-tegel → marker popup opent op kaart links, lijst blijft rechts
- [ ] **Actieknoppen** staan rechtsonder in de rechterhelft (niet op de kaart)
- [ ] **Mobiel (<768px)**: alles werkt precies zoals voorheen (geen regressie)
- [ ] **Leaflet kaart** heeft correct formaat na laden en na resize (geen grijze tegels)

## Deploy

```bash
git add css/local_style.css css/custom_styles.css js/local_app.js
git commit -m "v0.2.37: Desktop split-screen — kaart links, lijst rechts, unified rechter paneel"
git push staging main
```

Controleer na deploy op de staging-URL of alles werkt. Deploy naar productie
alleen als staging correct is:

```bash
git push origin main
```
