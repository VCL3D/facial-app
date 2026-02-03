// Facial Data Collection - Recorder Module
// Milestone 3: Multi-Video Sequence // #claude

// =============================================================================
// VERSION MARKER - V19 (CAMERA-AWARE UI) // #claude
// =============================================================================
console.log('%c🔥 RECORDER-V19.JS LOADED 🔥', 'background: #00ff00; color: #000000; font-size: 20px; font-weight: bold; padding: 10px;'); // #claude
console.log('V19: CAMERA-AWARE UI - Text at top, camera indicator'); // #claude

// Update visible version badge on screen (no console needed!)
if (document.getElementById('versionBadge')) {
    document.getElementById('versionBadge').textContent = '✅ V19 - Camera UI';
    document.getElementById('versionBadge').style.background = '#00ff00';
    document.getElementById('versionBadge').style.color = '#000000';
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

let currentVideo = null; // Current video definition from videos.json // #claude
let prompts = []; // Prompts for current video // #claude
let TOTAL_RECORDING_DURATION = 0; // Total duration for current video // #claude

// =============================================================================
// Configuration
// =============================================================================

// Prompts now loaded from videos.json via SessionState // #claude

// =============================================================================
// Codec Detection (from prototype)
// =============================================================================

function getBestCodec() {
    const codecs = [
        'video/webm; codecs="vp9,opus"',     // Safari 18.4+, all Android
        'video/webm; codecs="vp8,opus"',     // Firefox, older Android
        'video/webm; codecs=vp9',             // VP9 video only
        'video/webm; codecs=vp8',             // VP8 video only
        'video/webm',                         // Generic WebM
        'video/mp4; codecs="avc1.42E01E"',   // H.264 for iOS
        'video/mp4'                           // Generic MP4
    ];

    for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
            console.log('✅ Using codec:', codec);
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
    try {
        // Create minimal silent WAV file (1 second of silence)
        const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        silentAudio = new Audio(silentWav);
        silentAudio.loop = true;
        silentAudio.volume = 0;

        await silentAudio.play();
        console.log('✅ Silent audio loop started (Wake Lock fallback)');
        return true;
    } catch (err) {
        console.error('❌ Silent audio fallback failed:', err);
        showStatus('Warning: Screen may sleep during recording', 'warning');
        return false;
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
    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden'); // #claude
        screen.classList.remove('visible'); // #claude
    });
    screens[screenName].classList.remove('hidden'); // #claude
    screens[screenName].classList.add('visible'); // #claude
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
// Camera Initialization
// =============================================================================

async function initializeCamera() {
    try {
        showStatus('Requesting camera access...', 'info');

        // Check if mediaDevices API is available #claude
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { // #claude
            throw new Error('Camera API not available. Please use a modern browser over HTTPS or localhost.'); // #claude
        } // #claude

        const constraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 60, min: 30 },
                facingMode: 'user'
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

        // Setup interruption detection
        setupInterruptionDetection();

        hideStatus();
        return true;
    } catch (err) {
        console.error('❌ Camera error:', err);
        showStatus(`Camera error: ${err.message}. Please allow camera access.`, 'error');
        return false;
    }
}

// =============================================================================
// Countdown
// =============================================================================

