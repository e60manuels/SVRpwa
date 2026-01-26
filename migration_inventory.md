# SVR PWA Migration Inventory

## 1. UI/UX Structure
- **Base HTML:** `local_ui.html` from `SVRcampings_v31/app/src/main/assets/`.
- **Styles:** 
    - `local_style.css` (Main app styles)
    - `custom_styles.css` (Additional overrides)
    - `MarkerCluster.css` & `MarkerCluster.Default.css` (Leaflet clustering)
- **External Dependencies:**
    - Leaflet.js (v1.9.4)
    - Leaflet.markercluster (v1.4.1)
    - jQuery (v3.6.0)
    - Font Awesome (v6.4.2)
- **Layout Components:**
    - `loading-overlay`: Spinner during API calls.
    - `help-overlay`: Onboarding tooltips.
    - `svr-header`: Search bar with suggestions list.
    - `map-container`: Full-screen Leaflet map.
    - `list-container`: Scrollable list of campsite cards.
    - `map-actions-stack`: Floating action buttons (Locate, Filter, Toggle View).

## 2. API & Logic
- **Campsite API:** `https://www.svr.nl/api/objects`
    - Parameters: `lat`, `lng`, `distance`, `limit`, `q`, `page`.
- **Filters API:** `https://www.svr.nl/objects` (Parsed as HTML to extract filter groups and facilities).
- **Local Logic (to be ported from Kotlin to JS):**
    - **Suggestions:** Port logic from `SearchManager.kt` using `Woonplaatsen_in_Nederland.csv`.
    - **Geocoding:** Replace `Android.getLocationCoordinates` with a web-based Geocoder (e.g., Nominatim).
    - **Navigation:** Replace `Android.openNavigation` with `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`.
    - **Detail View:** Replace `Android.openDetailActivity` with standard `window.location.href`.

## 3. State Management
- **Cookies:** The app relies on several cookies for session and filter state:
    - `filters`: JSON array of active facility/country GUIDs.
    - `config`: Search configuration.
    - `view_mode`: `map` or `list`.
- **History:** Uses `history.pushState` to manage view transitions.

## 4. Assets
- **CSV Data:** `assets/Woonplaatsen_in_Nederland.csv`.
- **Fonts:** `assets/fonts/befalow.ttf`.
- **Icons:** `res/mipmap-hdpi/ic_launcher_png.png` (Source for PWA icons).
- **Colors:**
    - Theme Color: `#FDCC01` (Yellow)
    - Primary Color: `#008AD3` (SVR Blue)
    - Error/Route: `#c0392b` (Red)

## 5. PWA Setup Requirements
- **manifest.json:**
    - `name`: "SVR Campings"
    - `short_name`: "SVR"
    - `start_url`: "/index.html"
    - `display`: "standalone"
    - `background_color`: "#FDCC01"
    - `theme_color`: "#008AD3"
- **Service Worker (sw.js):**
    - Cache all CSS, JS, HTML, and Fonts.
    - Offline fallback page.
    - Network-first for API calls (no caching for data).
