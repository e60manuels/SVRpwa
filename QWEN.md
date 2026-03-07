# SVR Campings PWA

## Project Overview

SVR Campings PWA is a Progressive Web Application that provides a mobile-friendly interface for finding SVR campings in the Netherlands. The application integrates with the SVR.nl platform to display camping locations on a map, provide search functionality, and show detailed information about each camping site.

### Key Features
- Interactive map view with Leaflet and marker clustering
- Search functionality with location suggestions using Dutch municipalities data
- List view of campings with distance calculations
- Detailed camping information pages with image carousels
- Filtering capabilities for facilities and countries
- Offline support through service workers
- Location services for nearby campings
- Navigation integration to Google Maps

### Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: Leaflet.js with OpenStreetMap tiles and MarkerCluster plugin
- **UI Framework**: Custom CSS with Bootstrap-like classes
- **Icons**: Font Awesome
- **Carousels**: Swiper.js
- **Build System**: Gradle (for Android version reference)
- **APIs**: SVR.nl API, Nominatim for geocoding
- **PWA Features**: Manifest.json, Service Worker (sw.js)

## Project Structure

```
SVRpwa/
├── index.html              # Main application entry point
├── manifest.json           # PWA manifest configuration
├── sw.js                   # Service worker for offline functionality
├── offline.html            # Offline fallback page
├── GEMINI.md               # Development session notes
├── migration_inventory.md  # Migration documentation
├── assets/
│   └── Woonplaatsen_in_Nederland.csv  # Dutch municipalities data
├── bestanden/              # Development files and references
├── css/
│   ├── local_style.css     # Main application styles
│   ├── custom_styles.css   # Custom detail page styles
│   ├── MarkerCluster.css   # Marker cluster styling
│   └── MarkerCluster.Default.css
├── fonts/
│   └── befalow.ttf         # Custom font
├── icons/                  # PWA icons
└── js/
    └── local_app.js        # Main application logic
```

## Building and Running

### Prerequisites
- A web server capable of serving static files
- Modern web browser with JavaScript enabled
- Internet connection for API calls and map tiles

### Local Development
1. Serve the project directory using a local web server:
   ```bash
   # Using Python's built-in server
   python -m http.server 8000
   
   # Or using Node's http-server
   npx http-server
   
   # Or using PHP's built-in server
   php -S localhost:8000
   ```
   
2. Open the application in a browser at the served address

### Production Deployment
1. Deploy all files to a web server
2. Ensure proper MIME types are set for service worker and manifest files
3. Configure HTTPS (required for service worker registration)

## Development Conventions

### Code Style
- Use consistent indentation (spaces, 4-wide)
- Follow semantic HTML practices
- Use CSS variables defined in `:root` for theme colors
- Maintain Dutch language for user-facing text and comments
- Use camelCase for JavaScript variables and functions

### Architecture Patterns
- Modular JavaScript with IIFE (Immediately Invoked Function Expression) pattern
- Event-driven programming with jQuery
- State management using browser History API
- Cookie-based persistence for user preferences
- Service worker caching strategy (cache-first for static assets, network-first for API calls)

### API Integration
- All API calls are routed through a Cloudflare Worker proxy to bypass CORS restrictions
- Session management via localStorage with custom headers
- Error handling for network failures and API errors
- Retry mechanism for failed requests

## Key Files and Configuration

### Core Application Files
- `index.html`: Main application structure and UI components
- `js/local_app.js`: Main application logic, map functionality, search, and detail views
- `css/local_style.css`: Primary styling including map, header, and UI components
- `sw.js`: Service worker with caching strategy for offline functionality
- `manifest.json`: PWA configuration including icons, theme colors, and display settings

### External Dependencies
- Leaflet.js (v1.9.4) for mapping functionality
- jQuery (v3.6.0) for DOM manipulation
- Font Awesome (v6.4.2) for icons
- Swiper.js for image carousels
- MarkerCluster for grouping map markers

### Data Sources
- `assets/Woonplaatsen_in_Nederland.csv`: Used for location suggestions in search
- SVR.nl API for camping data and details
- Nominatim API for geocoding location names

## Theme Colors and Branding
- **SVR Yellow**: `#FDCC01` (primary brand color)
- **SVR Blue**: `#008AD3` (secondary color for links and highlights)
- **SVR Red**: `#c0392b` (used for route buttons and errors)
- **SVR Green**: `#92d050` (used for location indicators)

## Special Features

### Search Suggestions
The application provides location-based search suggestions using a local CSV file of Dutch municipalities, offering a better UX than relying solely on external geocoding services.

### Detail Page Implementation
The detail pages replicate the functionality of the native Android WebView implementation, including:
- Image carousels with Swiper.js
- Custom styling for the "Gele Veeg" banner
- Proper handling of inline styles and JavaScript events
- Back navigation with history management

### Offline Support
The service worker caches essential assets allowing basic functionality when offline, with a fallback offline page for navigation requests.

### Map and List Views
Users can toggle between map view (with clustered markers) and list view (with distance calculations), with persistent state management.

## Known Issues and Debugging Notes

### Filter Functionality Issue
There is an ongoing issue with the filter functionality where filters are not properly applied to the results. The server response returns all 1270 campsites with `type_camping` values of 0, 1, or 2, and no campsites with `type_camping=3` (which indicates non-matching filters).

### Cookie Handling Problem
The PWA currently does not set the necessary cookies (such as `filters` and `config`) that the original Android WebView app uses for filtering. 
The PWA attempts to set cookies for the `svr.nl` domain, but these are not accepted by the browser due to cross-domain security policies since the PWA runs from `e60manuels.github.io`.

### Current Debug Status
- Server response does not contain proper `type_camping=3` values
- No filter cookies are being set in the browser
- The Cloudflare Worker may need to be modified to convert URL parameters to the cookies that the SVR server expects

### Next Steps for Resolution
1. Modify the Cloudflare Worker to intercept filter parameters from the URL and convert them to the appropriate cookies for the SVR server
2. Ensure proper cookie handling and forwarding between the PWA, Worker, and SVR server
3. Test that the server correctly returns `type_camping=3` for non-matching campsites when filters are applied