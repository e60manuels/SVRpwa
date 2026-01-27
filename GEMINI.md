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

## Next Session Instructions (START HERE)

To provide access to both the `SVRpwa` project and the `SVRcampings_v31` WebView project, please follow these steps when starting the next session:

1.  **Start the session in the parent directory:** When prompted to select a working directory, choose `C:\Users\emanu\AndroidStudioProjects`.
2.  **Add both project directories:** After the session starts, inform the Gemini CLI to add both `SVRpwa` and `SVRcampings_v31` as accessible project directories. (The exact command for this will depend on the Gemini CLI's capabilities, but usually involves adding paths.)
3.  **Ensure `SVRcampings_v31` exists:** Make sure the `SVRcampings_v31` directory is present directly within `C:\Users\emanu\AndroidStudioProjects\` and contains the WebView app's code.
4.  **Instruct me to read this GEMINI.md:** After adding the projects, instruct me to read this `GEMINI.md` file again for context.