async function showCountdown() {
    const overlay = document.getElementById('countdownOverlay');
    const numberEl = document.getElementById('countdownNumber');

    // #claude v23: Show camera indicator during countdown
    showCameraIndicator();

    overlay.classList.add('visible');

    for (let i = 3; i > 0; i--) {
        numberEl.textContent = i;
        numberEl.style.animation = 'none';
        // Trigger reflow to restart animation
        void numberEl.offsetWidth;
        numberEl.style.animation = 'countdownPulse 1s ease-out';

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    overlay.classList.remove('visible');

    // #claude v23: Hide camera indicator after countdown (text prompts will show instead)
    setTimeout(() => hideCameraIndicator(), 1000);
}

// =============================================================================
// Camera Indicator Management
// =============================================================================

function showCameraIndicator() {
    const indicator = document.getElementById('cameraIndicator');
    if (indicator) {
        indicator.classList.add('visible');
    }
}

function hideCameraIndicator() {
    const indicator = document.getElementById('cameraIndicator');
    if (indicator) {
        indicator.classList.remove('visible');
    }
}

// =============================================================================
// Text Overlay Management
// =============================================================================

function showTextOverlay(text) {
    const overlay = document.getElementById('textOverlay');
    const textEl = document.getElementById('overlayText');

    textEl.textContent = text;
    overlay.classList.add('visible');

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

    function showNextPrompt() {
        if (currentPromptIndex >= prompts.length) {
            // All prompts shown, stop recording
            stopRecording();
            return;
        }

        const prompt = prompts[currentPromptIndex];
        showTextOverlay(prompt.text);

        // Update progress bar
        const progress = ((currentPromptIndex + 1) / prompts.length) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;

        currentPromptIndex++;

        promptInterval = setTimeout(showNextPrompt, prompt.duration);
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
        // Generate unique video ID // #claude
        currentVideoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // #claude
        chunkIndex = 0; // #claude
        recordedChunks = []; // Track chunk metadata, not blobs // #claude

        const codec = getBestCodec();

        const options = {
            videoBitsPerSecond: 12000000,
            audioBitsPerSecond: 320000
        };

        if (codec) {
            options.mimeType = codec;
        }

        mediaRecorder = new MediaRecorder(stream, options);

        console.log('MediaRecorder created with mimeType:', mediaRecorder.mimeType);
        console.log(`📹 Video ID: ${currentVideoId}`); // #claude

        // #claude v13: Store chunks in MEMORY (not IndexedDB) for instant inflation
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data); // Store actual Blob in memory
                console.log(`📦 V13: Chunk ${recordedChunks.length} in MEMORY: ${(event.data.size / 1024).toFixed(0)}KB`);
            }
        };

        mediaRecorder.onstop = async () => { // #claude - made async
            const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
            console.log(`✅ Recording complete: ${duration}s`);
            console.log(`💾 V13: Captured ${recordedChunks.length} chunks in MEMORY (NOT IndexedDB)`); // #claude v13

            // #claude v13: Reassemble blob from MEMORY chunks (instant, no DB query)
            console.log('🔧 V13: Reassembling from MEMORY (instant)...');
            const originalBlob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'video/webm' });
            const originalSizeMB = (originalBlob.size / 1024 / 1024).toFixed(2);
            console.log(`File size: ${originalSizeMB} MB`);

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
            hideElement('recordingIndicator');
            hideElement('progressBar');
            hideElement('stopBtn');

            // Release wake lock
            releaseWakeLock();

            // #claude v18: Ensure buttons are enabled before showing decision screen
            resetDecisionButtons();

            // Show decision screen
            showScreen('decision');
        };

        mediaRecorder.onerror = (event) => {
            console.error('❌ MediaRecorder error:', event.error);
            showStatus(`Recording error: ${event.error.message}`, 'error');
        };

        // Start recording (request chunks every 5 seconds for Milestone 2)
        recordingStartTime = Date.now();
        mediaRecorder.start(5000);

        // Show recording UI
        showElement('recordingIndicator');
        document.getElementById('recordingIndicator').classList.add('active');
        showElement('progressBar');
        showElement('stopBtn');

        // Start prompt sequence
        startPromptSequence();

        console.log('🎬 Recording started');
    } catch (err) {
        console.error('❌ Recording error:', err);
        showStatus(`Recording failed: ${err.message}`, 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        showStatus('Processing recording...', 'info');
    }
}

// ============================================================================= // #claude
// Video Loading // #claude
// ============================================================================= // #claude

