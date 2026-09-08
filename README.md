# SVR Campings PWA

Een Progressive Web App waarmee gebruikers SVR-campings (Stichting Vrije Recreatie) in Nederland en omringende landen kunnen vinden, met kaart- en lijstweergave, zoeken en filteren op faciliteiten.

**Productie:** https://e60manuels.github.io/SVRpwa/
**Staging (test):** https://e60manuels.github.io/SVRpwa-test/

## Snel starten

Geen build-stap nodig — dit is een statische PWA (vanilla HTML/CSS/JS).

```bash
# Serveer de projectroot lokaal, bijvoorbeeld:
python -m http.server 8000
# of
npx serve .
```

Open daarna `http://localhost:8000` in de browser. Gebruik Chrome DevTools → Application om Service Worker en manifest te inspecteren.

## Tech stack

- Vanilla JavaScript (ES6+, IIFE-pattern), geen bundler
- Leaflet.js + markercluster voor de kaart
- jQuery (wordt uitgefaseerd)
- Service Worker voor offline-ondersteuning en caching
- Camping-data via een Cloudflare Worker-proxy naar de SVR-API

## Projectstructuur

```
index.html            App-entrypoint
sw.js                  Service Worker (caching-strategie)
manifest.json          PWA-manifest
js/local_app.js        Hoofdlogica van de app
js/pwa_install.js      Installatiebanner-logica
css/                    Styling
data/campings.json      Statische camping-data (gegenereerd)
assets/                 Statische bronbestanden (o.a. gemeentedata voor zoeken)
build-campings-json.js  Script om camping-data te verversen vanuit de SVR-API
bestanden/              Documentatie, ontwerp-notities en gegenereerde rapporten
```

## Data verversen

```bash
export SVR_EMAIL=jouw@email.com
export SVR_PASSWORD=jouw_wachtwoord
node build-campings-json.js
```

## Deployen

Volg de vaste deploy-volgorde (data → versiebump → changelog → commit → push staging → verifiëren → push productie), zoals beschreven in [`AGENTS.md`](./AGENTS.md#git-remotes).

```bash
git push staging main   # eerst naar staging, https://e60manuels.github.io/SVRpwa-test/
# controleren: versienummer klopt, app laadt, geen consolefouten
git push origin main    # daarna pas naar productie, https://e60manuels.github.io/SVRpwa/
```

Staging is een losstaande GitHub Pages-deployment (aparte repo/origin, dus ook een eigen Service Worker-cachenamespace) om een release eerst echt live te zien draaien vóórdat 'm naar de productie-URL gaat. Er is geen geautomatiseerde testsuite, dus dit is de enige verificatiestap vóór een update die in één keer naar alle gebruikers gaat.

## Meer context

- [`AGENTS.md`](./AGENTS.md) — volledige projectcontext voor AI-coding-agents: architectuur, conventies, changelog per versie en de exacte deploy-stappen. Dit is de gezamenlijke standaard die door meerdere AI-tools wordt gelezen (zie ook `GEMINI.md`, dat hiernaar verwijst).
- [`bestanden/`](./bestanden/) — aanvullende documentatie: modernisatieplan, performance-bevindingen, filter-UI-specificatie en gegenereerde data-rapporten.
