// PWA Detection and Installation Prompt
// V91: iOS BLOCKING, Android OPTIONAL
// V91: Ultra-simplified - single iOS instruction with Safari note

// Detect if running as installed PWA
function isStandalonePWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Check if iOS Safari (not installed as PWA)
function isIOSSafari() {
  const ua = navigator.userAgent;

  // Check for explicit iOS devices
  const isExplicitIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  // Check for iPadOS masquerading as Mac (iPadOS 13+)
  // iPad reports as "Macintosh" but has touch support
  const isMacWithTouch = /Macintosh/.test(ua) && navigator.maxTouchPoints > 0;

  const isIOS = isExplicitIOS || isMacWithTouch;

  // Exclude other browsers on iOS - all iOS browsers use Safari's WebKit but aren't Safari
  // Firefox: FxiOS or Firefox/, Chrome: CriOS, Edge: EdgiOS/EdgA, Opera: OPiOS/OPR
  const isOtherBrowser = /FxiOS|Firefox\/|CriOS|EdgiOS|EdgA|OPiOS|OPR/i.test(ua);
  if (isOtherBrowser) {
    console.log('🔍 Other browser detected on iOS:', ua);
    return false; // Not Safari, it's another browser
  }

  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari && !isStandalonePWA();
}


// Show iOS "Add to Home Screen" instructions (BLOCKING)
function showIOSInstallPrompt() {
  const prompt = document.getElementById('pwaInstallPrompt');
  const standardPWAContent = document.getElementById('standardPWAContent');
  const iosInstructions = document.getElementById('iosInstructions');
  const androidBtn = document.getElementById('androidInstallBtn');
  const dismissBtn = document.getElementById('androidDismissBtn');

  if (!prompt || !iosInstructions) {
    console.warn('⚠️ PWA prompt elements not found');
    return;
  }

  // Show standard PWA content and iOS prompt
  prompt.classList.remove('hidden');
  if (standardPWAContent) {
    standardPWAContent.classList.remove('hidden');
  }
  iosInstructions.classList.remove('hidden');

  // Explicitly hide AND remove Android buttons (defensive - use both methods)
  if (androidBtn) {
    androidBtn.classList.add('hidden');
    androidBtn.style.display = 'none';  // Force hide with inline style
  }
  if (dismissBtn) {
    dismissBtn.classList.add('hidden');
    dismissBtn.style.display = 'none';  // Force hide with inline style
  }

  console.log('📱 iOS/iPad detected - showing BLOCKING Add to Home Screen instructions');
  console.log('📱 User agent:', navigator.userAgent);
  console.log('📱 Touch points:', navigator.maxTouchPoints);
  console.log('📱 Android buttons hidden:', androidBtn ? 'YES' : 'NOT FOUND', dismissBtn ? 'YES' : 'NOT FOUND');

  // Block navigation - user MUST install on iOS
  const startBtn = document.getElementById('startButton');
  if (startBtn) {
    startBtn.setAttribute('disabled', 'true');
    startBtn.style.opacity = '0.5';
    startBtn.style.cursor = 'not-allowed';
    startBtn.title = 'iOS requires PWA installation';
  }
}

// Show Android "Install App" prompt (NON-BLOCKING - optional)
function showAndroidInstallPrompt(deferredPrompt) {
  const prompt = document.getElementById('pwaInstallPrompt');
  const androidBtn = document.getElementById('androidInstallBtn');

  if (!prompt || !androidBtn) {
    console.warn('⚠️ PWA prompt elements not found');
    return;
  }

  // Show prompt but DON'T block
  prompt.classList.remove('hidden');
  androidBtn.classList.remove('hidden');

  // Add dismiss button for Android
  const dismissBtn = document.getElementById('androidDismissBtn');
  if (dismissBtn) {
    dismissBtn.classList.remove('hidden');
    dismissBtn.onclick = () => {
      prompt.classList.add('hidden');
      console.log('📲 Android user dismissed PWA prompt - continuing in browser');
    };
  }

  console.log('🤖 Android detected - showing OPTIONAL install button');

  androidBtn.onclick = async () => {
    console.log('📲 Install button clicked, showing native prompt...');
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`📲 User choice: ${outcome}`);

    if (outcome === 'accepted') {
      prompt.classList.add('hidden');
      console.log('✅ PWA installation accepted');
    } else {
      console.log('❌ PWA installation declined - user can still continue in browser');
    }
  };

  // Android: DON'T block start button - let them continue in browser
  console.log('✅ Android: Start button enabled - browser usage allowed');
}

// Initialize PWA detection (BLOCKING on iOS only)
function initPWADetection() {
  console.log('🔍 V91: Checking PWA mode...');
  console.log('🔍 User Agent:', navigator.userAgent);
  console.log('🔍 Touch Points:', navigator.maxTouchPoints);
  console.log('🔍 Standalone:', window.matchMedia('(display-mode: standalone)').matches);

  // Show debug info on screen
  const updateDebugInfo = () => {
    const ua = navigator.userAgent;
    const hasMac = /Macintosh/.test(ua);
    const hasIPad = /iPad/.test(ua);
    const hasIPhone = /iPhone/.test(ua);
    const touchPoints = navigator.maxTouchPoints;

    document.getElementById('debugPlatform').textContent =
      hasIPad ? 'iPad' :
      hasIPhone ? 'iPhone' :
      hasMac ? `Mac (touch: ${touchPoints})` :
      'Other';
    document.getElementById('debugTouch').textContent = touchPoints;

    // Show browser type in debug
    document.getElementById('debugIOS').textContent =
      isIOSSafari() ? 'YES (Safari)' :
      'NO';

    // Show full user agent string for debugging
    if (document.getElementById('debugUA')) {
      document.getElementById('debugUA').textContent = ua;
    }
  };
  updateDebugInfo();

  if (isStandalonePWA()) {
    console.log('✅ Running as PWA - full access granted');
    return true;
  }

  // Check for iOS Safari
  const isiOS = isIOSSafari();
  console.log('🔍 iOS Safari Detection Result:', isiOS);

  if (isiOS) {
    console.warn('⚠️ iOS/iPad Safari - PWA installation REQUIRED (BLOCKING)');
    showIOSInstallPrompt();
    return false; // Block on iOS
  } else {
    console.log('🤖 Android/Desktop - PWA optional, browser usage allowed');

    // Listen for beforeinstallprompt (Android/Desktop)
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📲 beforeinstallprompt event fired');
      e.preventDefault();
      deferredPrompt = e;
      showAndroidInstallPrompt(deferredPrompt);
    });

    return true; // Allow browser usage on Android
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isStandalonePWA, initPWADetection };
}
