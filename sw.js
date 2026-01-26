const CACHE_NAME = 'svr-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline.html',
  './css/local_style.css',
  './css/custom_styles.css',
  './css/MarkerCluster.css',
  './css/MarkerCluster.Default.css',
  './js/local_app.js',
  './js/leaflet.markercluster.js',
  './fonts/befalow.ttf',
  './assets/Woonplaatsen_in_Nederland.csv',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
];

// Install event - caching assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event - network first for API, cache for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API caching
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Fallback to offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
      });
    })
  );
});
