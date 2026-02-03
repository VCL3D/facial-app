// Facial Data Collection - Recorder Module
// Milestone 3: Multi-Video Sequence // #claude

// =============================================================================
// VERSION MARKER - V20 (CLEAN UI + FIXED DURATION) // #claude v82: PWA + iOS fullscreen fix
// =============================================================================
console.log('%c🔥 RECORDER-V20.JS LOADED - V82 🔥', 'background: #0066ff; color: #ffffff; font-size: 20px; font-weight: bold; padding: 10px;'); // #claude v82
console.log('V82: PWA BLOCKING install + iOS fullscreen EXIT+RE-ENTER fix'); // #claude v82
console.log('V81: Fullscreen ENABLED on Android, DISABLED on iOS/iPad'); // #claude v81
console.log('V80: Debug panel restored to diagnose video 2 black screen'); // #claude v80
console.log('V79: Fixed wake lock hanging on iOS - removed await from silentAudio.play()'); // #claude v79
console.log('V78: Added direct console.log to diagnose execution stopping'); // #claude v78
console.log('V77: Added try-catch to start flow + step-by-step confirmation logging'); // #claude v77
console.log('V20: FULLSCREEN + VIDEO STATS + FIXED DURATION CALCULATION'); // #claude

// #claude v80: Debug helper - RE-ENABLED to debug video 2 black screen
function debugLog(message, isError = false) {
    console.log(message); // Log to console
    // #claude v80: Re-enable panel to debug video 2 transition
    const debugPanel = document.getElementById('debugPanel');
    const debugMessages = document.getElementById('debugMessages');
    if (debugPanel && debugMessages) {
        const line = document.createElement('div');
        line.style.color = isError ? '#ff0000' : '#00ff00';
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        debugMessages.appendChild(line);
        // #claude v80: Auto-scroll the PANEL (not just messages) to show latest
        debugPanel.scrollTop = debugPanel.scrollHeight;
        while (debugMessages.children.length > 30) {
            debugMessages.removeChild(debugMessages.firstChild);
        }
    }
}

// #claude v82: Log script initialization immediately
setTimeout(() => {
    console.log('%c🚀 V82 SCRIPT INITIALIZED','background: #0066ff; color: #ffffff; font-size: 16px; padding: 5px;'); // #claude v82
    debugLog('🚀 V82 Script loaded - PWA blocking + iOS fullscreen EXIT+RE-ENTER');
    debugLog('📍 Page: ' + window.location.pathname);
    debugLog('✅ Debug panel initialized');
}, 100); // Small delay to ensure DOM is ready

// Update visible version badge on screen (no console needed!)
if (document.getElementById('versionBadge')) {
    document.getElementById('versionBadge').textContent = '✅ V82';
    document.getElementById('versionBadge').style.background = '#0066ff';
    document.getElementById('versionBadge').style.color = '#ffffff';
} // #claude

// =============================================================================
// TEST MODE CONFIGURATION // #claude
// =============================================================================
const TEST_MODE = { // #claude
    enabled: true, // #claude - V17: Re-enabled - inflation now works with in-memory blobs
    inflateFileSize: true, // Artificially increase file size for upload stress testing // #claude
    targetSizeMB: 50 // Target file size in MB (heavy stress test - simulates 90s video) // #claude
}; // #claude

// #claude v20: VERY OBVIOUS TEST MODE INDICATOR
console.log('%c⚠️⚠️⚠️ TEST MODE ACTIVE ⚠️⚠️⚠️', 'background: #ff0000; color: #ffffff; font-size: 30px; font-weight: bold; padding: 20px;');
console.log('%cFILE INFLATION: ' + (TEST_MODE.inflateFileSize ? 'ENABLED ✅' : 'DISABLED ❌'), 'font-size: 20px; font-weight: bold;');
console.log('%cTARGET SIZE: ' + TEST_MODE.targetSizeMB + ' MB', 'font-size: 20px; font-weight: bold;');

// =============================================================================
// Global State
// =============================================================================

let stream = null;
let mediaRecorder = null;
let recordedChunks = []; // Now stores chunk metadata, not actual blobs (saved to IndexedDB) // #claude
let recordingStartTime = null;
let currentPromptIndex = 0;
let promptInterval = null;
let wakeLock = null;
let silentAudio = null;
let currentVideoId = null; // Unique ID for current recording // #claude
let chunkIndex = 0; // Current chunk number // #claude
let currentVideoSize = 0; // #claude v12: Final video size (after inflation)
let currentBlob = null; // #claude v15: Keep blob in MEMORY for direct upload (no IndexedDB retrieval)
let actualRecordingDuration = 0; // #claude v27: Store actual recording duration (not time until Accept)
let isFullscreen = false; // #claude v20: Track fullscreen state

let currentVideo = null; // Current video definition from videos.json // #claude
let prompts = []; // Prompts for current video // #claude
let TOTAL_RECORDING_DURATION = 0; // Total duration for current video // #claude
let isInitializing = false; // #claude v74: Prevent concurrent camera initializations

// =============================================================================
// Configuration
// =============================================================================

// Prompts now loaded from videos.json via SessionState // #claude

// =============================================================================
// Fullscreen Management (V20) // #claude
// =============================================================================

async function enterFullscreen() {
    try {
        // #claude v80: Debug fullscreen attempt
        debugLog(`📱 V80: enterFullscreen() called, isFullscreen=${isFullscreen}`);

        // #claude v39: Put recordingScreen in fullscreen (not entire document) for better size control
        const elem = document.getElementById('recordingScreen');
        if (!elem) {
            console.warn('⚠️ recordingScreen element not found');
            debugLog('❌ V80: recordingScreen element not found', true);
            return false;
        }

        // V48: Use navigationUI: "hide" to force Chrome/Safari to hide system UI (top bar)
        const fullscreenOptions = { navigationUI: "hide" };

        // V48: Chrome Android sometimes needs screen orientation lock to respect fullscreen
        const isChrome = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent);
        if (isChrome && screen.orientation && screen.orientation.lock) {
            try {
                // Lock to current orientation before entering fullscreen
                await screen.orientation.lock(screen.orientation.type.split('-')[0]);
                console.log('🔒 Locked screen orientation for Chrome fullscreen');
            } catch (orientErr) {
                console.warn('⚠️ Could not lock orientation:', orientErr);
                // Continue anyway - not critical
            }
        }

        if (elem.requestFullscreen) {
            await elem.requestFullscreen(fullscreenOptions);
        } else if (elem.webkitRequestFullscreen) { // Safari
            await elem.webkitRequestFullscreen(fullscreenOptions);
        } else if (elem.mozRequestFullScreen) { // Firefox
            await elem.mozRequestFullScreen(fullscreenOptions);
        } else if (elem.msRequestFullscreen) { // IE/Edge
            await elem.msRequestFullscreen();
        } else {
            console.warn('⚠️ Fullscreen API not supported');
            showStatus('Fullscreen not supported - continue anyway', 'warning');
            setTimeout(() => hideStatus(), 2000);
            return false;
        }

        isFullscreen = true;
        console.log('✅ Entered fullscreen mode on #recordingScreen with navigationUI: hide');
        debugLog('✅ V80: Fullscreen SUCCEEDED'); // #claude v80
        return true;
    } catch (err) {
        console.warn('⚠️ Fullscreen request failed:', err);
        debugLog(`⚠️ V80: Fullscreen DENIED: ${err.message}`, true); // #claude v80
        showStatus('Fullscreen denied - continue anyway', 'warning');
        setTimeout(() => hideStatus(), 2000);
        return false;
    }
}

async function exitFullscreen() {
    if (!isFullscreen) return;

    try {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { // Safari
            await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            await document.msExitFullscreen();
        }

        isFullscreen = false;
        console.log('✅ Exited fullscreen mode');
    } catch (err) {
        console.warn('⚠️ Failed to exit fullscreen:', err);
    }
}

// Listen for fullscreen changes (user pressing ESC, etc.)
document.addEventListener('fullscreenchange', () => {
    isFullscreen = !!document.fullscreenElement;
    console.log('Fullscreen state changed:', isFullscreen ? 'ON' : 'OFF');
});

document.addEventListener('webkitfullscreenchange', () => {
    isFullscreen = !!document.webkitFullscreenElement;
    console.log('Fullscreen state changed (webkit):', isFullscreen ? 'ON' : 'OFF');
});

// =============================================================================
// Codec Detection (from prototype)
// =============================================================================

function getBestCodec() {
    // V48: Prioritize H.264 for ALL browsers - hardware acceleration prevents FPS drops at 12 Mbps
    // VP9 software encoding causes severe main thread blocking across Chrome, Opera, Edge
    console.log('🎬 Prioritizing H.264 codec for hardware acceleration at 12 Mbps bitrate');

    const codecs = [
        // H.264 first (universal hardware acceleration)
        'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',  // H.264 + AAC
        'video/mp4; codecs="avc1.42E01E"',            // H.264 video only
        'video/mp4',                                   // Generic MP4
        // Fallback to VP8 (lighter than VP9)
        'video/webm; codecs="vp8,opus"',
        'video/webm; codecs=vp8',
        'video/webm'
    ];

    for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
            console.log(`✅ Using codec: ${codec}`);
            return codec;
        }
    }

    console.warn('⚠️ No explicit codec support, using browser default');
    return '';
}

