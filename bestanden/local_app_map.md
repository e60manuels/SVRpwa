# local_app.js Section Index (v0.2.2)

This index provides a map of the major logic blocks in `js/local_app.js`. Use this to quickly identify the line ranges for specific features.

| Section | Line Range (Approx) | Description |
| :--- | :--- | :--- |
| **[INITIALIZATION]** | 1 - 33 | Global flags, Typewriter effect, Debug logging |
| **[CACHE_PRESETS]** | 34 - 105 | `loadCachedCampsites` (Instant Map & List) |
| **[CSV_SEARCH_LOGIC]** | 106 - 156 | `loadLocations`, `getSuggestionsLocal`, `getCoordinatesWeb` |
| **[NETWORK_PROXY]** | 157 - 263 | `fetchWithRetry`, `proxyUrl`, `openNavHelper` |
| **[FILTER_OVERLAY_UI]** | 264 - 398 | Filter CSS, Backdrop/Overlay creation, `toggle_filters` |
| **[FILTER_LOGIC]** | 399 - 663 | `fetchFilterData`, `createFilterItem`, `updateActiveFiltersUI` |
| **[MAP_CORE_LOGIC]** | 664 - 763 | Leaflet initialization, `calculateDistance`, `applyState` |
| **[SCROLL_LOGIC]** | 764 - 779 | List container scroll handling and "Scroll to Top" button |
| **[DETAIL_OVERLAY]** | 780 - 850 | `showSVRDetailPage`, `handleDetailBack` (Bottom-up sheet) |
| **[HISTORY_MGMT]** | 851 - 935 | `onpopstate` (Manages View/Filter/Detail navigation) |
| **[SEARCH_EVENTS]** | 936 - 965 | Input event handlers (Enter, Click, Input/Suggestions) |
| **[SEARCH_EXECUTION]** | 966 - 1087 | `performSearch` (Instant Search vs API Search) |
| **[DETAIL_RENDER]** | 1088 - 1403 | `renderDetail` (HTML injection, Swiper carousel, Styles) |
| **[MARKER_FOCUS]** | 1404 - 1443 | `focusOnMarker` (Panning and opening popups on map) |
| **[RESULTS_RENDER]** | 1444 - 1507 | `renderResults` (Marker cluster, Top 10, Result cards) |
| **[HELP_OVERLAY]** | 1508 - 1515 | `showHelp` (Toggles the help/onboarding overlay) |
| **[LOGIN_AUTH]** | 1516 - 1663 | `checkSession`, `loginToSVR`, `showLoginScreen` |
| **[APP_STARTUP]** | 1664 - 1736 | `initApp`, `initializeApp`, `closeHelpOverlayAndShowPWA` |
