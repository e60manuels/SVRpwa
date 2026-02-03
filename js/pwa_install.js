// Variables
let deferredPrompt = null;
const installBanner = document.getElementById('install-banner');
const installButton = document.getElementById('install-button');
const closeBanner = document.getElementById('close-banner');

// Local Debugging function
function logDebug(msg) {
    console.log(`[PWA_INSTALL] ${msg}`);
}

// Check if the app is already installed
function isAppInstalled() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    logDebug("App is reeds geïnstalleerd (standalone mode).");
    return true;
  }
  if (window.navigator.standalone === true) { // For older iOS
    logDebug("App is reeds geïnstalleerd (iOS standalone).");
    return true;
  }
  logDebug("App is nog niet geïnstalleerd.");
  return false;
}

// Check localStorage for user preference - used for re-showing after dismissal
function shouldShowBannerAgain() {
  const dismissed = localStorage.getItem('install-banner-dismissed');
  const dismissedDate = localStorage.getItem('install-banner-dismissed-date');
  
  if (dismissed && dismissedDate) {
    const daysSinceDismissed = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed > 90) {
        logDebug("Installatiebanner was afgewezen, maar 90 dagen zijn verstreken. Toon opnieuw.");
        return true; // Re-show after 90 days
    } else {
        logDebug(`Installatiebanner afgewezen ${Math.floor(daysSinceDismissed)} dagen geleden. Wacht nog.`);
        return false;
    }
  }
  
  logDebug("Installatiebanner nog niet eerder afgewezen.");
  return true; // Show if not dismissed
}

// Show installation promotion
function showInstallPromotion() {
  logDebug("showInstallPromotion() aangeroepen.");
  if (isAppInstalled()) {
    logDebug("showInstallPromotion: App is al geïnstalleerd, toon banner niet.");
    return;
  }
  
  // Toon de banner alleen als deze niet is afgewezen, of als de 90 dagen voorbij zijn
  if (!shouldShowBannerAgain()) {
      logDebug("showInstallPromotion: Banner mag niet opnieuw worden getoond.");
      return;
  }

  if (installBanner) {
    installBanner.style.display = 'flex'; // Use flex to center content
    logDebug("Installatiebanner wordt getoond.");
  } else {
    logDebug("showInstallPromotion: installBanner element niet gevonden.");
  }
}

// Hide installation promotion
function hideInstallPromotion() {
  if (installBanner) {
      installBanner.style.display = 'none';
      logDebug("Installatiebanner verborgen.");
  } else {
      logDebug("hideInstallPromotion: installBanner element niet gevonden.");
  }
}

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  logDebug("beforeinstallprompt event afgevuurd.");
  e.preventDefault();
  deferredPrompt = e;
  
  logDebug("deferredPrompt ingesteld. Activeer de installatieknop.");
  if (installButton) {
      installButton.disabled = false; // Activate the button
      installButton.textContent = 'Installeren'; // Ensure text is correct
      logDebug("Installatieknop geactiveerd.");
  } else {
      logDebug("beforeinstallprompt: installButton element niet gevonden.");
  }
  
  // Zorg dat de banner zichtbaar is als het event afgaat en de knop is geactiveerd
  showInstallPromotion();
});

// Install button click handler
if (installButton) {
  installButton.addEventListener('click', async () => {
    logDebug("Installatieknop geklikt.");
    if (!deferredPrompt) {
      logDebug("Installatieknop geklikt, maar deferredPrompt is null.");
      return;
    }
    
    installButton.disabled = true; // Disable button immediately
    installButton.textContent = 'Bezig met installeren...'; // Provide feedback
    logDebug("Installatieproces gestart.");

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    logDebug(`Gebruiker reactie op installatieprompt: ${outcome}`);
    
    hideInstallPromotion();
    deferredPrompt = null;
    
    if (outcome === 'accepted') {
      logDebug('Gebruiker heeft de PWA installatieprompt geaccepteerd.');
    } else {
      logDebug('Gebruiker heeft de PWA installatieprompt afgewezen.');
    }
  });
}

// Close button click handler
if (closeBanner) {
  closeBanner.addEventListener('click', () => {
    logDebug("Sluitknop geklikt. Banner verbergen en voorkeur opslaan.");
    hideInstallPromotion();
    localStorage.setItem('install-banner-dismissed', 'true');
    localStorage.setItem('install-banner-dismissed-date', Date.now().toString());
  });
}

// Detect when the app is actually installed
window.addEventListener('appinstalled', (evt) => {
  logDebug('PWA is succesvol geïnstalleerd.');
  hideInstallPromotion();
});

// iOS detection
function isIOS() {
  const userAgent = window.navigator.userAgent;
  const isIosDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  logDebug(`isIOS(): ${isIosDevice}`);
  return isIosDevice;
}

// Show iOS installation instructions (if applicable)
function showIOSInstructions() {
  logDebug("showIOSInstructions() aangeroepen.");
  if (isAppInstalled()) {
    logDebug("showIOSInstructions: App is al geïnstalleerd, toon instructies niet.");
    return;
  }

  if (!shouldShowBannerAgain()) {
      logDebug("showIOSInstructions: Instructies mogen niet opnieuw worden getoond.");
      return;
  }

  // Hide the regular install banner if it's visible (for iOS, this is never shown initially)
  hideInstallPromotion();

  const iosInstructionsHtml = `
    <div id="ios-install-instructions" style="
      position: fixed; bottom: 0; left: 0; right: 0;
      background: white; padding: 20px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      z-index: 9998; text-align: center;
    ">
      <p style="margin-top:0; font-weight: bold; color: #333;">Installeer SVR Campings op je iPhone/iPad:</p>
      <ol style="padding-left: 20px; text-align: left; color: #555;">
        <li>Tik op het deel-icoon <span style="font-size: 1.5em; vertical-align: middle;">⇧</span> onderin de browser.</li>
        <li>Scroll naar beneden en tik op 'Zet op beginscherm'.</li>
        <li>Tik op 'Voeg toe' rechtsboven.</li>
      </ol>
      <button id="close-ios-instructions" style="
        background: var(--svr-blue); color: white; border: none; padding: 10px 20px;
        border-radius: 5px; margin-top: 15px; cursor: pointer;
      ">Begrepen</button>
    </div>
  `;

  if (!document.getElementById('ios-install-instructions')) {
      document.body.insertAdjacentHTML('beforeend', iosInstructionsHtml);
      document.getElementById('close-ios-instructions').addEventListener('click', () => {
          logDebug("iOS instructies gesloten. Voorkeur opslaan.");
          document.getElementById('ios-install-instructions').remove();
          localStorage.setItem('install-banner-dismissed', 'true');
          localStorage.setItem('install-banner-dismissed-date', Date.now().toString());
      });
      logDebug("iOS installatie-instructies getoond.");
  } else {
      logDebug("iOS installatie-instructies zijn reeds zichtbaar.");
  }
}

// Initial check when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  logDebug("DOMContentLoaded event afgevuurd.");
  if (!isAppInstalled()) {
      logDebug("App is nog niet geïnstalleerd.");
      if (shouldShowBannerAgain()) {
          if (isIOS()) {
              logDebug("Platform is iOS. Toon iOS instructies.");
              showIOSInstructions();
          } else {
              logDebug("Platform is niet iOS. Toon installatiebanner.");
              showInstallPromotion(); // For Android/Desktop, show the banner immediately
          }
      } else {
          logDebug("Banner is eerder afgewezen en mag nog niet opnieuw worden getoond.");
      }
  } else {
      logDebug("App is al geïnstalleerd, installatie-prompt niet tonen.");
  }
});