// =============================================================================
// Wake Lock (iOS Pattern 3: Screen Wake Lock with Silent Audio Fallback)
// =============================================================================

async function acquireWakeLock() {
    // Try Wake Lock API first
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('✅ Wake Lock acquired');

            // Re-acquire if released (e.g., tab visibility change)
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });

            return true;
        } catch (err) {
            console.warn('⚠️ Wake Lock failed, using silent audio fallback:', err);
        }
    }

    // Fallback: Silent audio loop (100% reliable on iOS)
    // #claude v79: Don't await play() - iOS Safari hangs forever on silent audio autoplay
    try {
        // Create minimal silent WAV file (1 second of silence)
        const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        silentAudio = new Audio(silentWav);
        silentAudio.loop = true;
        silentAudio.volume = 0;

        // #claude v79: Don't await - just fire and forget. If it fails, that's okay.
        silentAudio.play().catch(err => {
            console.warn('⚠️ Silent audio play blocked (expected on iOS):', err);
        });
        console.log('✅ Silent audio loop attempted (non-blocking)');
        return true; // Return immediately, don't wait
    } catch (err) {
        console.error('❌ Silent audio fallback failed:', err);
        // #claude v79: Don't show warning - not critical
        return true; // Return true anyway - wake lock is nice-to-have, not required
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock released');
    }

    if (silentAudio) {
        silentAudio.pause();
        silentAudio = null;
        console.log('Silent audio stopped');
    }
}

// =============================================================================
// Interruption Detection (iOS Pattern 2)
// =============================================================================

function setupInterruptionDetection() {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    // Detect call/FaceTime interruptions
    videoTrack.onmute = () => {
        console.warn('⚠️ Video track muted (likely incoming call)');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            showStatus('Recording paused - Call detected. Dismiss call to continue.', 'warning');
        }
    };

    videoTrack.onunmute = () => {
        console.log('✅ Video track unmuted');
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            showStatus('Call ended. Recording will restart...', 'success');
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === 'paused') {
                    mediaRecorder.resume();
                    hideStatus();
                }
            }, 2000);
        }
    };

    if (audioTrack) {
        audioTrack.onmute = () => {
            console.warn('⚠️ Audio track muted');
        };

        audioTrack.onunmute = () => {
            console.log('✅ Audio track unmuted');
        };
    }

    // Detect tab backgrounding
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && mediaRecorder && mediaRecorder.state === 'recording') {
            console.warn('⚠️ Tab backgrounded during recording');
            showStatus('Keep this app in foreground!', 'warning');
        } else if (!document.hidden && mediaRecorder && mediaRecorder.state === 'recording') {
            hideStatus();
        }
    });
}

// =============================================================================
// UI State Management
// =============================================================================

const screens = {
    instruction: document.getElementById('instructionScreen'),
    recording: document.getElementById('recordingScreen'),
    decision: document.getElementById('decisionScreen')
};

function showScreen(screenName) {
    // #claude v80: Debug screen transitions
    debugLog(`📺 V80: showScreen('${screenName}') called`);
    const preview = document.getElementById('preview');
    if (preview) {
        debugLog(`🎥 V80: Preview element exists, srcObject: ${preview.srcObject ? 'YES' : 'NULL'}`);
        if (preview.srcObject) {
            debugLog(`🎥 V80: Preview srcObject active: ${preview.srcObject.active}`);
        }
    }

    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden'); // #claude
        screen.classList.remove('visible'); // #claude
    });
    screens[screenName].classList.remove('hidden'); // #claude
    screens[screenName].classList.add('visible'); // #claude

    debugLog(`✅ V80: Now showing '${screenName}' screen`);
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.classList.remove('hidden');
}

function hideStatus() {
    const statusEl = document.getElementById('statusMessage');
    statusEl.classList.add('hidden');
}

function showElement(elementId) {
    document.getElementById(elementId).classList.remove('hidden');
}

function hideElement(elementId) {
    document.getElementById(elementId).classList.add('hidden');
}

// #claude v18: Reset decision buttons to enabled state
function resetDecisionButtons() {
    const acceptBtn = document.getElementById('acceptBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    if (acceptBtn) acceptBtn.disabled = false;
    if (retakeBtn) retakeBtn.disabled = false;
    console.log('🔓 V18: Decision buttons re-enabled');
}

// =============================================================================
// Upload Modal Management (V44) // #claude v44
// =============================================================================

function showUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.classList.remove('hidden');
        console.log('📤 V44: Upload modal shown');
    }
}

function hideUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.classList.add('hidden');
        console.log('📤 V44: Upload modal hidden');
    }
}

function updateUploadModal(title, text, percent) {
    const titleEl = document.getElementById('uploadModalTitle');
    const textEl = document.getElementById('uploadModalText');
    const progressEl = document.getElementById('uploadModalProgress');
    const percentEl = document.getElementById('uploadModalPercent');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (progressEl) progressEl.style.width = `${percent}%`;
    if (percentEl) percentEl.textContent = `${percent}%`;
}

// =============================================================================
// Camera Initialization
// =============================================================================

