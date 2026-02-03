// Variables
let deferredPrompt = null;
const installBanner = document.getElementById('install-banner');
const installButton = document.getElementById('install-button');
const closeBanner = document.getElementById('close-banner');

// Check if the app is already installed
function isAppInstalled() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  if (window.navigator.standalone === true) {
    return true;
  }
  return false;
}

// Check localStorage for user preference - used for re-showing after dismissal
function shouldShowBannerAgain() {
  const dismissed = localStorage.getItem('install-banner-dismissed');
  const dismissedDate = localStorage.getItem('install-banner-dismissed-date');
  
  if (dismissed && dismissedDate) {
    const daysSinceDismissed = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
    return daysSinceDismissed > 90; // Re-show after 90 days
  }
  
  return true; // Show if not dismissed
}

// Show installation promotion
function showInstallPromotion() {
  if (isAppInstalled()) {
    return;
  }
  
  // Banner will always be shown initially if not installed and not permanently dismissed
  // `shouldShowBannerAgain` only prevents re-showing after a recent dismissal.
  installBanner.style.display = 'flex'; // Use flex to center content
}

// Hide installation promotion
function hideInstallPromotion() {
  if (installBanner) {
      installBanner.style.display = 'none';
  }
}

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Update UI to notify the user they can install the PWA
  // The banner is already visible, now enable the install button
  if (installButton) {
      installButton.disabled = false; // Activate the button
      installButton.textContent = 'Installeren'; // Ensure text is correct
  }
});

// Install button click handler
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    
    installButton.disabled = true; // Disable button immediately
    installButton.textContent = 'Bezig met installeren...'; // Provide feedback

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to the install prompt: ${outcome}`);
    
    hideInstallPromotion();
    deferredPrompt = null;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA installation prompt');
    } else {
      console.log('User dismissed the PWA installation prompt');
    }
  });
}

// Close button click handler
if (closeBanner) {
  closeBanner.addEventListener('click', () => {
    hideInstallPromotion();
    localStorage.setItem('install-banner-dismissed', 'true');
    localStorage.setItem('install-banner-dismissed-date', Date.now().toString());
  });
}

// Detect when the app is actually installed
window.addEventListener('appinstalled', (evt) => {
  console.log('PWA was successfully installed');
  hideInstallPromotion();
});

// iOS detection
function isIOS() {
  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
}

// Show iOS installation instructions (if applicable)
function showIOSInstructions() {
  if (isAppInstalled()) {
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
          document.getElementById('ios-install-instructions').remove();
          localStorage.setItem('install-banner-dismissed', 'true');
          localStorage.setItem('install-banner-dismissed-date', Date.now().toString());
      });
  }
}

// Initial check when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Always show banner/instructions if not installed, and not permanently dismissed yet
  if (!isAppInstalled()) {
      if (shouldShowBannerAgain()) { // Check if we should show again (after 90 days)
          if (isIOS()) {
              showIOSInstructions();
          } else {
              showInstallPromotion(); // For Android/Desktop, show the banner immediately
          }
      }
  }
});