(function () {
    if (window.SVR_FILTER_OVERLAY_INJECTED) return;
    window.SVR_FILTER_OVERLAY_INJECTED = true;

    // --- DEBUG LOGGING ---
    function logDebug(msg) {
        console.log(msg);
        // Removed on-screen debug console as requested
    }
    window.logDebug = logDebug;
    logDebug("SVR PWA v2.5 Start");

    // --- CSV & SEARCH LOGIC ---
    window.allLocations = [];
    async function loadLocations() {
        try {
            const res = await fetch('assets/Woonplaatsen_in_Nederland.csv');
            const text = await res.text();
            const lines = text.split('\n');
            window.allLocations = lines.slice(1).map(line => {
                const parts = line.split(';');
                if (parts.length >= 2) return { name: parts[0].trim(), province: parts[1].trim() };
                return null;
            }).filter(l => l && l.name);
            logDebug("CSV OK: " + window.allLocations.length);
        } catch (e) { logDebug("CSV Fout: " + e.message); }
    }
    loadLocations();

    window.getSuggestionsLocal = function(q) {
        const queryLower = q.toLowerCase().trim();
        return window.allLocations.filter(l => 
            l.name.toLowerCase().startsWith(queryLower) || 
            l.name.toLowerCase().includes(" " + queryLower)
        ).slice(0, 10).map(l => `${l.name} (${l.province})`);
    };

    window.getCoordinatesWeb = async function(place) {
        const locationName = place.includes(" (") ? place.split(" (")[0] : place;
        try {
            // Use fetchWithRetry to route Nominatim requests through the Worker
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ", Nederland")}&limit=1`;
            logDebug(`Fetching coordinates for "${place}" via Worker proxy.`);
            const contents = await fetchWithRetry(nominatimUrl); // Use fetchWithRetry
            const data = JSON.parse(contents);
            if (data && data.length > 0) {
                return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
            }
        } catch (e) { logDebug("Geocode Fout: " + e.message); }
        return null;
    };

    window.proxyUrl = function(url, provider = 'ao') {
        if (provider === 'ao') return "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
        return "https://corsproxy.io/?" + encodeURIComponent(url);
    }

    async function fetchWithRetry(url) {
        logDebug("Fetch via Cloudflare Worker Proxy...");
        // Replace with your deployed Cloudflare Worker URL
        const PROXY_BASE_URL = 'https://svr-proxy-worker.e60-manuels.workers.dev'; 
    
        // Determine if the URL needs to be proxied.
        // We proxy requests to svr.nl and nominatim.openstreetmap.org
        const originalUrl = new URL(url); // Parse original URL once
        const isProxiedTarget = originalUrl.hostname === 'www.svr.nl' || originalUrl.hostname === 'nominatim.openstreetmap.org';
        let fetchUrl = url;
        const options = { headers: {} }; // Initialize options with an empty headers object
    
        if (isProxiedTarget) {
            // Construct the URL to hit our proxy's forwarding endpoint
            
            // For SVR.nl requests, we often need to map to /api/*
            let pathForProxy = originalUrl.pathname;
            if (originalUrl.hostname === 'www.svr.nl') {
                pathForProxy = originalUrl.pathname.startsWith('/api/') ? originalUrl.pathname : `/api${originalUrl.pathname}`;
            }
            // For Nominatim, use the full path and hostname directly
            if (originalUrl.hostname === 'nominatim.openstreetmap.org') {
                pathForProxy = originalUrl.hostname + originalUrl.pathname; // Send hostname as part of the path for worker routing
            }

            fetchUrl = `${PROXY_BASE_URL}/${pathForProxy}${originalUrl.search}`;
            logDebug(`Proxying request: ${url} -> ${fetchUrl}`);
            
            // Manually add session ID from localStorage only for SVR requests
            if (originalUrl.hostname === 'www.svr.nl') {
                const sessionId = localStorage.getItem('svr_session_id');
                if (sessionId) {
                    options.headers['X-SVR-Session'] = sessionId;
                    logDebug(`Adding X-SVR-Session header: ${sessionId.substring(0, 20)}...`);
                } else {
                    logDebug('No session ID found in localStorage.');
                }
            }


            // options.credentials = 'include'; // Removed, as we manually manage session via custom header
        } else {
            logDebug(`Fetching non-proxied request directly: ${url}`);
        }
    
        try {
            const res = await fetch(fetchUrl, options);


            // Check for 401 = sessie expired (only for SVR requests)
            if (originalUrl.hostname === 'www.svr.nl' && res.status === 401) { // Fixed: used originalUrl.hostname
                console.warn('⚠️ Sessie verlopen, opnieuw inloggen vereist');
                logDebug('⚠️ Sessie verlopen (401)');
                if (window.showLoginScreen) window.showLoginScreen();
                throw new Error('Session expired');
            }

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP error! Status: ${res.status}, Response: ${errorText}`);
            }
            return await res.text();
        } catch (e) {
            logDebug("Fetch via Proxy mislukt: " + e.message);
            if (e.message === 'Session expired') throw e;
            return "";
        }
    }    window.fetchWithRetry = fetchWithRetry;

    window.openNavHelper = function(lat, lng, nameEnc) {
        try {
            const name = decodeURIComponent(escape(window.atob(nameEnc)));
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            window.open(url, '_blank');
        } catch(e) { logDebug("Nav Fout: " + e.message); }
    };

    window.showSVRDetailPage = function(objectId) {
        history.pushState({ view: 'detail', objectId: objectId }, "", `#detail/${objectId}`);
        renderDetail(objectId);
    };

    const css = `
        #svr-filter-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2147483640; display: none; opacity: 0; transition: opacity 0.3s ease; }
        #svr-filter-backdrop.open { display: block; opacity: 1; }
        #svr-filter-overlay { 
            position: fixed; top: 88px; left: 0; width: 100%; height: calc(100% - 88px); 
            background-color: #f0f0f0; z-index: 2147483647; display: flex; flex-direction: column; 
            box-sizing: border-box; transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
            border-top-left-radius: 12px; border-top-right-radius: 12px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        }
        #svr-filter-overlay.open { transform: translateY(0); }
        .svr-overlay-header { background-color: #f0f0f0; padding: 8px 15px 12px 15px; display: flex; flex-direction: column; align-items: flex-start; border-top-left-radius: 12px; border-top-right-radius: 12px; }
        .svr-overlay-title { font-size: 1.2rem; font-weight: bold; margin: 0; color: #008AD3; font-family: 'Befalow', sans-serif; text-align: left; padding-left: 15px; }
        #svr-filter-overlay-content { flex-grow: 1; overflow-y: auto; width: 100%; background-color: #f0f0f0; padding: 15px; box-sizing: border-box; scroll-behavior: smooth; }
        #active-filters-holder { background: #FDCC01; border-radius: 12px; padding: 12px 15px; margin-bottom: 15px; display: none; box-sizing: border-box; width: 100%; position: sticky; top: 0; z-index: 100; }
        .active-filter-tag { display: inline-flex; align-items: center; background: white; padding: 4px 10px; border-radius: 15px; margin: 4px; font-size: 12px; font-weight: bold; color: #008AD3; border: 1px solid #ddd; }
        .filter-section-card { background: white; border-radius: 12px; margin-bottom: 10px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .filter-section-header { padding: 12px 15px; background: #FDCC01; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .filter-section-header h4 { margin: 0; font-size: 22px; color: #333; font-family: 'Befalow', sans-serif; }
        .filter-section-body { padding: 0 15px; display: none; }
        .filter-section-body.show { display: block; padding-bottom: 10px; }
        .svr-overlay-footer { padding: 12px 15px; border-top: 1px solid #ddd; display: flex; gap: 15px; background: #f0f0f0; }
        .svr-footer-btn { flex: 1; height: 40px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        #svr-filter-apply-btn { background-color: #FDCC01; color: #333; }
        #svr-filter-reset-btn { background-color: white; color: #c0392b; border: 1px solid #ddd; }
        .filter-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f9f9f9; }
    `;
    const style = document.createElement('style'); style.appendChild(document.createTextNode(css)); document.head.appendChild(style);

    const backdrop = document.createElement('div'); backdrop.id = 'svr-filter-backdrop'; document.body.appendChild(backdrop);
    const overlay = document.createElement('div'); overlay.id = 'svr-filter-overlay';
    overlay.innerHTML = `
        <div class="svr-overlay-header" id="filter-drag-header">
            <div style="width: 100%; display: flex; justify-content: center; margin-bottom: 10px; pointer-events: none;"><div style="width: 40px; height: 5px; background: #BBB; border-radius: 3px;"></div></div>
            <h3 class="svr-overlay-title">Filters</h3>
        </div>
        <div id="svr-filter-overlay-content">
            <div id="active-filters-holder"><div id="active-tags-container"></div></div>
            <div id="filter-loading" style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#008AD3"></i><p>Filters ophalen...</p></div>
            <div id="filter-container"></div>
        </div>
        <div class="svr-overlay-footer">
            <button id="svr-filter-reset-btn" class="svr-footer-btn">Wis filters</button>
            <button id="svr-filter-apply-btn" class="svr-footer-btn">Toepassen</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const content = overlay.querySelector('#filter-container');
    const loading = overlay.querySelector('#filter-loading');

    window.closeFilterOverlay = function() { 
        overlay.classList.remove('open'); backdrop.classList.remove('open');
        setTimeout(() => { if (!overlay.classList.contains('open')) backdrop.style.display = 'none'; }, 300);
    };
    backdrop.onclick = window.closeFilterOverlay;

    window.toggle_filters = async function() {
        backdrop.style.display = 'block';
        setTimeout(() => { overlay.classList.add('open'); backdrop.classList.add('open'); }, 10);
        if (content.children.length === 0) await fetchFilterData();
    };

    async function fetchFilterData() {
        try {
            logDebug("Filters ophalen...");
            const contents = await fetchWithRetry('https://www.svr.nl/objects');
            if (contents.includes("<!doctype") || contents.includes("<html")) {
                const doc = new DOMParser().parseFromString(contents, 'text/html');
                logDebug("Filter HTML: " + (doc.title || "Foutpagina"));
                return;
            }
            loading.style.display = 'none'; content.innerHTML = '';
        } catch (e) { logDebug("Filter Fout: " + e.message); }
    }

    overlay.querySelector('#svr-filter-apply-btn').onclick = function() {
        const selected = []; overlay.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => selected.push(cb.value));
        window.currentFilters = selected;
        window.closeFilterOverlay(); window.performSearch();
    };

})();

// --- MAP & CORE LOGIC ---
let isListView = false;
let isSearching = false;
logDebug("Map init...");
const map = L.map('map', { zoomControl: false }).setView([52.1326, 5.2913], 8);
const markerCluster = L.markerClusterGroup();
const top10Layer = L.featureGroup();
let centerMarker = null;
let currentUserLatLng = null;

const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
tiles.on('tileload', () => { if(!window.tilesLogged) { logDebug("Tegels OK"); window.tilesLogged=true; } });
map.addLayer(markerCluster); map.addLayer(top10Layer);

map.on('locationfound', (e) => { 
    if (!currentUserLatLng || currentUserLatLng.distanceTo(e.latlng) > 100) {
        logDebug("Loc: " + e.latlng.lat.toFixed(3) + "," + e.latlng.lng.toFixed(3));
        currentUserLatLng = e.latlng;
    }
});
map.locate({ watch: false, enableHighAccuracy: true });

$('#locateBtn').on('click', () => {
    if (currentUserLatLng) map.setView(currentUserLatLng, 10);
    else map.locate({ setView: true, maxZoom: 10 });
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dLat = (lat2-lat1) * Math.PI/180, dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function applyState(state) {
    if (!state) return;

    // Hide all containers initially
    $('#map-container').hide();
    $('#list-container').hide();
    $('#detail-container').hide(); // New detail container

    switch (state.view) {
        case 'list':
            isListView = true;
            $('#list-container').show();
            $('#toggleView i').attr('class', 'fas fa-map');
            break;
        case 'map':
            isListView = false;
            $('#map-container').show();
            $('#toggleView i').attr('class', 'fas fa-list');
            setTimeout(() => map.invalidateSize(), 100);
            break;
        case 'detail': // New case for detail view
            isListView = false; // Detail view is not list view
            $('#detail-container').show();
            // No toggle view change needed for detail view, or perhaps a back button
            break;
        default:
            isListView = false; // Default to map view if state is unclear
            $('#map-container').show();
            $('#toggleView i').attr('class', 'fas fa-list');
            setTimeout(() => map.invalidateSize(), 100);
            break;
    }
}

window.onpopstate = (e) => {
    if (e.state) {
        applyState(e.state);
        if (e.state.view === 'detail' && e.state.objectId) {
            renderDetail(e.state.objectId);
        } else if (e.state.view === 'list' || e.state.view === 'map') {
            performSearch(); // Re-render list/map if needed
        }
    } else {
        // Fallback if state is null (e.g., initial page load or unmanaged history entry)
        applyState({ view: 'map' }); // Default to map view
        performSearch();
    }
};
$('#toggleView').on('click', () => { isListView = !isListView; applyState({ view: isListView ? 'list' : 'map' }); history.pushState({ view: isListView ? 'list' : 'map' }, ""); });

const $searchInput = $('#searchInput'); const $suggestionsList = $('#suggestionsList');
$searchInput.on('input', function() {
    const q = $(this).val(); if (q.length < 2) { $suggestionsList.hide(); return; }
    const suggestions = window.getSuggestionsLocal(q);
    $suggestionsList.empty();
    if (suggestions.length === 0) { $suggestionsList.hide(); return; }
    suggestions.forEach(p => { 
        const $li = $('<li class="suggestion-item"></li>').text(p); 
        $li.on('click', () => { $searchInput.val(p); $suggestionsList.hide(); window.performSearch(); }); 
        $suggestionsList.append($li); 
    });
    $suggestionsList.show();
});

async function performSearch() {
    if (isSearching) return;
    isSearching = true;
    const q = $searchInput.val().trim();
    let sLat = 52.1326, sLng = 5.2913;

    if (q) {
        const coords = await window.getCoordinatesWeb(q);
        if (coords) { sLat = coords.latitude; sLng = coords.longitude; }
    } else if (currentUserLatLng) {
        sLat = currentUserLatLng.lat; sLng = currentUserLatLng.lng;
    }

    if (centerMarker) map.removeLayer(centerMarker);
    centerMarker = L.marker([sLat, sLng], { icon: L.divIcon({ className: 'search-marker', html: '<i class="fa-solid fa-map-pin" style="color:#c0392b;font-size:30px;"></i>', iconSize:[30,30], iconAnchor:[15,30] }) }).addTo(map);

    $('#loading-overlay').css('display', 'flex');
    try {
        let apiUrl = `https://www.svr.nl/api/objects?page=0&lat=${sLat}&lng=${sLng}&distance=50000&limit=1500`;
        if (window.currentFilters && window.currentFilters.length > 0) {
            window.currentFilters.forEach(f => apiUrl += `&filter[facilities][]=${f}`);
        }
        
        const contents = await fetchWithRetry(apiUrl);

        if (!contents || contents.trim().startsWith("<!doctype") || contents.trim().startsWith("<html") || contents.includes("Internal Server Error")) {
            const doc = new DOMParser().parseFromString(contents, 'text/html');
            const title = doc.title || "Foutpagina";
            logDebug("SVR meldt: " + title);
            if (contents.toLowerCase().includes("login") || contents.toLowerCase().includes("inloggen")) {
                logDebug("HINT: Inloggen op SVR.nl vereist!");
            }
            throw new Error("SVR stuurde HTML ipv JSON");
        }

        const data = JSON.parse(contents);
        const objects = (data.objects || []).filter(o => o.properties && o.properties.type_camping !== 3);
        logDebug("Gevonden: " + objects.length);
        objects.forEach(o => { o.distM = o.geometry ? calculateDistance(sLat, sLng, o.geometry.coordinates[1], o.geometry.coordinates[0]) : 999999; });
        objects.sort((a, b) => a.distM - b.distM);
        renderResults(objects, sLat, sLng);
        setTimeout(() => map.invalidateSize(), 500);
    } catch (e) { logDebug("Search fout: " + e.message); }
    finally { $('#loading-overlay').hide(); isSearching = false; }
}