async function initializeCamera() {
    // #claude v80: Debug camera initialization
    debugLog(`📹 V80: initializeCamera() called`);
    const preview = document.getElementById('preview');
    debugLog(`🎥 V80: Preview element exists: ${!!preview}`);
    if (preview) {
        debugLog(`🎥 V80: Preview.srcObject before init: ${preview.srcObject ? 'YES' : 'NULL'}`);
        if (preview.srcObject) {
            debugLog(`🎥 V80: Preview.srcObject.active: ${preview.srcObject.active}`);
        }
    }

    // #claude v74: Prevent concurrent initializations (causes NotReadableError)
    if (isInitializing) {
        console.warn('⚠️ V74: Camera initialization already in progress, skipping duplicate call');
        debugLog('⚠️ Camera init already in progress', true);
        return false;
    }

    // #claude v74: If camera is already initialized and working, don't reinitialize
    if (stream && stream.active) {
        console.log('✅ V74: Camera already initialized and active, reusing stream');
        debugLog('✅ V80: Camera stream active, reusing');
        // #claude v80: BUT ensure preview still has the stream!
        if (preview && !preview.srcObject) {
            debugLog('⚠️ V80: Preview lost srcObject! Restoring...');
            preview.srcObject = stream;
            debugLog('✅ V80: Preview.srcObject restored');
        } else if (preview && preview.srcObject !== stream) {
            debugLog('⚠️ V80: Preview has wrong srcObject! Fixing...');
            preview.srcObject = stream;
            debugLog('✅ V80: Preview.srcObject fixed');
        } else {
            debugLog('✅ V80: Preview.srcObject OK');
        }
        return true;
    }

    try {
        isInitializing = true; // #claude v74

        // #claude v74: Stop any existing stream BEFORE requesting new one (prevents NotReadableError)
        if (stream) {
            console.log('⚠️ V74: Stopping existing camera stream before reinitializing');
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('  ➜ Stopped track:', track.kind, track.label);
            });
            stream = null;
        }

        showStatus('Requesting camera access...', 'info');

        // Check if mediaDevices API is available #claude
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { // #claude
            throw new Error('Camera API not available. Please use a modern browser over HTTPS or localhost.'); // #claude
        } // #claude

        // V48: Get camera capabilities first to force native aspect ratio
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('📹 V48: Available cameras:', videoDevices.length);

        // #claude v74: Detect iPad - use more conservative constraints to prevent crashes
        const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
        const maxResolution = isIPad ? 2560 : 8192; // Limit iPad to ~1440p max

        if (isIPad) {
            console.log('📱 V74: iPad detected - using conservative resolution constraints (max ' + maxResolution + 'px)');
        }

        const constraints = {
            video: {
                width: { ideal: maxResolution }, // V48/V74: Request absolute maximum width (limited on iPad)
                height: { ideal: maxResolution }, // V48/V74: Request absolute maximum height (limited on iPad)
                frameRate: { ideal: 60, max: 60, min: 30 }, // #claude v51: Add max cap to prevent Android 11 variable rate bug
                facingMode: { exact: 'user' }  // Force front-facing camera
                // V48: No aspectRatio constraint - use native camera max
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        const preview = document.getElementById('preview');
        preview.srcObject = stream;

        // Log actual resolution achieved
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        console.log(`📹 Camera: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);

        // #claude v51: Log camera initialization
        if (window.clientLogger) {
            window.clientLogger.event('camera_initialized', {
                resolution: `${settings.width}x${settings.height}`,
                frameRate: settings.frameRate,
                facingMode: settings.facingMode,
                deviceLabel: videoTrack.label
            });
        }

        // Setup interruption detection
        setupInterruptionDetection();

        // Show video stats (v26)
        updateVideoStats(settings, preview);

        hideStatus();
        isInitializing = false; // #claude v74: Reset flag on success
        return true;
    } catch (err) {
        console.error('❌ Camera error:', err);
        isInitializing = false; // #claude v74: Reset flag on error
        // #claude v51: Log camera error
        if (window.clientLogger) {
            window.clientLogger.error('camera_initialization_failed', {
                error: err.message,
                name: err.name,
                stack: err.stack
            });
        }
        showStatus(`Camera error: ${err.message}. Please allow camera access.`, 'error');
        return false;
    }
}

// =============================================================================
// Video Stats Display (v26)
// =============================================================================

function updateVideoStats(settings, videoElement) {
    const statsDiv = document.getElementById('videoStats');
    if (!statsDiv) return;

    // Wait for video metadata to load
    videoElement.addEventListener('loadedmetadata', () => {
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        const aspectRatio = (videoWidth / videoHeight).toFixed(2);

        // V48: Opera fix - wait for next frame to get display size (clientWidth/Height may be 0 initially)
        requestAnimationFrame(() => {
            const displayWidth = videoElement.clientWidth;
            const displayHeight = videoElement.clientHeight;

            // V48: If still 0, calculate from boundingClientRect (Opera fallback)
            if (displayWidth === 0 || displayHeight === 0) {
                const rect = videoElement.getBoundingClientRect();
                document.getElementById('statsDisplaySize').textContent = `${Math.round(rect.width)}x${Math.round(rect.height)}px`;
            } else {
                document.getElementById('statsDisplaySize').textContent = `${displayWidth}x${displayHeight}px`;
            }

            document.getElementById('statsResolution').textContent = `${videoWidth}x${videoHeight}`;
            document.getElementById('statsFPS').textContent = `${settings.frameRate || 30} fps`;
            document.getElementById('statsAspectRatio').textContent = aspectRatio;

            statsDiv.classList.remove('hidden');

            console.log('📊 Video Stats:', {
                native: `${videoWidth}x${videoHeight}`,
                display: displayWidth > 0 ? `${displayWidth}x${displayHeight}` : videoElement.getBoundingClientRect().width + 'x' + videoElement.getBoundingClientRect().height,
                aspect: aspectRatio,
                fps: settings.frameRate
            });
        });
    });
}

// =============================================================================
// Countdown
// =============================================================================

async function showCountdown() {
    debugLog('⏱️ Countdown: Starting...'); // #claude v75
    const overlay = document.getElementById('countdownOverlay');
    const numberEl = document.getElementById('countdownNumber');

    if (!overlay) {
        debugLog('❌ countdownOverlay element not found!', true); // #claude v75
        return;
    }
    if (!numberEl) {
        debugLog('❌ countdownNumber element not found!', true); // #claude v75
        return;
    }

    debugLog('✅ Countdown elements found, showing overlay'); // #claude v75
    overlay.classList.add('visible');
    debugLog(`✅ Overlay classList: ${overlay.classList.toString()}`); // #claude v75
    debugLog(`✅ Overlay display style: ${window.getComputedStyle(overlay).display}`); // #claude v75

    for (let i = 3; i > 0; i--) {
        debugLog(`⏱️ ${i}...`); // #claude v74
        numberEl.textContent = i;
        numberEl.style.animation = 'none';
        // Trigger reflow to restart animation
        void numberEl.offsetWidth;
        numberEl.style.animation = 'countdownPulse 1s ease-out';

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    overlay.classList.remove('visible');
    debugLog('✅ Countdown complete, overlay hidden'); // #claude v75
}

// =============================================================================
// Text Overlay Management
// =============================================================================

function showTextOverlay(text) {
    debugLog(`📝 Showing text overlay: "${text}"`); // #claude v75
    const overlay = document.getElementById('textOverlay');
    const textEl = document.getElementById('overlayText');

    if (!overlay || !textEl) {
        debugLog('❌ Text overlay elements not found!', true); // #claude v75
        return;
    }

    textEl.textContent = text;
    overlay.classList.add('visible');
    debugLog(`✅ Text overlay visible: ${overlay.classList.contains('visible')}`); // #claude v75

    // #claude v23: Hide progress indicator when text is showing (less clutter near camera)
    const progressIndicator = document.getElementById('progressIndicator');
    if (progressIndicator) {
        progressIndicator.style.opacity = '0';
    }
}

function hideTextOverlay() {
    document.getElementById('textOverlay').classList.remove('visible');

    // #claude v23: Show progress indicator again when text is hidden
    const progressIndicator = document.getElementById('progressIndicator');
    if (progressIndicator) {
        progressIndicator.style.opacity = '1';
    }
}

function startPromptSequence() {
    currentPromptIndex = 0;
    debugLog(`🎬 Starting with ${prompts.length} prompts`); // #claude v74
    console.log(`🎬 V74: Prompts array:`, prompts); // #claude v74 - Show the actual prompts

    // #claude v74: Safety check - if no prompts, stop after 5 seconds
    if (prompts.length === 0) {
        debugLog('❌ NO PROMPTS! Auto-stopping in 5s', true); // #claude v74
        promptInterval = setTimeout(() => {
            debugLog('⏱️ Fallback timeout reached, stopping'); // #claude v74
            stopRecording();
        }, 5000);
        return;
    }

    function showNextPrompt() {
        debugLog(`📍 Prompt ${currentPromptIndex}/${prompts.length}`); // #claude v74

        if (currentPromptIndex >= prompts.length) {
            // All prompts shown, stop recording
            debugLog('✅ All prompts done - STOPPING!'); // #claude v74
            console.log('%c🛑 STOPPING RECORDING NOW!', 'background: #ff0000; color: #ffffff; font-size: 24px; font-weight: bold; padding: 10px;'); // #claude v74
            stopRecording();
            return;
        }

        const prompt = prompts[currentPromptIndex];
        debugLog(`📝 "${prompt.text}" for ${prompt.duration}ms`); // #claude v74
        showTextOverlay(prompt.text);

        // Update progress bar
        const progress = ((currentPromptIndex + 1) / prompts.length) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;

        currentPromptIndex++;

        const nextTimeout = prompt.duration || 3000; // #claude v74: Default to 3s if duration missing
        promptInterval = setTimeout(showNextPrompt, nextTimeout);
        debugLog(`⏰ Timeout set for ${nextTimeout}ms`); // #claude v74
    }

    showNextPrompt();
}

function stopPromptSequence() {
    if (promptInterval) {
        clearTimeout(promptInterval);
        promptInterval = null;
    }
    hideTextOverlay();
}

// =============================================================================
// Recording
// =============================================================================

async function startRecording() {
    try {
        debugLog('🎬 startRecording() called'); // #claude v74
        // Generate unique video ID // #claude
        currentVideoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // #claude
        chunkIndex = 0; // #claude
        recordedChunks = []; // Track chunk metadata, not blobs // #claude
        actualRecordingDuration = 0; // #claude v27: Reset duration
        debugLog(`📹 Video ID: ${currentVideoId}`); // #claude v74

        const codec = getBestCodec();
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        debugLog(`🎥 Stream: ${settings.width}x${settings.height}`); // #claude v74

        // #claude v51: Check if we have a tested encoder config from camera test page
        let startConfigIndex = 0; // Start from Config 1 by default
        const storedConfigStr = localStorage.getItem('bestEncoderConfig');
        if (storedConfigStr) {
            try {
                const storedConfig = JSON.parse(storedConfigStr);
                console.log('📋 V51: Found tested encoder config from camera test:', storedConfig.configName);
                // Use the tested config index as starting point
                startConfigIndex = storedConfig.configIndex;
                console.log(`🎯 V51: Skipping to Config ${startConfigIndex + 1} (${storedConfig.configName})`);
            } catch (err) {
                console.warn('⚠️ V51: Failed to parse stored encoder config:', err);
            }
        }

        // #claude v60: Test BOTH H.264 and WebM/VP8 codecs across multiple bitrates
        // Different phones have different hardware encoder strengths
        const allConfigurations = [
            // H.264 configurations
            {
                videoBitsPerSecond: 24000000,
                audioBitsPerSecond: 320000,
                mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
                name: 'H.264 High Quality (24 Mbps)'
            },
            {
                videoBitsPerSecond: 12000000,
                audioBitsPerSecond: 320000,
                mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
                name: 'H.264 Standard (12 Mbps)'
            },
            {
                videoBitsPerSecond: 6000000,
                audioBitsPerSecond: 320000,
                mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
                name: 'H.264 Low (6 Mbps)'
            },
            {
                videoBitsPerSecond: 3000000,
                audioBitsPerSecond: 192000,
                mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
                name: 'H.264 Very Low (3 Mbps)'
            },
            // WebM/VP8 configurations (some phones prefer this over H.264)
            {
                videoBitsPerSecond: 24000000,
                audioBitsPerSecond: 320000,
                mimeType: 'video/webm; codecs="vp8,opus"',
                name: 'WebM/VP8 High Quality (24 Mbps)'
            },
            {
                videoBitsPerSecond: 12000000,
                audioBitsPerSecond: 320000,
                mimeType: 'video/webm; codecs="vp8,opus"',
                name: 'WebM/VP8 Standard (12 Mbps)'
            },
            {
                videoBitsPerSecond: 6000000,
                audioBitsPerSecond: 320000,
                mimeType: 'video/webm; codecs="vp8,opus"',
                name: 'WebM/VP8 Low (6 Mbps)'
            },
            {
                videoBitsPerSecond: 3000000,
                audioBitsPerSecond: 192000,
                mimeType: 'video/webm; codecs="vp8,opus"',
                name: 'WebM/VP8 Very Low (3 Mbps)'
            },
            // Browser defaults (last resort)
            {
                mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
                name: 'H.264 Browser Default'
            },
            {
                mimeType: 'video/webm; codecs="vp8,opus"',
                name: 'WebM Browser Default'
            }
        ];

        // #claude v60: Filter to only supported codecs before testing
        const configurations = allConfigurations.filter(config => {
            const supported = MediaRecorder.isTypeSupported(config.mimeType);
            if (!supported) {
                console.log(`⏭️  V60: Skipping ${config.name} - codec not supported by browser`);
            }
            return supported;
        });

        console.log(`📋 V60: Testing ${configurations.length} supported configurations (filtered from ${allConfigurations.length} total)`);

        let mediaRecorderCreated = false;
        let lastError = null;
        let usedConfig = null; // #claude v51: Store which config succeeded

        // #claude v51: Try each configuration using MediaCapabilities API
        // Start from tested config if available (stored from camera test page)
        for (let i = startConfigIndex; i < configurations.length; i++) {
            const config = configurations[i];
            console.log(`🔧 V51: Checking config ${i + 1}/${configurations.length}: ${config.name}`);

            try {
                // #claude v51: Check if encoder supports this config using MediaCapabilities API
                let encoderSupported = false;

                if (config.videoBitsPerSecond && navigator.mediaCapabilities && navigator.mediaCapabilities.encodingInfo) {
                    // Use MediaCapabilities API to check encoder support
                    try {
                        const capabilityInfo = await navigator.mediaCapabilities.encodingInfo({
                            type: 'record',
                            video: {
                                contentType: config.mimeType,
                                width: settings.width,
                                height: settings.height,
                                bitrate: config.videoBitsPerSecond,
                                framerate: settings.frameRate || 30
                            }
                        });

                        console.log(`📊 MediaCapabilities result for config ${i + 1}:`, capabilityInfo);
                        encoderSupported = capabilityInfo.supported;

                        if (window.clientLogger) {
                            window.clientLogger.info('mediacapabilities_check', {
                                configIndex: i,
                                configName: config.name,
                                supported: capabilityInfo.supported,
                                smooth: capabilityInfo.smooth,
                                powerEfficient: capabilityInfo.powerEfficient
                            });
                        }
                    } catch (capErr) {
                        console.warn(`⚠️ MediaCapabilities check failed for config ${i + 1}:`, capErr.message);
                        // Fallback to trying the config anyway (older browsers)
                        encoderSupported = true;
                    }
                } else {
                    // No bitrate specified or MediaCapabilities not available - assume supported
                    console.log(`ℹ️ Skipping MediaCapabilities check for config ${i + 1} (no bitrate or API unavailable)`);
                    encoderSupported = true;
                }

                if (!encoderSupported) {
                    throw new Error('Encoder does not support this configuration');
                }

                // Create MediaRecorder with this config
                const options = {
                    videoBitsPerSecond: config.videoBitsPerSecond,
                    audioBitsPerSecond: config.audioBitsPerSecond,
                    mimeType: config.mimeType
                };

                // Remove undefined properties
                Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

                mediaRecorder = new MediaRecorder(stream, options);

                // #claude v60: Test that encoder actually accepts start() (not just constructor)
                // Budget phones may fail only when start() is called, not during construction
                let encoderError = null;
                mediaRecorder.onerror = (event) => {
                    encoderError = event.error;
                    console.error(`❌ V60: Encoder rejected start(): ${event.error.message}`);
                };

                // Try starting and immediately stopping to test encoder acceptance
                mediaRecorder.start(1000);
                await new Promise(resolve => setTimeout(resolve, 100));

                if (encoderError) {
                    // Encoder rejected the config
                    throw encoderError;
                }

                if (mediaRecorder.state !== 'recording') {
                    throw new Error('MediaRecorder did not enter recording state');
                }

                // Stop the test recording
                mediaRecorder.stop();
                await new Promise(resolve => setTimeout(resolve, 50));

                // Config works! Create a fresh MediaRecorder for actual recording
                mediaRecorder = new MediaRecorder(stream, options);
                mediaRecorderCreated = true;
                usedConfig = config;
                console.log(`✅ V60: Config ${i + 1} (${config.name}) accepted and encoder verified`);
                console.log('MediaRecorder mimeType:', mediaRecorder.mimeType);

                // #claude v51: Log successful config to backend
                if (window.clientLogger) {
                    window.clientLogger.event('mediarecorder_config_success', {
                        configIndex: i,
                        configName: config.name,
                        videoBitrate: config.videoBitsPerSecond || 'browser-managed',
                        audioBitrate: config.audioBitsPerSecond || 'browser-managed',
                        codec: mediaRecorder.mimeType,
                        requestedCodec: config.mimeType || 'none'
                    });
                }
                break;
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ V51: Config ${i + 1} (${config.name}) failed:`, err.message);
                // #claude v51: Log fallback attempt
                if (window.clientLogger) {
                    window.clientLogger.warn('mediarecorder_config_failed', {
                        configIndex: i,
                        configName: config.name,
                        error: err.message
                    });
                }
            }
        }

        if (!mediaRecorderCreated) {
            throw new Error(`Failed to create MediaRecorder with any configuration. Last error: ${lastError?.message}`);
        }
        console.log(`📹 Video ID: ${currentVideoId}`); // #claude

        // #claude v13: Store chunks in MEMORY (not IndexedDB) for instant inflation
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data); // Store actual Blob in memory
                console.log(`📦 V13: Chunk ${recordedChunks.length} in MEMORY: ${(event.data.size / 1024).toFixed(0)}KB`);
            } else if (recordedChunks.length === 0) {
                // #claude v51: CRITICAL - First chunk is 0 bytes means encoder is broken (Gemini Deep Research finding)
                // Encoder started but not receiving valid frames (disconnected stream, DRM protection, or driver failure)
                console.error('❌ V51: Encoder producing zero-byte chunks - encoder failure detected');
                if (window.clientLogger) {
                    window.clientLogger.error('encoder_zero_byte_chunks', {
                        videoId: currentVideoId,
                        state: mediaRecorder.state,
                        configName: usedConfig?.name
                    });
                }
                // Stop recording immediately to trigger onstop error handling
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
                showStatus('Encoder failure detected. Please retake this video.', 'error');
            }
        };

        mediaRecorder.onstop = async () => { // #claude - made async
            const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
            actualRecordingDuration = parseFloat(duration); // #claude v27: Store actual duration
            console.log(`✅ Recording complete: ${duration}s`);
            console.log(`💾 V13: Captured ${recordedChunks.length} chunks in MEMORY (NOT IndexedDB)`); // #claude v13

            // #claude v51: Log recording stopped with calculated bitrate
            const totalBytes = recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
            const durationSeconds = parseFloat(duration);
            const calculatedBitrate = durationSeconds > 0 ? Math.round((totalBytes * 8) / durationSeconds) : 0;

            if (window.clientLogger) {
                window.clientLogger.event('recording_stopped', {
                    videoId: currentVideoId,
                    duration: durationSeconds,
                    chunkCount: recordedChunks.length,
                    totalSize: totalBytes,
                    calculatedBitrateBps: calculatedBitrate,
                    calculatedBitrateMbps: (calculatedBitrate / 1000000).toFixed(2)
                });
            }

            // #claude v13: Reassemble blob from MEMORY chunks (instant, no DB query)
            console.log('🔧 V13: Reassembling from MEMORY (instant)...');
            const originalBlob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'video/webm' });
            const originalSizeMB = (originalBlob.size / 1024 / 1024).toFixed(2);
            console.log(`File size: ${originalSizeMB} MB`);

            // #claude v51: Store original size and bitrate BEFORE inflation
            window.currentOriginalSize = originalBlob.size;
            window.currentCalculatedBitrate = calculatedBitrate;

            let finalBlob = originalBlob;

            // #claude v20: Use INLINE inflation function if available (bypasses caching)
            if (TEST_MODE.enabled && TEST_MODE.inflateFileSize) {
                if (typeof window.INFLATE_VIDEO === 'function') {
                    console.log('🎯 Using INLINE inflation function (no caching)');
                    finalBlob = window.INFLATE_VIDEO(originalBlob, TEST_MODE.targetSizeMB);
                } else {
                    console.warn('⚠️ INLINE inflation function not found! Using fallback...');
                    console.log('🧪 TEST MODE: Inflating file (in-memory, instant)...');
                    console.log(`  Original size: ${originalSizeMB} MB`);

                    try {
                        // Calculate padding needed
                        const targetBytes = TEST_MODE.targetSizeMB * 1024 * 1024;
                        const paddingNeeded = Math.max(0, targetBytes - originalBlob.size);

                        if (paddingNeeded > 0) {
                            console.log(`  🔧 Adding ${(paddingNeeded / 1024 / 1024).toFixed(2)} MB padding (zeros - fast!)...`);

                            // V21: Create padding blob (zeros - INSTANT, no blocking!)
                            const paddingArray = new Uint8Array(paddingNeeded); // Already zeros by default
                            const paddingBlob = new Blob([paddingArray], { type: 'application/octet-stream' });

                            // Combine in memory (instant)
                            finalBlob = new Blob([originalBlob, paddingBlob], { type: originalBlob.type });

                            const finalSizeMB = (finalBlob.size / 1024 / 1024).toFixed(2);
                            console.log(`  ✅ Inflated to: ${finalSizeMB} MB`);
                        } else {
                            console.log(`  ℹ️ Video already ${originalSizeMB} MB, no inflation needed`);
                        }
                    } catch (err) {
                        console.error('❌ Failed to inflate file:', err);
                        console.log('  Continuing with original file size');
                    }
                }
            }

            // #claude v15: KEEP BLOB IN MEMORY for direct upload (no IndexedDB)
            console.log('💾 V15: Storing blob in MEMORY (not IndexedDB)...');
            currentBlob = finalBlob; // Store in memory
            currentVideoSize = finalBlob.size;
            console.log(`✅ Blob ready in memory: ${(currentVideoSize / 1024 / 1024).toFixed(2)} MB`);
            console.log('ℹ️  V15: NO IndexedDB storage - will upload directly from memory');

            // Stop prompt sequence
            stopPromptSequence();

            // Hide recording UI
            hideElement('progressBar');
            hideElement('stopBtn');

            // Release wake lock
            releaseWakeLock();

            // #claude v80: Debug recording stop flow
            debugLog(`🛑 V80: Recording stopped, about to exit fullscreen`);

            // #claude v43: Exit fullscreen before showing decision screen (so buttons are clickable)
            await exitFullscreen();
            console.log('✅ V43: Exited fullscreen before decision screen');
            debugLog(`✅ V80: Exited fullscreen`);

            // #claude v18: Ensure buttons are enabled before showing decision screen
            resetDecisionButtons();
            debugLog(`🔓 V80: Decision buttons reset`);

            // #claude v80: Debug preview state before showing decision
            const preview = document.getElementById('preview');
            if (preview) {
                const rect = preview.getBoundingClientRect();
                debugLog(`📐 V80: Preview size before decision: ${Math.round(rect.width)}x${Math.round(rect.height)}px`);
            }

            // Show decision screen
            debugLog(`📺 V80: About to show decision screen`);
            showScreen('decision');
            debugLog(`✅ V80: Decision screen shown`);
        };

        mediaRecorder.onerror = (event) => {
            console.error('❌ MediaRecorder error:', event.error);
            // #claude v51: Log MediaRecorder error
            if (window.clientLogger) {
                window.clientLogger.error('mediarecorder_error', {
                    error: event.error?.message || 'Unknown error',
                    name: event.error?.name,
                    videoId: currentVideoId,
                    state: mediaRecorder?.state
                });
            }
            showStatus(`Recording error: ${event.error.message}`, 'error');
        };

        // Start recording (request chunks every 10 seconds to reduce encoding overhead)
        // V48: Increased from 5s to 10s to reduce main thread blocking in Opera
        recordingStartTime = Date.now();
        mediaRecorder.start(10000);

        // #claude v51: Log recording started
        if (window.clientLogger) {
            window.clientLogger.event('recording_started', {
                videoId: currentVideoId,
                promptId: currentVideo?.id,
                codec: mediaRecorder.mimeType,
                videoBitrate: usedConfig?.videoBitsPerSecond || 'browser-managed', // #claude v51: Actual bitrate from successful config
                audioBitrate: usedConfig?.audioBitsPerSecond || 'browser-managed', // #claude v51: Actual bitrate from successful config
                configName: usedConfig?.name || 'Unknown', // #claude v51: Which config was used
                chunkInterval: 10000
            });
        }

        // Show recording UI
        showElement('progressBar');
        showElement('stopBtn');

        // Start prompt sequence
        startPromptSequence();

        console.log('🎬 Recording started');
    } catch (err) {
        console.error('❌ Recording error:', err);
        // #claude v51: Log recording start failure
        if (window.clientLogger) {
            window.clientLogger.error('recording_start_failed', {
                error: err.message,
                name: err.name,
                stack: err.stack,
                videoId: currentVideoId
            });
        }
        showStatus(`Recording failed: ${err.message}`, 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        // showStatus('Processing recording...', 'info'); // Removed per user request
    }
}