async function loadCurrentVideo() { // #claude
    try { // #claude
        currentVideo = SessionState.getCurrentVideo(); // #claude

        if (!currentVideo) { // #claude
            console.error('❌ No current video available'); // #claude
            return false; // #claude
        } // #claude

        console.log(`📹 Loading video: ${currentVideo.name} (${currentVideo.id})`); // #claude

        // Load prompts from current video // #claude
        prompts = currentVideo.prompts || []; // #claude
        TOTAL_RECORDING_DURATION = currentVideo.duration; // #claude

        // Update progress indicator // #claude
        updateProgressIndicator(); // #claude

        // Update instruction screen // #claude
        updateInstructionScreen(); // #claude

        return true; // #claude
    } catch (err) { // #claude
        console.error('❌ Failed to load video:', err); // #claude
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

    // #claude v12: Video already saved to IndexedDB in onstop (inflated if TEST_MODE)
    const duration = ((Date.now() - recordingStartTime) / 1000); // #claude

    const metadata = { // #claude
        videoId: currentVideoId, // #claude
        promptId: currentVideo.id, // Dynamic from current video // #claude
        fileSize: currentVideoSize, // #claude v12: Use stored size (already inflated)
        duration: duration, // #claude
        codec: mediaRecorder.mimeType, // #claude
        chunkCount: 1 // #claude v12: Single blob after inflation
    }; // #claude

    console.log('💾 Saving metadata:', metadata); // #claude

    const saved = await FacialStorage.saveVideoMetadata(metadata); // #claude

    if (!saved) { // #claude
        alert('⚠️ Failed to save video. Please try again.'); // #claude
        // #claude v20: Re-enable buttons on error
        acceptBtn.disabled = false;
        retakeBtn.disabled = false;
        console.log('🔓 Buttons re-enabled after error');
        return; // #claude
    } // #claude

    console.log('✅ Metadata saved'); // #claude

    const finalFileSize = currentVideoSize; // #claude v12

    // Enqueue for background upload (non-blocking) // #claude
    if (window.backendSessionId && window.uploadManager) { // #claude
        console.log('📤 Enqueuing video for background upload...'); // #claude

        // Prepare upload metadata // #claude
        const videoTrack = stream?.getVideoTracks()[0]; // #claude
        const settings = videoTrack?.getSettings(); // #claude

        const uploadMetadata = { // #claude
            videoId: currentVideoId, // #claude
            prompt_id: currentVideo.id, // #claude
            duration: duration, // #claude
            file_size: finalFileSize, // Updated to use inflated size if TEST_MODE enabled // #claude
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
        await window.uploadManager.enqueueVideo(currentVideoId, currentVideo.id, uploadMetadata, currentBlob); // #claude v15: Added blob parameter
        console.log('✅ Video enqueued for upload with in-memory blob'); // #claude
    } else { // #claude
        console.warn('⚠️ Backend session or upload manager not available, skipping upload'); // #claude
    } // #claude

    // Mark current video as complete and advance // #claude
    const hasMoreVideos = SessionState.completeCurrentVideo(); // #claude

    if (hasMoreVideos) { // #claude
        // More videos to record - load next video and show instruction screen // #claude
        console.log(`➡️ Advancing to next video...`); // #claude
        resetDecisionButtons(); // #claude v18: Re-enable buttons for next video
        await loadCurrentVideo(); // #claude
        showScreen('instruction'); // #claude
    } else { // #claude
        // Session complete - WAIT for uploads before navigating // #claude
        console.log('🎉 Session complete!'); // #claude
        console.log('⏳ V15: Waiting for all uploads to complete before navigation...'); // #claude

        // Show status to user
        showStatus('⏳ Uploading videos...', 'info');

        // Wait for all uploads (5 min timeout)
        const uploadResult = await window.uploadManager.waitForCompletion(300000);

        if (uploadResult.success) {
            console.log(`✅ All ${uploadResult.completed} uploads complete, navigating to completion page...`);
            showStatus(`✅ ${uploadResult.completed} videos uploaded!`, 'success');
            await new Promise(r => setTimeout(r, 1000)); // Brief pause to show success
        } else {
            console.warn(`⚠️ Upload incomplete: ${uploadResult.completed} completed, ${uploadResult.failed} failed, ${uploadResult.pending} pending`);
            showStatus('⚠️ Some uploads incomplete', 'warning');
        }

        window.location.href = '/complete-v2.html'; // #claude - Navigate AFTER uploads complete
    } // #claude
} // #claude

async function handleRetake() { // #claude - made async
    console.log('🔄 Retaking video');

    // #claude v18: Re-enable buttons for retake
    resetDecisionButtons();

    // #claude v15: Clear memory blob (no IndexedDB cleanup needed)
    currentBlob = null;
    console.log('💾 V15: Memory blob cleared');

    // Discard recorded chunks // #claude v12
    recordedChunks = [];
    currentVideoSize = 0; // #claude v12

    // Reset UI and restart recording flow
    showScreen('instruction');
}

// =============================================================================
// Event Listeners
// =============================================================================

document.getElementById('startBtn').addEventListener('click', async () => {
    // Initialize camera
    const cameraOk = await initializeCamera();
    if (!cameraOk) return;

    // Acquire wake lock
    await acquireWakeLock();

    // Show recording screen
    showScreen('recording');

    // Start countdown then recording
    await showCountdown();
    await startRecording();
});

document.getElementById('stopBtn').addEventListener('click', () => {
    stopRecording();
});

document.getElementById('acceptBtn').addEventListener('click', () => {
    handleAccept();
});

document.getElementById('retakeBtn').addEventListener('click', () => {
    handleRetake();
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
    } // #claude
})(); // #claude
