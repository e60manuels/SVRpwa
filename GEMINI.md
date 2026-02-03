# SVR PWA Project

This project is a Progressive Web Application (PWA) designed to provide a mobile-optimized interface for finding SVR (Stichting Vrije Recreatie) campsites. It serves as a modern replacement for the legacy SVR Android app, migrating logic from Kotlin/WebView to a pure web-based implementation.

## Project Overview
The **SVR PWA** provides an interactive map and list view of campsites across the Netherlands and Europe. It integrates with the SVR.nl API via a Cloudflare Worker proxy to bypass CORS restrictions and manage session state.

*   **Main Technologies:** HTML5, CSS3, JavaScript (jQuery), Leaflet.js (Mapping), Swiper.js (Carousels), and Service Workers.
*   **Architecture:** A single-page application (SPA) style interface with a full-screen Leaflet map, a toggleable list view, and an overlay-based campsite detail view.
*   **Key Features:**
    *   **Instant Load:** Uses `assets/campsites_preset.json` and `localStorage` to show results immediately upon startup.
    *   **Smart Search:** Local search suggestions using `assets/Woonplaatsen_in_Nederland.csv` for high-performance location lookups.
    *   **Offline Support:** Service worker (`sw.js`) caches all core assets and provides an `offline.html` fallback.
    *   **Android Parity:** UI elements like the "Gele Veeg" (Yellow Swipe) and layout components are styled to match the native Android experience.

## Building and Running
The project consists of static files and does not require a complex build step.

*   **Development:** Use any local web server to serve the root directory.
    ```powershell
    # Using Python
    python -m http.server 8000
    # Using Node.js
    npx http-server
    ```
*   **Deployment:** Files are hosted on GitHub Pages (at `e60manuels.github.io/SVRpwa/`). Deployment is handled by pushing to the `main` branch.
*   **Version Management:** The app uses a manual version counter in `js/local_app.js` (`window.SVR_PWA_VERSION`) and `sw.js` (`CACHE_NAME`) to force cache refreshes on clients.

## Development Conventions
*   **Coding Style:**
    *   **JavaScript:** Primarily uses a single-file logic approach in `js/local_app.js` with IIFEs and jQuery.
    *   **CSS:** Uses CSS variables for branding colors (e.g., `--svr-yellow: #FDCC01`, `--svr-blue: #008AD3`).
    *   **Language:** User-facing strings and internal comments are in Dutch, matching the target audience.
*   **PWA Standards:**
    *   All icon changes must be reflected in `manifest.json`.
    *   Any new static assets (JS/CSS/Images) must be added to the `ASSETS_TO_CACHE` array in `sw.js`.
*   **API Interactions:**
    *   Requests to `svr.nl` must go through the Cloudflare Worker proxy (`svr-proxy-worker.e60-manuels.workers.dev`).
    *   Filter state is managed via URL parameters and converted to cookies by the proxy.

## Key Files
*   `index.html`: Main entry point and UI structure.
*   `js/local_app.js`: Core application logic (Map, Search, API, Render).
*   `css/local_style.css`: Primary styling and layout.
*   `sw.js`: Service worker for caching and offline functionality.
*   `assets/Woonplaatsen_in_Nederland.csv`: Dataset for local search suggestions.
*   `bestanden/`: Contains reference files from the Android project (e.g., `MainActivity.kt`) and server-side logs.

## Known Constraints & Debugging
*   **Cross-Domain Cookies:** Standard browser security prevents the PWA from setting cookies directly for `svr.nl`. All cookie-based logic (like authentication and filters) must be handled via the Cloudflare Worker header injection.
*   **Map Performance:** High marker counts are handled using `Leaflet.markercluster` to ensure smooth performance on mobile devices.