// ============================================================================= // #claude
// Video Loading // #claude
// ============================================================================= // #claude

async function loadCurrentVideo() { // #claude
    try { // #claude
        // #claude v80: Debug video transition
        debugLog(`🔄 V80: loadCurrentVideo() called`);
        debugLog(`🎥 V80: Current stream state: ${stream ? (stream.active ? 'ACTIVE' : 'INACTIVE') : 'NULL'}`);
        if (stream) {
            const videoTracks = stream.getVideoTracks();
            debugLog(`📹 V80: Video tracks: ${videoTracks.length}, enabled: ${videoTracks[0]?.enabled}`);
        }

        currentVideo = SessionState.getCurrentVideo(); // #claude

        if (!currentVideo) { // #claude
            console.error('❌ No current video available'); // #claude
            debugLog('❌ V80: No current video available', true);
            return false; // #claude
        } // #claude

        console.log(`📹 Loading video: ${currentVideo.name} (${currentVideo.id})`); // #claude
        debugLog(`📹 V80: Loading video ${SessionState.getCurrentVideoNumber()}/${SessionState.getTotalVideos()}: ${currentVideo.name}`);

        // Load prompts from current video // #claude
        prompts = currentVideo.prompts || []; // #claude
        TOTAL_RECORDING_DURATION = currentVideo.duration; // #claude

        // #claude v74: Debug log to verify prompts loaded
        debugLog(`📝 Loaded ${prompts.length} prompts for ${currentVideo.name}`); // #claude v74
        if (prompts.length === 0) {
            debugLog('❌ NO PROMPTS! Video will NOT auto-stop', true); // #claude v74
        } else {
            debugLog(`⏱️ Total duration: ${TOTAL_RECORDING_DURATION}ms`); // #claude v74
        }

        // Update progress indicator // #claude
        updateProgressIndicator(); // #claude

        // Update instruction screen // #claude
        updateInstructionScreen(); // #claude

        debugLog(`✅ V80: loadCurrentVideo() complete`);
        return true; // #claude
    } catch (err) { // #claude
        console.error('❌ Failed to load video:', err); // #claude
        debugLog(`❌ V80: Failed to load video: ${err.message}`, true);
        return false; // #claude
    } // #claude
} // #claude

