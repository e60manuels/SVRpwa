# Lighthouse Prestatierapport Analyse - SVR PWA

**Datum Analyse:** donderdag 5 februari 2026
**Initiële Performance Score:** 48

## Samenvatting Belangrijkste Metrieken:

*   **Overall Performance Score:** 48 (Behoeft aanzienlijke verbetering)
*   **Largest Contentful Paint (LCP):** 15.1 seconden (Score: 0)
    *   *Kritiek punt: Dit duidt op een zeer trage weergave van het grootste inhoudselement op de pagina, wat de gebruikerservaring negatief beïnvloedt.*
*   **Total Blocking Time (TBT):** 1.060 ms (Score: 0.25)
    *   *Matig: Dit geeft aan dat de hoofddraad te lang bezet is, wat leidt tot een minder responsieve pagina.*
*   **Time to Interactive (TTI):** 15.1 seconden (Score: 0.07)
    *   *Kritiek punt: De pagina is gedurende een zeer lange tijd niet interactief voor de gebruiker.*
*   **First Contentful Paint (FCP):** 2.2 seconden (Score: 0.78)
    *   *Redelijk: De eerste inhoud wordt relatief snel weergegeven, maar er is ruimte voor optimalisatie.*
*   **Speed Index (SI):** 4.3 seconden (Score: 0.76)
    *   *Redelijk: De snelheid waarmee de pagina visueel wordt gevuld, kan verbeterd worden.*
*   **Cumulative Layout Shift (CLS):** 0 (Score: 1)
    *   *Uitstekend: Er zijn geen onverwachte lay-outverschuivingen gedetecteerd, wat een stabiele gebruikerservaring garandeert.*

## Belangrijkste Verbeterpunten en Aanbevelingen:

De lage performance score wordt voornamelijk veroorzaakt door de extreem hoge LCP, TBT en TTI waarden. Dit zijn de meest kritieke gebieden om aan te pakken.

### 1. Afbeeldingsoptimalisatie (Audit: "Serves images with low resolution")
*   **Probleem:** OpenStreetMap tegels worden gemarkeerd voor een lage resolutie of het niet responsief zijn. Dit kan leiden tot onscherpe weergave op schermen met een hoge pixeldichtheid (DPR) of onnodig grote bestandsgroottes als ze wel een hoge resolutie hebben, maar door CSS worden verkleind. Dit kan ook bijdragen aan een hogere LCP als deze afbeeldingen deel uitmaken van het LCP-element.
*   **Aanbeveling:**
    *   Zorg ervoor dat kaarttegels en andere afbeeldingen worden geleverd in de juiste resoluties voor verschillende apparaten (gebruik `srcset` en `sizes`).
    *   Overweeg het gebruik van moderne afbeeldingsformaten (bijv. WebP) indien dit nog niet gebeurt.
    *   Onderzoek hoe Leaflet.js omgaat met Retina-schermen of hogere DPR's om te zien of hier optimalisaties mogelijk zijn.

### 2. JavaScript Executietijd Verminderen (Audits: "Minimize main-thread work", "JavaScript execution time")
*   **Probleem:** Hoge TBT en TTI worden voornamelijk veroorzaakt door buitensporige JavaScript-executie op de hoofddraad. De hoofddraad is gedurende een aanzienlijke tijd (2.8 seconden) bezet, wat direct bijdraagt aan de hoge TBT.
*   **Aanbeveling:**
    *   **Minimaliseer JavaScript payloads:** Identificeer en verwijder ongebruikte JavaScript (door middel van tree-shaking en code-splitting).
    *   **Stel niet-kritieke JavaScript uit:** Laad scripts pas wanneer ze nodig zijn (`defer` of `async` attributen) of nadat de belangrijkste inhoud is weergegeven.
    *   **Optimaliseer langlopende taken:** Splits langlopende JavaScript-taken op in kleinere, asynchrone brokken om de hoofddraad minder lang te blokkeren.
    *   **Beoordeel scripts van derden:** Evalueer of alle scripts van derden (bijv. jQuery, Swiper.js, Leaflet.js en zijn plugins, Font Awesome) essentieel zijn en optimaliseer hun laadgedrag.

### 3. Largest Contentful Paint (LCP) Verbeteren
*   **Probleem:** Een LCP van 15.1 seconden is een kritiek probleem. Dit betekent dat het grootste element op het scherm zeer lang nodig heeft om te worden weergegeven.
*   **Aanbeveling:**
    *   **Identificeer het LCP-element:** Bepaal welk element op de pagina het LCP-element is. Gebruik hiervoor de Lighthouse-rapportage zelf (visuele weergave) of Chrome DevTools.
    *   **Optimaliseer de LCP-bron:** Als het een afbeelding is, zorg dan voor optimale compressie, het juiste formaat en een efficiënte levering (preloaden).
    *   **Verminder de serverresponstijd voor de LCP-bron:** Zorg ervoor dat de server de bron snel levert. Overweeg CDN-optimalisaties.
    *   **Elimineer render-blokkerende bronnen:** Minimaliseer CSS en JavaScript die de weergave van het LCP-element vertragen.

Dit rapport kan dienen als een startpunt voor de optimalisatie van de PWA-prestaties.