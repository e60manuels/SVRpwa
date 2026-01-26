(function () {
    if (window.SVR_FILTER_OVERLAY_INJECTED) return;
    window.SVR_FILTER_OVERLAY_INJECTED = true;

    // --- DEBUG LOGGING ---
    function logDebug(msg) {
        console.log(msg);
        let debugDiv = document.getElementById('debug-console');
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.id = 'debug-console';
            debugDiv.style = "position:fixed;bottom:0;left:0;width:100%;max-height:100px;overflow-y:auto;background:rgba(0,0,0,0.8);color:white;font-size:10px;z-index:9999;pointer-events:none;padding:5px;";
            document.body.appendChild(debugDiv);
        }
        const p = document.createElement('p');
        p.style.margin = "2px 0";
        p.innerText = "[" + new Date().toLocaleTimeString() + "] " + msg;
        debugDiv.appendChild(p);
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
    window.logDebug = logDebug;
    logDebug("SVR PWA Start...");

    // --- CSV & SEARCH LOGIC ---
    window.allLocations = [];
    async function loadLocations() {
        try {
            logDebug("Laden van locaties CSV...");
            const res = await fetch('assets/Woonplaatsen_in_Nederland.csv');
            if (!res.ok) throw new Error("Status: " + res.status);
            const text = await res.text();
            const lines = text.split('\n');
            window.allLocations = lines.slice(1).map(line => {
                const parts = line.split(';');
                if (parts.length >= 2) {
                    return { name: parts[0].trim(), province: parts[1].trim() };
                }
                return null;
            }).filter(l => l && l.name);
            logDebug("CSV geladen: " + window.allLocations.length + " items");
        } catch (e) {
            logDebug("Fout bij laden CSV: " + e.message);
        }
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
            logDebug("Geocoding voor: " + locationName);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ", Nederland")}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
            }
        } catch (e) {
            logDebug("Geocoding fout: " + e.message);
        }
        return null;
    };

    // Proxy helper om CORS te omzeilen (voor test-doeleinden)
    function proxyUrl(url) {
        return "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    }

    // Helper voor navigatie (vervangt Android.openNavigation)
    window.openNavHelper = function(lat, lng, nameEnc) {
        try {
            const name = decodeURIComponent(escape(window.atob(nameEnc)));
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            window.open(url, '_blank');
        } catch(e) {
            logDebug("Navigatie fout: " + e.message);
        }
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
        .svr-overlay-header { 
            background-color: #f0f0f0; padding: 8px 15px 12px 15px; 
            display: flex; flex-direction: column; align-items: flex-start;
            border-top-left-radius: 12px; border-top-right-radius: 12px; 
        }
        .svr-overlay-title { 
            font-size: 1.2rem; font-weight: bold; margin: 0; color: #008AD3; 
            font-family: 'Befalow', sans-serif; text-align: left; 
            padding-left: 15px;
        }
        #svr-filter-overlay-content { 
            flex-grow: 1; overflow-y: auto; width: 100%; background-color: #f0f0f0; padding: 15px; box-sizing: border-box; 
            scroll-behavior: smooth; scroll-padding-top: 15px;
        }
        #active-filters-holder { 
            background: #FDCC01; border-radius: 12px; padding: 12px 15px; margin-bottom: 15px; 
            display: none; box-sizing: border-box; width: 100%;
            position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .active-filter-tag { display: inline-flex; align-items: center; background: white; padding: 4px 10px; border-radius: 15px; margin: 4px; font-size: 12px; font-weight: bold; color: #008AD3; border: 1px solid #ddd; }
        .filter-section-card { background: white; border-radius: 12px; margin-bottom: 10px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .filter-section-header { padding: 12px 15px; background: #FDCC01; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .filter-section-header h4 { margin: 0; font-size: 22px; color: #333; font-family: 'Befalow', sans-serif; }
        .filter-section-header.active i { transform: rotate(180deg); }
        .filter-section-body { padding: 0 15px; display: none; }
        .filter-section-body.show { display: block; padding-bottom: 10px; }
        .svr-overlay-footer { padding: 12px 15px; border-top: 1px solid #ddd; display: flex; gap: 15px; background: #f0f0f0; }
        .svr-footer-btn { 
            flex: 1; height: 40px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
        }
        #svr-filter-apply-btn { background-color: #FDCC01; color: #333; }
        #svr-filter-reset-btn { background-color: white; color: #c0392b; border: 1px solid #ddd; }
        .filter-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f9f9f9; }
    `;
    const style = document.createElement('style'); style.appendChild(document.createTextNode(css)); document.head.appendChild(style);

    const backdrop = document.createElement('div'); backdrop.id = 'svr-filter-backdrop'; document.body.appendChild(backdrop);
    const overlay = document.createElement('div'); overlay.id = 'svr-filter-overlay';
    overlay.innerHTML = `
        <div class="svr-overlay-header" id="filter-drag-header">
            <div style="width: 100%; display: flex; justify-content: center; margin-bottom: 10px; pointer-events: none;">
                <div style="width: 40px; height: 5px; background: #BBB; border-radius: 3px;"></div>
            </div>
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
    const activeHolder = overlay.querySelector('#active-filters-holder');
    const tagsContainer = overlay.querySelector('#active-tags-container');
    const overlayContent = overlay.querySelector('#svr-filter-overlay-content');

    window.closeFilterOverlay = function() { 
        overlay.classList.remove('open'); backdrop.classList.remove('open');
        setTimeout(() => { if (!overlay.classList.contains('open')) backdrop.style.display = 'none'; }, 300);
    };
    backdrop.onclick = window.closeFilterOverlay;

    window.resetFilters = function() {
        overlay.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        window.currentFilters = [];
        document.getElementById('filterBtn').style.background = 'white';
        window.closeFilterOverlay(); window.performSearch();
    };
    overlay.querySelector('#svr-filter-reset-btn').onclick = window.resetFilters;

    window.toggle_filters = async function() {
        backdrop.style.display = 'block';
        setTimeout(() => { overlay.classList.add('open'); backdrop.classList.add('open'); }, 10);
        if (content.children.length === 0) await fetchFilterData();
    };

    async function fetchFilterData() {
        try {
            logDebug("Filters ophalen via proxy...");
            const response = await fetch(proxyUrl('https://www.svr.nl/objects'));
            const html = await response.text();
            logDebug("Filters HTML ontvangen: " + html.length + " chars");
            const parser = new DOMParser(); 
            const doc = parser.parseFromString(html, 'text/html');
            loading.style.display = 'none'; content.innerHTML = '';
            const befalowElements = Array.from(doc.querySelectorAll('.befalow')).filter(el => el.innerText.trim().length > 2);
            logDebug("Filter groepen gevonden: " + befalowElements.length);
            befalowElements.forEach((headerEl) => {
                const title = headerEl.innerText.trim().replace(/:$/, '');
                const sectionCard = document.createElement('div'); sectionCard.className = 'filter-section-card';
                const header = document.createElement('div'); header.className = 'filter-section-header';
                header.innerHTML = `<h4>${title}</h4><i class="fas fa-chevron-down"></i>`;
                const body = document.createElement('div'); body.className = 'filter-section-body';
                header.onclick = () => { header.classList.toggle('active'); body.classList.toggle('show'); };
                
                let nextSib = (headerEl.closest('div.w-100') || headerEl.parentElement).nextElementSibling;
                while (nextSib && !nextSib.querySelector('.befalow') && nextSib.tagName !== 'HR') {
                    if (nextSib.classList.contains('form-check')) {
                        const input = nextSib.querySelector('input');
                        if (input) {
                            const guid = input.getAttribute('data-filter-id') || input.id;
                            const name = nextSib.querySelector('label')?.innerText.trim() || "Onbekend";
                            const item = document.createElement('div'); item.className = 'filter-item';
                            item.innerHTML = `<input type="checkbox" value="${guid}"><label>${name}</label>`;
                            body.appendChild(item);
                        }
                    }
                    nextSib = nextSib.nextElementSibling;
                }
                if (body.children.length > 0) { sectionCard.appendChild(header); sectionCard.appendChild(body); content.appendChild(sectionCard); }
            });
        } catch (e) { logDebug("Filter fout: " + e.message); }
    }

    overlay.querySelector('#svr-filter-apply-btn').onclick = function() {
        const selected = []; overlay.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => selected.push(cb.value));
        window.currentFilters = selected;
        logDebug("Filters toegepast: " + selected.length);
        window.closeFilterOverlay(); window.performSearch();
    };

})();

// --- MAP & CORE LOGIC ---
let isListView = false;
logDebug("Map initialiseren...");
const map = L.map('map', { zoomControl: false }).setView([52.1326, 5.2913], 8);
const markerCluster = L.markerClusterGroup();
const top10Layer = L.featureGroup();
let centerMarker = null;
let currentUserLatLng = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);
map.addLayer(markerCluster); map.addLayer(top10Layer);