function updateProgressIndicator() { // #claude
    const progressIndicator = document.getElementById('progressIndicator'); // #claude
    const progressText = document.getElementById('progressText'); // #claude

    progressText.textContent = SessionState.getProgressString(); // #claude
    progressIndicator.classList.remove('hidden'); // #claude
} // #claude

function updateInstructionScreen() { // #claude
    const videoTitle = document.getElementById('videoTitle'); // #claude
    const videoDescription = document.getElementById('videoDescription'); // #claude
    const instructionList = document.getElementById('instructionList'); // #claude

    // Update title and description // #claude
    videoTitle.textContent = currentVideo.name; // #claude
    videoDescription.textContent = currentVideo.description; // #claude

    // Build instruction list based on video mode // #claude
    const instructions = []; // #claude

    if (currentVideo.mode === 'live_prompts') { // #claude
        instructions.push('Keep your screen unlocked during recording'); // #claude
        instructions.push('Stay in the app - don\'t switch tabs'); // #claude
        instructions.push('Follow the text prompts shown on screen'); // #claude
        instructions.push('You\'ll get 3 seconds to prepare before recording'); // #claude
        instructions.push(`Duration: ~${Math.round(currentVideo.duration / 1000)} seconds with live prompts`); // #claude
    } else if (currentVideo.mode === 'read_then_perform') { // #claude
        instructions.push('Read ALL instructions carefully first'); // #claude
        instructions.push('You will have 15 seconds to read'); // #claude
        instructions.push('Then perform all movements during recording'); // #claude
        instructions.push('Keep your screen unlocked during recording'); // #claude
        instructions.push(`Recording duration: ~${Math.round(currentVideo.recordDuration / 1000)} seconds`); // #claude
    } // #claude

    // Update instruction list HTML // #claude
    instructionList.innerHTML = instructions.map(text => `<li>${text}</li>`).join(''); // #claude
} // #claude

// =============================================================================
// Accept/Retake Logic
// =============================================================================

