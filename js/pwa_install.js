// Variables
let deferredPrompt = null;
let installBanner, installButton, closeBanner;

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

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  logDebug("beforeinstallprompt event afgevuurd.");
  e.preventDefault();
  deferredPrompt = e;
  
  // The installButton is now a globally declared `let` variable, assigned in DOMContentLoaded.
  // It's safe to access it here after the DOM is loaded.
  // However, `beforeinstallprompt` can fire *before* DOMContentLoaded,
  // so we should check if `installButton` is initialized.
  if (installButton) {
      logDebug("deferredPrompt ingesteld. Activeer de installatieknop.");
      installButton.disabled = false; // Activate the button
      installButton.textContent = 'Installeren'; // Ensure text is correct
      logDebug("Installatieknop geactiveerd.");
  } else {
      logDebug("beforeinstallprompt: installButton element nog niet beschikbaar. Wachten op DOMContentLoaded.");
  }
  // The banner is now shown via window.closeHelpOverlayAndShowPWA() or user interaction
});

// Detect when the app is actually installed
window.addEventListener('appinstalled', (evt) => {
  logDebug('PWA is succesvol geïnstalleerd.');
  // installBanner is a global `let` variable, assigned in DOMContentLoaded.
  // It should be available here if the app is installed *after* DOMContentLoaded.
  if (installBanner) {
    installBanner.style.display = 'none';
  }
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

  // Hide the regular install banner if it's visible. installBanner is global `let`.
  if (installBanner) {
    installBanner.style.display = 'none';
  }


  const iosInstructionsHtml = `
    <div id="ios-install-instructions" class="ios-install-instructions">
      <div class="ios-install-content">
        <button id="close-ios-instructions" class="ios-close-button">
          ✕
        </button>
        <div class="ios-install-icon">
          <img src="icons/icon-192.png" alt="App Icon">
        </div>
        <div class="ios-install-text">
          <p>Installeer de SVR Campings app</p>
        </div>
      </div>
      <div class="ios-install-detailed-instructions">
        <p>Volg deze stappen om de app te installeren:</p>
        <ol>
          <li>Tik op het deel-icoon <span style="font-size: 1.5em; vertical-align: middle;">⇧</span> onderin de browser.</li>
          <li>Scroll naar beneden en tik op 'Zet op beginscherm'.</li>
          <li>Tik op 'Voeg toe' rechtsboven.</li>
        </ol>
      </div>
      <button id="ios-understood-button" class="ios-close-button">
        Begrepen
      </button>
    </div>
  `;

  if (!document.getElementById('ios-install-instructions')) {
      document.body.insertAdjacentHTML('beforeend', iosInstructionsHtml);
      // Attach event listener to the new "Begrepen" button
      document.getElementById('ios-understood-button').addEventListener('click', () => {
          logDebug("iOS instructies gesloten. Voorkeur opslaan.");
          document.getElementById('ios-install-instructions').remove();
          localStorage.setItem('install-banner-dismissed', 'true');
          localStorage.setItem('install-banner-dismissed-date', Date.now().toString());
      });
       // Attach event listener to the new "Close" button (X)
      document.getElementById('close-ios-instructions').addEventListener('click', () => {
          logDebug("iOS instructies gesloten via kruisje. Voorkeur opslaan.");
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

  // Now that DOM is loaded, get elements and assign to global let variables
  installBanner = document.getElementById('install-banner');
  installButton = document.getElementById('install-button');
  closeBanner = document.getElementById('close-banner');

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

  // Expose showInstallPromotion globally
  window.showInstallPromotion = showInstallPromotion;

  if (!isAppInstalled()) {
      logDebug("App is nog niet geïnstalleerd.");
      if (shouldShowBannerAgain()) {
          if (isIOS()) {
              logDebug("Platform is iOS. Toon iOS instructies.");
              showIOSInstructions();
          } else {
              logDebug("Platform is niet iOS. De installatiebanner wordt getoond na sluiten van help-overlay of user-interactie.");
              // showInstallPromotion(); // Removed direct call to showInstallPromotion() here
          }
      } else {
          logDebug("Banner is eerder afgewezen en mag nog niet opnieuw worden getoond.");
      }
  } else {
      logDebug("App is al geïnstalleerd, installatie-prompt niet tonen.");
  }
});