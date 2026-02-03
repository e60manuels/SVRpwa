// Variables
let deferredPrompt = null;
const installBanner = document.getElementById('install-banner');
const installButton = document.getElementById('install-button');
const closeBanner = document.getElementById('close-banner');

// Check if the app is already installed
function isAppInstalled() {
  // For standalone mode (app launched from home screen)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // For iOS - window.navigator.standalone is deprecated but still useful
  if (window.navigator.standalone === true) {
    return true;
  }
  return false;
}

// Check localStorage for user preference
function shouldShowBanner() {
  const dismissed = localStorage.getItem('install-banner-dismissed');
  const dismissedDate = localStorage.getItem('install-banner-dismissed-date');
  
  // If dismissed, re-show banner after 90 days
  if (dismissed && dismissedDate) {
    const daysSinceDismissed = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
    return daysSinceDismissed > 90;
  }
  
  return true; // Show by default if not dismissed
}

// Show installation promotion
function showInstallPromotion() {
  if (isAppInstalled()) {
    return;
  }
  
  if (!shouldShowBanner()) {
    return;
  }
  
  installBanner.style.display = 'flex'; // Use flex to center content
}

// Hide installation promotion
function hideInstallPromotion() {
  installBanner.style.display = 'none';
}

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Update UI to notify the user they can install the PWA
  showInstallPromotion();
});

// Install button click handler
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to the install prompt: ${outcome}`);
    
    // Hide the banner
    hideInstallPromotion();
    
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    
    // Optionally, send analytics event
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
    
    // Save user preference
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
  if (isAppInstalled()) { // Already installed, no need for instructions
    return;
  }

  // Hide the regular install banner if it's visible
  if (installBanner) {
      hideInstallPromotion();
  }

  // Create a modal or dedicated section for iOS instructions
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

  // Check if it's not already shown
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
  if (isIOS() && shouldShowBanner()) {
    // For iOS, if not installed and not dismissed, show instructions
    showIOSInstructions();
  } else if (!isAppInstalled() && shouldShowBanner()) {
    // For other platforms, if not installed and not dismissed, show general banner
    // This will be shown if beforeinstallprompt doesn't fire immediately
    // or if the browser doesn't support it directly.
    // However, for beforeinstallprompt-supporting browsers, it's generally best
    // to wait for the event to decide when to show.
    // This part is mainly for browsers that don't fire beforeinstallprompt.
    // In practice, for Android Chrome, we mostly rely on beforeinstallprompt event.
    // Keep this commented out or minimal to avoid conflicting with beforeinstallprompt.
    // showInstallPromotion();
  }
});