async function handleAccept() { // #claude
    // #claude v20: Prevent multiple clicks
    const acceptBtn = document.getElementById('acceptBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    if (acceptBtn.disabled) {
        console.warn('⚠️ Accept already in progress, ignoring duplicate click');
        return;
    }
    acceptBtn.disabled = true;
    retakeBtn.disabled = true;
    console.log('🔒 Buttons disabled to prevent multiple clicks');

    console.log('✅ Video accepted'); // #claude

    // #claude v51: Log start of handleAccept
    if (window.clientLogger) {
        window.clientLogger.info('handle_accept_started', {
            videoId: currentVideoId,
            promptId: currentVideo?.id,
            currentBlobSize: currentBlob ? currentBlob.size : 0
        });
    }

    // #claude v51: Log accept clicked
    if (window.clientLogger) {
        window.clientLogger.event('accept_clicked', {
            videoId: currentVideoId,
            promptId: currentVideo?.id,
            duration: actualRecordingDuration,
            fileSize: currentVideoSize
        });
    }

    // #claude v27: Use actual recording duration (not time until Accept clicked)
    const duration = actualRecordingDuration; // #claude

    // #claude v48: Get video stream settings for resolution and FPS
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const resolution = `${settings.width}x${settings.height}`;
    const frameRate = settings.frameRate || 30;

    // #claude v48: Detect browser
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Opera') || ua.includes('OPR/')) {
        browser = 'Opera';
    } else if (ua.includes('Edg')) {
        browser = 'Edge';
    } else if (ua.includes('Chrome')) {
        browser = 'Chrome';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'Safari';
    } else if (ua.includes('Firefox')) {
        browser = 'Firefox';
    }

    const metadata = { // #claude
        videoId: currentVideoId, // #claude
        promptId: currentVideo.id, // Dynamic from current video // #claude
        fileSize: currentVideoSize, // #claude v12: Use stored size (already inflated)
        originalSize: window.currentOriginalSize, // #claude v51: Original size before inflation
        calculatedBitrate: window.currentCalculatedBitrate, // #claude v51: Bits per second (before inflation)
        calculatedBitrateMbps: window.currentCalculatedBitrate ? (window.currentCalculatedBitrate / 1000000).toFixed(2) : null, // #claude v51: Mbps for display
        duration: duration, // #claude v27: Actual recording duration
        codec: mediaRecorder.mimeType, // #claude
        chunkCount: 1, // #claude v12: Single blob after inflation
        resolution: resolution, // #claude v48
        frameRate: frameRate, // #claude v48
        browser: browser // #claude v48
    }; // #claude

    console.log('💾 Saving metadata:', metadata); // #claude

    const saved = await FacialStorage.saveVideoMetadata(metadata); // #claude

    if (!saved) { // #claude
        alert('⚠️ Failed to save video. Please try again.'); // #claude
        // #claude v51: Log metadata save failure
        if (window.clientLogger) {
            window.clientLogger.error('metadata_save_failed', {
                videoId: currentVideoId,
                promptId: currentVideo?.id
            });
        }
        // #claude v20: Re-enable buttons on error
        acceptBtn.disabled = false;
        retakeBtn.disabled = false;
        console.log('🔓 Buttons re-enabled after error');
        return; // #claude
    } // #claude

    console.log('✅ Metadata saved'); // #claude

    // #claude v51: Log metadata saved successfully
    if (window.clientLogger) {
        window.clientLogger.info('metadata_saved_successfully', {
            videoId: currentVideoId,
            promptId: currentVideo.id,
            duration: duration,
            fileSize: currentVideoSize
        });
    }

    const finalFileSize = currentVideoSize; // #claude v12

    // #claude v51: Log before enqueue check
    if (window.clientLogger) {
        window.clientLogger.info('before_enqueue_check', {
            videoId: currentVideoId,
            hasBackendSession: !!window.backendSessionId,
            hasUploadManager: !!window.uploadManager,
            hasBlobContent: !!currentBlob,
            blobSize: currentBlob ? currentBlob.size : 0
        });
    }

    // Enqueue for background upload (non-blocking) // #claude
    if (window.backendSessionId && window.uploadManager) { // #claude
        console.log('📤 Enqueuing video for background upload...'); // #claude

        // #claude v51: Log that we entered the if block
        if (window.clientLogger) {
            window.clientLogger.info('entered_enqueue_block', {
                videoId: currentVideoId
            });
        }

        // #claude v51: Log enqueue attempt
        if (window.clientLogger) {
            window.clientLogger.info('attempting_enqueue', {
                videoId: currentVideoId,
                promptId: currentVideo.id,
                blobExists: !!currentBlob,
                blobSize: currentBlob ? currentBlob.size : 0
            });
        }

        // Prepare upload metadata // #claude
        const videoTrack = stream?.getVideoTracks()[0]; // #claude
        const settings = videoTrack?.getSettings(); // #claude

        const uploadMetadata = { // #claude
            videoId: currentVideoId, // #claude
            prompt_id: currentVideo.id, // #claude
            duration: duration, // #claude
            file_size: finalFileSize, // Updated to use inflated size if TEST_MODE enabled // #claude
            original_size: window.currentOriginalSize, // #claude v51: Pre-inflation size
            calculated_bitrate: window.currentCalculatedBitrate, // #claude v51: Bits per second (before inflation)
            calculated_bitrate_mbps: window.currentCalculatedBitrate ? (window.currentCalculatedBitrate / 1000000).toFixed(2) : null, // #claude v51: Mbps for display
            codec: mediaRecorder.mimeType, // #claude
            resolution: settings ? `${settings.width}x${settings.height}` : 'unknown', // #claude
            frame_rate: settings?.frameRate || 30, // #claude
            camera_model: videoTrack?.label || 'Unknown Camera', // #claude
            browser: navigator.userAgent.split(' ').slice(-2).join(' '), // #claude
            timestamp: new Date().toISOString() // #claude
        }; // #claude

        // Enqueue (non-blocking - returns immediately) // #claude
        // #claude v15: Pass blob directly from memory (no IndexedDB retrieval)
        console.log('📤 V15: Passing blob directly from memory to upload manager...');
        try {
            await window.uploadManager.enqueueVideo(currentVideoId, currentVideo.id, uploadMetadata, currentBlob); // #claude v15: Added blob parameter
            console.log('✅ Video enqueued for upload with in-memory blob'); // #claude

            // #claude v51: Log video enqueued
            if (window.clientLogger) {
                window.clientLogger.event('video_enqueued_for_upload', {
                    videoId: currentVideoId,
                    promptId: currentVideo.id,
                    fileSize: finalFileSize,
                    queueLength: window.uploadManager.getSummary().total // #claude v51: Fixed - use getSummary().total not getQueue()
                });
            }
        } catch (enqueueErr) {
            // #claude v51: Log enqueue failure
            console.error('❌ Failed to enqueue video:', enqueueErr);
            if (window.clientLogger) {
                window.clientLogger.error('enqueue_video_failed', {
                    error: enqueueErr.message,
                    name: enqueueErr.name,
                    stack: enqueueErr.stack,
                    videoId: currentVideoId
                });
            }
            throw enqueueErr; // Re-throw to be caught by outer handler
        }
    } else { // #claude
        console.warn('⚠️ Backend session or upload manager not available, skipping upload'); // #claude
        // #claude v51: Log missing upload manager
        if (window.clientLogger) {
            window.clientLogger.warn('upload_manager_not_available', {
                hasBackendSession: !!window.backendSessionId,
                hasUploadManager: !!window.uploadManager
            });
        }
    } // #claude

    // Mark current video as complete and advance // #claude
    const hasMoreVideos = SessionState.completeCurrentVideo(); // #claude

    // #claude v51: Log advancement decision
    if (window.clientLogger) {
        window.clientLogger.info('video_completed', {
            videoId: currentVideoId,
            promptId: currentVideo.id,
            hasMoreVideos: hasMoreVideos
        });
    }

    if (hasMoreVideos) { // #claude
        // More videos to record - load next video and show instruction screen // #claude
        console.log(`➡️ Advancing to next video...`); // #claude
        // #claude v80: Debug video transition
        debugLog(`🔄 V80: Advancing to video ${SessionState.getCurrentVideoNumber()}/${SessionState.getTotalVideos()}`);
        debugLog(`🎥 V80: Stream before loadCurrentVideo: ${stream ? (stream.active ? 'ACTIVE' : 'INACTIVE') : 'NULL'}`);

        // #claude v51: Log advancing
        if (window.clientLogger) {
            window.clientLogger.info('advancing_to_next_video', {
                fromVideoId: currentVideoId,
                toVideoIndex: SessionState.getCurrentVideoNumber()
            });
        }
        resetDecisionButtons(); // #claude v18: Re-enable buttons for next video
        debugLog(`📹 V80: About to call loadCurrentVideo()...`);
        await loadCurrentVideo(); // #claude
        debugLog(`📺 V80: About to show instruction screen...`);
        showScreen('instruction'); // #claude
        debugLog(`✅ V80: Transition to next video complete`);
    } else { // #claude
        // Session complete - WAIT for uploads before navigating // #claude
        console.log('🎉 Session complete!'); // #claude
        console.log('⏳ V44: Waiting for all uploads to complete before navigation...'); // #claude
        // #claude v51: Log waiting for uploads
        if (window.clientLogger) {
            window.clientLogger.info('waiting_for_uploads', {
                queueLength: window.uploadManager ? window.uploadManager.getSummary().total : 0 // #claude v51: Fixed - use getSummary().total not getQueue()
            });
        }

        // #claude v20: Exit fullscreen before navigation
        await exitFullscreen();

        // #claude v44: Show upload modal with progress tracking
        showUploadModal();
        updateUploadModal('📤 Uploading videos...', 'Please wait while your recordings are being uploaded.', 0);

        // Track upload progress
        const progressInterval = setInterval(() => {
            if (window.uploadManager) {
                const summary = window.uploadManager.getSummary();
                const totalVideos = summary.total;
                const completedVideos = summary.completed;
                const uploadingCount = summary.uploading;
                const pendingCount = summary.pending;
                const percent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

                // Check if all uploads are complete (no more pending or uploading)
                if (pendingCount === 0 && uploadingCount === 0) {
                    // All done - show finalizing message
                    updateUploadModal(
                        `✅ Upload Complete`,
                        `All ${totalVideos} videos uploaded successfully`,
                        100
                    );
                } else {
                    // Still uploading - show current video number (completed + 1 is the one being uploaded)
                    const currentVideo = completedVideos + 1;
                    updateUploadModal(
                        `📤 Uploading videos...`,
                        `Uploading video ${currentVideo} of ${totalVideos}`,
                        percent
                    );
                }
            }
        }, 500); // Update every 500ms

        // Wait for all uploads (5 min timeout)
        const uploadResult = await window.uploadManager.waitForCompletion(300000);

        // Stop progress tracking
        clearInterval(progressInterval);

        if (uploadResult.success) {
            console.log(`✅ All ${uploadResult.completed} uploads complete, navigating to completion page...`);
            updateUploadModal('✅ Upload Complete!', `All ${uploadResult.completed} videos uploaded successfully.`, 100);
            // #claude v51: Log session completion
            if (window.clientLogger) {
                window.clientLogger.event('session_completed', {
                    totalVideos: uploadResult.completed,
                    success: true
                });
            }
            await new Promise(r => setTimeout(r, 1500)); // Brief pause to show success
        } else {
            console.warn(`⚠️ Upload incomplete: ${uploadResult.completed} completed, ${uploadResult.failed} failed, ${uploadResult.pending} pending`);
            updateUploadModal('⚠️ Upload Incomplete', `${uploadResult.completed} uploaded, ${uploadResult.failed} failed.`, 100);
            // #claude v51: Log incomplete session
            if (window.clientLogger) {
                window.clientLogger.warn('session_incomplete', {
                    completed: uploadResult.completed,
                    failed: uploadResult.failed,
                    pending: uploadResult.pending
                });
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        hideUploadModal();

        window.location.href = '/complete-v2.html'; // #claude - Navigate AFTER uploads complete
    } // #claude
} // #claude

async function handleRetake() { // #claude - made async
    console.log('🔄 Retaking video');

    // #claude v51: Log retake clicked
    if (window.clientLogger) {
        window.clientLogger.event('retake_clicked', {
            videoId: currentVideoId,
            promptId: currentVideo?.id,
            duration: actualRecordingDuration
        });
    }

    // #claude v18: Re-enable buttons for retake
    resetDecisionButtons();

    // #claude v50: Cancel pending upload if queued (prevents duplicate queue entries)
    if (window.uploadManager && currentVideo) {
        const cancelled = window.uploadManager.cancelUpload(currentVideo.id);
        if (cancelled) {
            console.log(`🗑️ V50: Cancelled pending upload for ${currentVideo.id}`);
        }
    }

    // #claude v15: Clear memory blob (no IndexedDB cleanup needed)
    currentBlob = null;
    console.log('💾 V15: Memory blob cleared');

    // Discard recorded chunks // #claude v12
    recordedChunks = [];
    currentVideoSize = 0; // #claude v12
    actualRecordingDuration = 0; // #claude v27: Reset duration

    // Reset UI and restart recording flow
    showScreen('instruction');
}

// =============================================================================
// Event Listeners
// =============================================================================

// Global flag to prevent duplicate listener attachment #claude v93
let listenersAttached = false;

// Ensure DOM is ready before attaching event listeners
function attachEventListeners() {
    // #claude v93: Check if listeners already attached
    if (listenersAttached) {
        console.log('✅ V93: Event listeners already attached, skipping');
        return;
    }

    const startBtn = document.getElementById('startBtn');
    if (!startBtn) {
        console.error('❌ startBtn not found! Retrying in 100ms...');
        setTimeout(attachEventListeners, 100);
        return;
    }

    console.log('🔗 V93: Attaching event listeners...'); // #claude v93

    startBtn.addEventListener('click', async () => {
        try { // #claude v77: Wrap entire flow in try-catch
            debugLog('🚀 START BUTTON CLICKED'); // #claude v77

            // #claude v74: Show recording screen FIRST (so preview element is visible)
            debugLog('📺 Showing recording screen...'); // #claude v74
            showScreen('recording');
            debugLog('✅ Recording screen shown'); // #claude v77
            console.log('%c✅✅✅ LINE 1526 EXECUTED','background: #ff0000; color: #ffffff; font-size: 20px; padding: 10px;'); // #claude v78: Force console log

            // #claude v74: Initialize camera SECOND (preview element now visible)
            console.log('%c📹📹📹 LINE 1529 ABOUT TO RUN','background: #0000ff; color: #ffffff; font-size: 20px; padding: 10px;'); // #claude v78: Force console log
            debugLog('📹 Initializing camera...'); // #claude v74
            const cameraOk = await initializeCamera();
            if (!cameraOk) {
                debugLog('❌ Camera failed!', true); // #claude v74
                showScreen('instruction');
            return;
        }
        debugLog('✅ Camera OK'); // #claude v74

        // #claude v80: Debug preview element state after camera init
        const preview = document.getElementById('preview');
        if (preview) {
            const rect = preview.getBoundingClientRect();
            debugLog(`📐 V80: Preview size: ${Math.round(rect.width)}x${Math.round(rect.height)}px`);
            debugLog(`👁️ V80: Preview visible: ${rect.width > 0 && rect.height > 0}`);
            const style = window.getComputedStyle(preview);
            debugLog(`🎨 V80: object-fit: ${style.objectFit}, position: ${style.position}`);
        }

        // #claude v82: iOS fullscreen DISABLED, Android fullscreen ENABLED
        const isIOS = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

        // Get video number safely (with fallback if SessionState not ready)
        let videoNum = 1;
        try {
            if (typeof SessionState !== 'undefined' && SessionState.getCurrentVideoNumber) {
                videoNum = SessionState.getCurrentVideoNumber();
            }
        } catch (err) {
            debugLog(`⚠️ V82: Could not get video number: ${err.message}`);
        }
        debugLog(`📱 V82: Device check - iOS/iPad: ${isIOS}, Video: ${videoNum}`); // #claude v82

        let fullscreenResult = false;
        if (isIOS) {
            // iOS: Skip fullscreen entirely (disabled per user request)
            debugLog('⚠️ V82: iOS detected - fullscreen DISABLED'); // #claude v82
            fullscreenResult = false;
        } else {
            // Android/Desktop: Enable fullscreen
            debugLog('✅ V82: Android/Desktop - attempting fullscreen'); // #claude v82
            fullscreenResult = await enterFullscreen(); // #claude v82
            debugLog(`${fullscreenResult ? '✅' : '⚠️'} V82: Fullscreen ${fullscreenResult ? 'SUCCESS' : 'FAILED'}`); // #claude v82
        }

        // #claude v80: Debug video element CSS after fullscreen attempt
        const videoContainer = document.querySelector('.video-container');
        const videoElement = document.getElementById('preview');
        if (videoContainer && videoElement) {
            const containerStyle = window.getComputedStyle(videoContainer);
            const videoStyle = window.getComputedStyle(videoElement);
            debugLog(`🎨 V80: Container position: ${containerStyle.position}, height: ${containerStyle.height}`);
            debugLog(`🎨 V80: Video object-fit: ${videoStyle.objectFit}, width: ${videoStyle.width}x${videoStyle.height}`);
            const videoRect = videoElement.getBoundingClientRect();
            debugLog(`📏 V80: Video actual: ${Math.round(videoRect.width)}x${Math.round(videoRect.height)}px`);
        }

        // Acquire wake lock
        debugLog('🔒 Acquiring wake lock...'); // #claude v74
        await acquireWakeLock();
        debugLog('✅ Wake lock acquired'); // #claude v74

        // Start countdown then recording
        debugLog('⏱️ Starting countdown...'); // #claude v74
        await showCountdown();
        debugLog('✅ Countdown done'); // #claude v77

        debugLog('🎬 Starting recording...'); // #claude v74
        await startRecording();
        debugLog('✅ Recording started'); // #claude v77
    } catch (err) { // #claude v77
        debugLog(`❌ ERROR in start flow: ${err.message}`, true); // #claude v77
        debugLog(`❌ Stack: ${err.stack}`, true); // #claude v77
        console.error('Start button error:', err); // #claude v77
    } // #claude v77
});

document.getElementById('stopBtn').addEventListener('click', () => {
    stopRecording();
});

document.getElementById('acceptBtn').addEventListener('click', async () => {
    console.log('✅ V42: Accept button clicked');
    try {
        await handleAccept();
    } catch (err) {
        console.error('❌ Error in handleAccept:', err);
        // #claude v51: Log the error to backend
        if (window.clientLogger) {
            window.clientLogger.error('handle_accept_failed', {
                error: err.message,
                name: err.name,
                stack: err.stack,
                videoId: currentVideoId,
                promptId: currentVideo?.id
            });
        }
        // Re-enable buttons on error
        document.getElementById('acceptBtn').disabled = false;
        document.getElementById('retakeBtn').disabled = false;
        alert('Error accepting video. Please try again or retake.');
    }
    });

    document.getElementById('retakeBtn').addEventListener('click', async () => {
        console.log('🔄 V42: Retake button clicked');
        try {
            await handleRetake();
        } catch (err) {
            console.error('❌ Error in handleRetake:', err);
            // Re-enable buttons on error
            document.getElementById('acceptBtn').disabled = false;
            document.getElementById('retakeBtn').disabled = false;
            alert('Error during retake. Please try again.');
        }
    });

    // #claude v93: Mark listeners as attached
    listenersAttached = true;

    console.log('✅ V93: All event listeners attached successfully');
    console.log('  - startBtn:', !!document.getElementById('startBtn'));
    console.log('  - stopBtn:', !!document.getElementById('stopBtn'));
    console.log('  - acceptBtn:', !!document.getElementById('acceptBtn'));
    console.log('  - retakeBtn:', !!document.getElementById('retakeBtn'));
}

// Call the function to attach event listeners
attachEventListeners();

// #claude v93: Handle page restore from bfcache (browser back/forward cache)
// This fixes the issue where the button doesn't work after returning home and starting a new recording
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Page was restored from bfcache
        console.log('🔄 V93: Page restored from bfcache, resetting listeners');
        listenersAttached = false;
        attachEventListeners();
    }
});