map.on('locationfound', (e) => { 
    logDebug("Locatie gevonden: " + e.latlng.lat + "," + e.latlng.lng);
    currentUserLatLng = e.latlng; 
});
map.locate({ watch: true, enableHighAccuracy: true });

$('#locateBtn').on('click', () => {
    if (currentUserLatLng) map.setView(currentUserLatLng, 10);
    else {
        logDebug("Locatie onbekend, nieuwe poging...");
        map.locate({ setView: true, maxZoom: 10 });
    }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dLat = (lat2-lat1) * Math.PI/180, dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function applyState(state) {
    if (!state) return; isListView = (state.view === 'list');
    if (isListView) { $('#map-container').hide(); $('#list-container').show(); $('#toggleView i').attr('class', 'fas fa-map'); }
    else { $('#map-container').show(); $('#list-container').hide(); $('#toggleView i').attr('class', 'fas fa-list'); setTimeout(() => map.invalidateSize(), 100); }
}

window.onpopstate = (e) => applyState(e.state);
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
    const q = $searchInput.val().trim();
    let sLat, sLng;

    if (q) {
        const coords = await window.getCoordinatesWeb(q);
        if (coords) { sLat = coords.latitude; sLng = coords.longitude; }
    }
    
    sLat = sLat || 52.1326; sLng = sLng || 5.2913;
    if (centerMarker) map.removeLayer(centerMarker);
    centerMarker = L.marker([sLat, sLng], { icon: L.divIcon({ className: 'search-marker', html: '<i class="fa-solid fa-map-pin" style="color:#c0392b;font-size:30px;"></i>', iconSize:[30,30], iconAnchor:[15,30] }) }).addTo(map);

    $('#loading-overlay').css('display', 'flex');
    try {
        let apiUrl = `https://www.svr.nl/api/objects?page=0&lat=${sLat}&lng=${sLng}&distance=50000&limit=1500`;
        if (window.currentFilters && window.currentFilters.length > 0) {
            window.currentFilters.forEach(f => apiUrl += `&filter[facilities][]=${f}`);
        }
        
        logDebug("Zoeken via proxy: " + apiUrl);
        const res = await fetch(proxyUrl(apiUrl), { headers: { 'x-requested-with': 'XMLHttpRequest' } });
        const data = await res.json();
        const objects = (data.objects || []).filter(o => o.properties && o.properties.type_camping !== 3);
        logDebug("Resultaten ontvangen: " + objects.length);
        objects.forEach(o => { o.distM = o.geometry ? calculateDistance(sLat, sLng, o.geometry.coordinates[1], o.geometry.coordinates[0]) : 999999; });
        objects.sort((a, b) => a.distM - b.distM);
        renderResults(objects, sLat, sLng);
    } catch (e) { logDebug("Search fout: " + e.message); }
    finally { $('#loading-overlay').hide(); }
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
            <h5 style="color:#008AD3;font-family:'Befalow';font-size:20px;margin:0;cursor:pointer;" onclick="window.location.href='https://www.svr.nl/object/${obj.id}'">${p.name}</h5>
            <div style="font-size:12px;color:#666;">${p.city}</div>
            <div style="margin-top:10px;display:flex;gap:10px;">
                <button onclick="window.openNavHelper(${lat},${lng},'${safeName}')" style="flex:1;background:#FDCC01;border:none;padding:5px;border-radius:5px;font-weight:bold;">ROUTE</button>
            </div>
        </div>`;
        marker.bindPopup(popup);
        if (index < 10) { top10Layer.addLayer(marker); bounds.extend([lat, lng]); } else markerCluster.addLayer(marker);
        
        const card = `<div class="camping-card" style="padding:15px;background:white;margin-bottom:10px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h3 style="margin:0;color:#008AD3;font-family:'Befalow';">${p.name}</h3>
            <p style="margin:5px 0;font-size:14px;">${p.city} - ${(obj.distM/1000).toFixed(1)} km</p>
            <div style="display:flex;gap:10px;margin-top:10px;">
                <button onclick="map.setView([${lat},${lng}], 15); applyState({view:'map'});" style="flex:1;background:#eee;border:none;padding:8px;border-radius:20px;">KAART</button>
                <button onclick="window.location.href='https://www.svr.nl/object/${obj.id}'" style="flex:1;background:#008AD3;color:white;border:none;padding:8px;border-radius:20px;">INFO</button>
            </div>
        </div>`;
        $('#resultsList').append(card);
    });
    map.fitBounds(bounds, { padding: [50, 50] });
}

window.showHelp = function() {
    const dynamicText = document.getElementById('dynamic-help-text');
    if (isListView) {
        dynamicText.innerText = 'Terug naar boven scrollen';
    } else {
        dynamicText.innerText = 'Toon jouw huidige locatie';
    }
    document.getElementById('help-overlay').style.display = 'block';
};

$(document).ready(() => {
    history.replaceState({ view: 'map' }, "");
    setTimeout(() => performSearch(), 500);

    // --- AUTOMATISCHE HULP BIJ EERSTE KEER ---
    if (!localStorage.getItem('svr_help_shown')) {
        setTimeout(() => {
            window.showHelp();
            localStorage.setItem('svr_help_shown', 'true');
        }, 2500);
    }
});