async function renderDetail(objectId) {
    $('#loading-overlay').css('display', 'flex'); // Show loading spinner
    try {
        const PROXY_BASE_URL = 'https://svr-proxy-worker.e60-manuels.workers.dev';
        const detailUrl = `${PROXY_BASE_URL}/object/${objectId}`;
        
        logDebug(`Fetching SVR detail page for ${objectId} via proxy: ${detailUrl}`);
        const htmlContent = await fetchWithRetry(detailUrl);

        if (!htmlContent || htmlContent.trim().startsWith("<!doctype") || htmlContent.trim().startsWith("<html") || htmlContent.includes("Internal Server Error")) {
            const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
            const title = doc.title || "Foutpagina";
            logDebug("SVR meldt (Detail): " + title);
            if (htmlContent.toLowerCase().includes("login") || htmlContent.toLowerCase().includes("inloggen")) {
                logDebug("HINT: Inloggen op SVR.nl vereist!");
            }
            throw new Error("SVR stuurde HTML ipv verwachte detailpagina");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Find the main content area of the SVR detail page
        // This might need adjustment based on the actual SVR page structure
        const mainContent = doc.querySelector('.details-campings'); // Assuming .details-campings is the main container
        
        if (mainContent) {
            $('#detail-container').empty().append(mainContent.innerHTML);
            applyState({ view: 'detail' }); // Ensure the detail view is visible
        } else {
            $('#detail-container').empty().append('<div style="padding:20px;text-align:center;">Detailpagina niet gevonden of kon niet worden geparst.</div>');
            applyState({ view: 'detail' });
            logDebug(`Could not find '.details-campings' in fetched SVR HTML for ${objectId}.`);
        }

    } catch (e) {
        logDebug("Detailpagina Fout: " + e.message);
        $('#detail-container').empty().append(`<div style="padding:20px;text-align:center;">Fout bij laden detailpagina: ${e.message}</div>`);
        applyState({ view: 'detail' });
    } finally {
        $('#loading-overlay').hide();
    }
}

function renderResults(objects, cLat, cLng) {
    markerCluster.clearLayers(); top10Layer.clearLayers(); $('#resultsList').empty();
    if (objects.length === 0) { $('#resultsList').append('<div style="padding:20px;text-align:center;">Geen campings gevonden.</div>'); return; }
    const bounds = L.latLngBounds([cLat, cLng]);
    objects.forEach((obj, index) => {
        const p = obj.properties, g = obj.geometry; if (!g) return;
        const lat = g.coordinates[1], lng = g.coordinates[0], safeName = btoa(unescape(encodeURIComponent(p.name)));
        const marker = L.marker([lat, lng]);
        const popup = `<div style="min-width:200px;">
            <h5 style="color:#008AD3;font-family:'Befalow';font-size:20px;margin:0;cursor:pointer;" onclick="window.openSVRDetailProxy('${obj.id}')">${p.name}</h5>
            <div style="font-size:12px;color:#666;">${p.city}</div>
            <div style="margin-top:10px;display:flex;gap:10px;">
                <button onclick="window.openNavHelper(${lat},${lng},'${safeName}')" style="flex:1;background:#FDCC01;border:none;padding:5px;border-radius:5px;font-weight:bold;">ROUTE</button>
            </div>
        </div>`;
        marker.bindPopup(popup);
        if (index < 10) { top10Layer.addLayer(marker); bounds.extend([lat, lng]); } else markerCluster.addLayer(marker);
        
        const card = `<div class="camping-card">
            <div class="card-body">
                <h3>${p.name}</h3>
                <div class="card-location"><i class="fa-solid fa-map-pin"></i> ${p.city}</div>
                <div class="card-distance"><i class="fa-solid fa-map-pin"></i> Afstand: ${(obj.distM/1000).toFixed(1)} km</div>
            </div>
            <div class="camping-actions">
                <a href="#" class="action-btn btn-kaart" onclick="map.setView([${lat},${lng}], 15); applyState({view:'map'}); return false;"><i class="fa-solid fa-map"></i> KAART</a>
                <a href="#" class="action-btn btn-route" onclick="window.openNavHelper(${lat}, ${lng}, '${safeName}'); return false;"><i class="fa-solid fa-route"></i> ROUTE</a>
                <a href="#" class="action-btn btn-info" onclick="window.openSVRDetailProxy('${obj.id}'); return false;"><i class="fa-solid fa-circle-info"></i> INFO</a>
            </div>
        </div>`;
        $('#resultsList').append(card);
    });
    map.fitBounds(bounds, { padding: [50, 50] });
}

window.showHelp = function() {
    const dynamicText = document.getElementById('dynamic-help-text');
    if (isListView) { dynamicText.innerText = 'Terug naar boven scrollen'; } 
    else { dynamicText.innerText = 'Toon jouw huidige locatie'; }
    document.getElementById('help-overlay').style.display = 'block';
};

// === LOGIN FUNCTIONALITEIT VOOR SVR PWA ===
async function checkSession() {
  try {
    const sessionId = localStorage.getItem('svr_session_id');
    const options = { headers: {} };

    if (sessionId) {
      options.headers['X-SVR-Session'] = sessionId;
      console.log('✅ Found session ID in localStorage, attempting to validate:', sessionId.substring(0, 20) + '...');
    } else {
      console.log('❌ No session ID found in localStorage.');
      return false;
    }
    
    const response = await fetch('https://svr-proxy-worker.e60-manuels.workers.dev/api/objects?page=0&lat=52.1326&lng=5.2913&distance=1&limit=1', options);
    
    if (response.ok) {
      console.log('✅ Bestaande sessie is nog geldig');
      return true;
    } else if (response.status === 401) {
      console.log('❌ Sessie verlopen (401), opnieuw inloggen vereist');
      localStorage.removeItem('svr_session_id'); // Clear invalid session
      return false;
    }
    console.log(`❌ Ongeldige sessie: Status ${response.status}`);
    localStorage.removeItem('svr_session_id'); // Clear invalid session
    return false;
  } catch (error) {
    console.error('Session check failed:', error);
    localStorage.removeItem('svr_session_id'); // Clear session on network error
    return false;
  }
}

async function loginToSVR(email, password) {
  try {
    const response = await fetch('https://svr-proxy-worker.e60-manuels.workers.dev/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      // credentials: 'include' // Removed, as we manually manage session via localStorage and custom header
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.session_id) {
        localStorage.setItem('svr_session_id', data.session_id);
        console.log('✅ Session ID stored in localStorage:', data.session_id.substring(0, 20) + '...');
      } else {
        console.warn('Login successful but no session_id received in response.');
      }
      console.log('✅ Login succesvol:', data.message || 'Geen bericht');
      return true;
    } else {
      let errorData;
      try {
        errorData = await response.json(); // Probeer als JSON te parsen
      } catch (jsonError) {
        // Als JSON parsen faalt, haal dan de ruwe tekst op
        errorData = { message: `Worker error (non-JSON response): ${await response.text()}`, details: jsonError.message };
      }
      console.error('❌ Login mislukt:', errorData.message || errorData.details || 'Onbekende fout');
      alert('Login mislukt: ' + (errorData.message || errorData.details || 'Onbekende fout'));
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login fout: ' + error.message);
    return false;
  }
}

window.showLoginScreen = function() {
  if (document.getElementById('login-overlay')) return;

  const loginHtml = `
    <div id="login-overlay" style="
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 10000;
    ">
      <div style="
        background: white; padding: 30px; border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; width: 90%;
      ">
        <h2 style="margin-top: 0; color: #333;">SVR Login</h2>
        <p style="color: #666; margin-bottom: 20px;">Log in om de app te gebruiken</p>
        
        <input type="email" id="svr-email" placeholder="Email" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; font-size: 16px;">
        <input type="password" id="svr-password" placeholder="Wachtwoord" style="width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; font-size: 16px;">
        
        <button id="svr-login-btn" style="width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold;">Inloggen</button>
        <div id="login-error" style="color: red; margin-top: 15px; display: none;"></div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', loginHtml);
  
  document.getElementById('svr-login-btn').addEventListener('click', async () => {
    const email = document.getElementById('svr-email').value;
    const password = document.getElementById('svr-password').value;
    
    if (!email || !password) {
      const err = document.getElementById('login-error');
      err.textContent = 'Vul email en wachtwoord in';
      err.style.display = 'block';
      return;
    }
    
    const btn = document.getElementById('svr-login-btn');
    btn.textContent = 'Bezig met inloggen...';
    btn.disabled = true;
    
    const success = await loginToSVR(email, password);
    
    if (success) {
      document.getElementById('login-overlay').remove();
      window.initializeApp();
    } else {
      btn.textContent = 'Inloggen';
      btn.disabled = false;
      const err = document.getElementById('login-error');
      err.textContent = 'Login mislukt, probeer opnieuw';
      err.style.display = 'block';
    }
  });
  
  document.getElementById('svr-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('svr-login-btn').click();
  });
}

async function initApp() {
  console.log('🚀 SVR PWA Start - Checking session...');
  const hasValidSession = await checkSession();
  
  if (hasValidSession) {
    console.log('✅ Sessie geldig, app starten...');
    window.initializeApp();
  } else {
    console.log('❌ Geen geldige sessie, login scherm tonen...');
    window.showLoginScreen();
  }
}

window.initializeApp = function() {
    history.replaceState({ view: 'map' }, "");
    setTimeout(() => performSearch(), 500);
    if (!localStorage.getItem('svr_help_shown')) {
        setTimeout(() => { window.showHelp(); localStorage.setItem('svr_help_shown', 'true'); }, 2500);
    }
};

$(document).ready(() => {
    initApp();
});