// =============================================================================
// Page Unload Handler
// =============================================================================

window.addEventListener('beforeunload', (event) => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        event.preventDefault();
        event.returnValue = 'Recording in progress. Are you sure you want to leave?';
        return event.returnValue;
    }

    // Cleanup
    exitFullscreen(); // #claude v20: Exit fullscreen on page unload
    releaseWakeLock();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});

// ============================================================================= // #claude
// Console Banner // #claude
// ============================================================================= // #claude

console.log('%c📹 Facial Data Collection - Milestone 4', 'font-size: 16px; font-weight: bold; color: #007aff;'); //#claude - Updated to Milestone 4
console.log('✅ Codec detection'); // #claude
console.log('✅ Text overlay system'); // #claude
console.log('✅ Accept/Retake flow (NO playback)'); // #claude
console.log('✅ Interruption detection'); // #claude
console.log('✅ Wake Lock + silent audio fallback'); // #claude
console.log('✅ IndexedDB persistence with chunked storage'); // #claude
console.log('✅ Multi-video sequence'); // #claude
console.log('✅ Backend upload integration'); //#claude - NEW
console.log('✅ Text overlays at top (near camera)'); // #claude
console.log('✅ Fullscreen mode + smaller video (V20)'); // #claude v20
console.log('✅ Clean UI - no overhead elements'); // #claude v20

