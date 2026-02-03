# SVR PWA Project

This project is a Progressive Web App (PWA) migration of the SVR Campings Android WebView app. It replicates the original app's functionality using standard web technologies (HTML, CSS, JS) to ensure cross-platform compatibility (Android, iOS, Windows).

## Project Overview

The goal is to provide a "native-like" experience for finding SVR campsites without relying on a specific app store or native wrapper.

**Key Features:**
- **Interactive Map:** Leaflet.js integration with clustering for displaying campsites.
- **Search & Navigation:** Location-based search with autocomplete (local CSV) and external geocoding (Nominatim).
- **Filtering:** Dynamic filter system ported from the original app logic.
- **PWA Support:** Installable on devices, offline support via Service Worker.

## Directory Structure

- **root**: Contains `index.html` (entry point), `manifest.json` (app metadata), and `sw.js` (Service Worker).
- **assets/**: Static data files (e.g., `Woonplaatsen_in_Nederland.csv` for search suggestions).
- **css/**: Stylesheets mimicking the original app's look and feel (`local_style.css`, `custom_styles.css`) and library styles.
- **js/**: Application logic (`local_app.js`) and libraries (`leaflet.markercluster.js`).
- **icons/**: App icons for PWA installation.
- **fonts/**: Custom fonts (Befalow).

## Development & Usage

Since this is a static web application, no build process is required.

1.  **Running Locally:** Serve the project root using any static file server (e.g., `python -m http.server`, `http-server`, or VS Code Live Server).
2.  **Deployment:** The project is structured for deployment to GitHub Pages or any static hosting service. Ensure the `start_url` in `manifest.json` matches the deployment path.

## Key Files

-   `index.html`: The main shell of the application.
-   `js/local_app.js`: Contains all the core logic: state management, API interaction (proxying), map rendering, and search functionality.
-   `sw.js`: The Service Worker responsible for caching assets and providing the offline fallback (`offline.html`).
-   `manifest.json`: Configuration for the PWA (name, icons, theme colors).

## Conventions

-   **Code Style:** Plain ES6 JavaScript (no framework).
-   **Styling:** CSS variables for theming (SVR Blue `#008AD3`, Yellow `#FDCC01`).
## External APIs: Uses `allorigins.win` or `corsproxy.io` to bypass CORS when fetching data from `svr.nl`.

---

## Offline-First & Instant Performance (v59 - Current Status)

The app is now at version **v59**. This session focused on eliminating startup latency and providing an "Instant Map" experience.

### Key Wins:
1.  **Zero-Call Startup:** 
    *   The app no longer makes API calls for campsite data on startup.
    *   Both the Map and List views are populated instantly from a local `localStorage` cache or a optimized `assets/campsites_preset.json` (for new installs).
2.  **Instant Local Search:**
    *   City/location searches now perform distance calculations locally against the cached dataset (~1270 campsites).
    *   This provides zero-latency results without spinners for standard searches.
3.  **Cache Optimization (Data Stripping):**
    *   Campsite data is "stripped" of heavy fields (long descriptions, URLs) before caching.
    *   The full dataset is reduced from ~6MB to ~280KB, well within the 5MB `localStorage` limit.
4.  **Optimized UI Timing:**
    *   Background fetch for filter definitions (vinkjes) is delayed by 1500ms to give the CPU full priority for rendering markers and list cards.
    *   Performance Marks added to track rendering duration (avg. ~1.1s for 1270 markers).
5.  **UX & Styling Polish:**
    *   **Swiper Fix:** Enabled vertical page scrolling when touching image carousels (set `touchStartPreventDefault: false`).
    *   **Red Marker Priority:** Assigned `zIndexOffset: 2000` to the search marker so it always stays on top of blue campsite markers.
    *   **Final Styling:** Settled on a clean **Yellow Header** and standard **White/Gray Footer** for maximum compatibility.

### Technical Lessons Learned:
*   **LocalStorage Quota:** Always strip API responses to essential fields for caching. Heavy HTML content in JSON can quickly exceed the 5MB quota.
*   **Service Worker Persistence:** Android "WebAPKs" (installed PWAs) are extremely stubborn with `manifest.json` updates. A version jump (e.g., from v55 to v59) and `self.clients.claim()` are needed to force a refresh.
*   **Main Thread Priority:** Heavily rendering 1000+ DOM elements (markers/cards) blocks the CPU. Delay secondary network tasks (like filter fetching) until rendering is complete.
*   **External Outages:** GitHub Actions outages (status red) can prevent pushed code from going live. Always check `GitHub Actions` tab if changes don't appear online.

---

## Next Session Instructions (START HERE)

To provide access to both the `SVRpwa` project and the `SVRcampings_v31` WebView project, please follow these steps when starting the next session:

1.  **Start the session in the parent directory:** When prompted to select a working directory, choose `C:\Users\emanu\AndroidStudioProjects`.
2.  **Add both project directories:** After the session starts, inform the Gemini CLI to add both `SVRpwa` and `SVRcampings_v31` as accessible project directories.
3.  **Check Version Status:** Verify if **v59** is finally live on GitHub. If not, check GitHub Actions for the 2 Feb 2026 outage status.
4.  **Instruct me to read this GEMINI.md:** After adding the projects, instruct me to read this `GEMINI.md` file again for context.