// Debug: Check camera API availability #claude
console.log('🔍 Checking camera API availability:'); // #claude
console.log('  - navigator:', typeof navigator); // #claude
console.log('  - navigator.mediaDevices:', typeof navigator.mediaDevices); // #claude
console.log('  - getUserMedia:', typeof navigator.mediaDevices?.getUserMedia); // #claude
console.log('  - window.location:', window.location.href); // #claude
console.log('  - isSecureContext:', window.isSecureContext); // #claude

console.log('Ready to record!'); // #claude

// ============================================================================= // #claude
// Initialization - Load Session State & Current Video // #claude
// ============================================================================= // #claude

(async function initialize() {
    try {
        console.log('🚀 Initializing session...');

        if (typeof FacialStorage === 'undefined') {
            console.error('❌ FacialStorage not loaded yet');
            return;
        }

        if (typeof SessionState === 'undefined') {
            console.error('❌ SessionState not loaded yet');
            return;
        }

        if (typeof VideoUploader === 'undefined') {
            console.error('❌ VideoUploader not loaded yet');
            return;
        }

        if (typeof UploadManager === 'undefined') { // #claude
            console.error('❌ UploadManager not loaded yet'); // #claude
            return; // #claude
        } // #claude

        // Initialize upload manager and resume any pending uploads // #claude
        window.uploadManager = UploadManager.resumeUploads(); // #claude

        // Initialize session state // #claude
        const stateOk = await SessionState.init(); // #claude
        if (!stateOk) { // #claude
            alert('❌ Failed to load session state. Please refresh the page.'); // #claude
            return; // #claude
        } // #claude

        // #claude v20: If this is a NEW session (no videos recorded yet), clear old upload queue
        const summary = SessionState.getSessionSummary();
        if (summary.completedCount === 0 && summary.currentIndex === 0) {
            console.log('🆕 New session detected - clearing old upload queue');
            window.uploadManager.clearQueue();
        } else {
            console.log(`📋 Resuming session: ${summary.completedCount} videos already recorded`);
        }

        // Create or retrieve backend session ID //#claude
        let backendSessionId = localStorage.getItem('backendSessionId'); //#claude
        if (!backendSessionId) { //#claude
            console.log('🌐 Creating backend session...'); //#claude
            try { //#claude
                backendSessionId = await VideoUploader.createSession(); //#claude
                localStorage.setItem('backendSessionId', backendSessionId); //#claude
                console.log(`✅ Backend session created: ${backendSessionId}`); //#claude
            } catch (err) { //#claude
                console.error('❌ Failed to create backend session:', err); //#claude
                console.warn('⚠️ Continuing without backend upload'); //#claude
            } //#claude
        } else { //#claude
            console.log(`✅ Using existing backend session: ${backendSessionId}`); //#claude
        } //#claude
        window.backendSessionId = backendSessionId; //#claude - Store globally

        // #claude v51: Initialize client logger with session ID
        if (window.clientLogger && backendSessionId) {
            window.clientLogger.init(backendSessionId);
            window.clientLogger.event('session_initialized', {
                sessionId: backendSessionId,
                userAgent: navigator.userAgent,
                screenSize: `${window.screen.width}x${window.screen.height}`,
                videosToRecord: SessionState.getAllVideos().length // #claude v51: Fixed - use getAllVideos() not getVideos()
            });
        }

        // Check if session is complete // #claude
        if (SessionState.isSessionComplete()) { // #claude
            console.log('🎉 Session already complete, redirecting...'); // #claude
            window.location.href = '/complete-v2.html'; // #claude - Force new file to bypass cache
            return; // #claude
        } // #claude

        // Load current video // #claude
        const videoOk = await loadCurrentVideo(); // #claude
        if (!videoOk) { // #claude
            alert('❌ Failed to load video definition. Please refresh the page.'); // #claude
            return; // #claude
        } // #claude

        console.log('✅ Session initialized successfully'); // #claude

        // Check for existing recordings // #claude
        const progress = await FacialStorage.getSessionProgress(); // #claude
        console.log('📊 Session progress:', progress); // #claude

        if (progress.totalRecorded > 0) { // #claude
            console.log(`💾 Found ${progress.totalRecorded} existing video(s) in storage`); // #claude

            progress.videos.forEach((video, index) => { // #claude
                console.log(`  ${index + 1}. ${video.videoId} - ${(video.fileSize / 1024 / 1024).toFixed(2)} MB - ${video.codec}`); // #claude
            }); // #claude

            const instructionStatus = document.getElementById('instructionStatus'); // #claude
            instructionStatus.textContent = `You have ${progress.totalRecorded} video(s) saved locally. ${SessionState.getProgressString()}`; // #claude
            instructionStatus.className = 'status-message success'; // #claude
            instructionStatus.classList.remove('hidden'); // #claude

            setTimeout(() => { // #claude
                instructionStatus.classList.add('hidden'); // #claude
            }, 5000); // #claude
        } else { // #claude
            console.log('📁 No existing videos found'); // #claude
        } // #claude

        // Check storage quota // #claude
        const hasEnoughStorage = await FacialStorage.checkStorageQuota(250); // #claude
        if (!hasEnoughStorage) { // #claude
            const instructionStatus = document.getElementById('instructionStatus'); // #claude
            instructionStatus.textContent = 'Warning: Low storage space. Please free up space before recording.'; // #claude
            instructionStatus.className = 'status-message warning'; // #claude
            instructionStatus.classList.remove('hidden'); // #claude
        } // #claude
    } catch (err) { // #claude
        console.error('❌ Initialization error:', err); // #claude
        console.error('Stack trace:', err.stack); // #claude
        // #claude v51: Log initialization error
        if (window.clientLogger) {
            window.clientLogger.error('initialization_failed', {
                error: err.message,
                name: err.name,
                stack: err.stack
            });
        }
    } // #claude
})(); // #claude

// #claude v51: Global error handler for uncaught errors
window.addEventListener('error', (event) => {
    console.error('❌ Uncaught error:', event.error);
    if (window.clientLogger) {
        window.clientLogger.error('uncaught_error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error?.message,
            stack: event.error?.stack
        });
    }
});

// #claude v51: Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
    if (window.clientLogger) {
        window.clientLogger.error('unhandled_rejection', {
            reason: event.reason?.message || String(event.reason),
            stack: event.reason?.stack
        });
    }
});
