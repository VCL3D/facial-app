/**
 * Session State Management for Multi-Video Sequence
 *
 * Handles:
 * - Loading video definitions from videos.json
 * - Tracking current video index (1/3, 2/3, 3/3)
 * - Managing session progress
 * - Auto-advancing to next video after accept
 * - Detecting session completion
 */

const SessionState = (function() {
    'use strict';

    // State variables
    let videos = [];
    let currentVideoIndex = 0;
    let sessionId = null;
    let completedVideos = [];

    /**
     * Initialize session - load videos and set session ID
     */
    async function init() {
        try {
            console.log('🎬 Initializing session state...');

            sessionId = localStorage.getItem('facial_session_id');
            if (!sessionId) {
                sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('facial_session_id', sessionId);
                console.log('🆕 Created new session:', sessionId);
            } else {
                console.log('📂 Retrieved existing session:', sessionId);
            }

            const response = await fetch(`/data/videos.json?nocache=${Date.now()}`); //#claude - Cache-busting to ensure fresh videos.json on every load
            if (!response.ok) {
                throw new Error(`Failed to load videos.json: ${response.statusText}`);
            }

            videos = await response.json();
            console.log(`✅ Loaded ${videos.length} video definitions`);

            window.sessionExpectedVideoCount = videos.length;

            await loadProgress();

            return true;
        } catch (err) {
            console.error('❌ Failed to initialize session state:', err);
            return false;
        }
    }

    /**
     * Load session progress from IndexedDB
     */
    async function loadProgress() {
        try {
            if (typeof FacialStorage === 'undefined') {
                console.warn('⚠️ FacialStorage not loaded, skipping progress load');
                return;
            }

            const health = await FacialStorage.validateSessionHealth();

            if (!health.isHealthy) {
                console.error('🚨 Data corruption detected on load:', health.issues);
                showCorruptionBanner(health);

                localStorage.clear();
                await FacialStorage.clearAllVideos();

                completedVideos = [];
                currentVideoIndex = 0;

                console.log('✅ Corrupted data auto-cleared. Page will reload...');

                setTimeout(() => {
                    window.location.reload();
                }, 2000);

                return;
            }

            const progress = await FacialStorage.getSessionProgress();
            completedVideos = progress.videos.map(v => v.promptId);

            for (let i = 0; i < videos.length; i++) {
                if (!completedVideos.includes(videos[i].id)) {
                    currentVideoIndex = i;
                    console.log(`📍 Resuming at video ${i + 1}/${videos.length}: ${videos[i].name}`);
                    return;
                }
            }

            if (completedVideos.length >= videos.length) {
                console.log('🎉 Session already complete!');
                currentVideoIndex = videos.length;
            }
        } catch (err) {
            console.error('❌ Failed to load progress:', err);
        }
    }

    /**
     * Display corruption banner with clear action
     */
    function showCorruptionBanner(health) {
        const banner = document.createElement('div');
        banner.id = 'corruptionBanner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #ff3b30, #ff9500);
            color: white;
            padding: 20px;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        banner.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                🚨 Data Corruption Detected
            </div>
            <div style="font-size: 14px; margin-bottom: 15px;">
                ${health.issues.join(', ')}
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                Auto-clearing data and reloading in 2 seconds...
            </div>
        `;

        document.body.prepend(banner);
    }

    /**
     * Get current video definition
     */
    function getCurrentVideo() {
        if (currentVideoIndex >= videos.length) {
            return null; // Session complete
        }
        return videos[currentVideoIndex];
    }

    /**
     * Get current video number (1-indexed for display)
     */
    function getCurrentVideoNumber() {
        return currentVideoIndex + 1;
    }

    /**
     * Get total number of videos
     */
    function getTotalVideos() {
        return videos.length;
    }

    /**
     * Get progress string for UI (e.g., "Video 2 of 3")
     */
    function getProgressString() {
        if (currentVideoIndex >= videos.length) {
            return 'Session Complete!';
        }
        return `Video ${currentVideoIndex + 1} of ${videos.length}`;
    }

    /**
     * Check if current video is last video
     */
    function isLastVideo() {
        return currentVideoIndex === videos.length - 1;
    }

    /**
     * Check if session is complete
     */
    function isSessionComplete() {
        return currentVideoIndex >= videos.length;
    }

    /**
     * Mark current video as complete and advance to next
     */
    function completeCurrentVideo() {
        const video = getCurrentVideo();
        if (video) {
            completedVideos.push(video.id);
            console.log(`✅ Completed: ${video.name} (${video.id})`);
        }

        currentVideoIndex++;
        console.log(`➡️ Advanced to video ${currentVideoIndex + 1}/${videos.length}`);

        return !isSessionComplete();
    }

    /**
     * Get all videos
     */
    function getAllVideos() {
        return videos;
    }

    /**
     * Get session ID
     */
    function getSessionId() {
        return sessionId;
    }

    /**
     * Get completed video IDs
     */
    function getCompletedVideos() {
        return [...completedVideos];
    }

    /**
     * Reset session (for testing)
     */
    function resetSession() {
        currentVideoIndex = 0;
        completedVideos = [];
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('facial_session_id', sessionId);
        console.log('🔄 Session reset:', sessionId);
    }

    /**
     * Get session summary
     */
    function getSessionSummary() {
        return {
            sessionId: sessionId,
            totalVideos: videos.length,
            completedCount: completedVideos.length,
            currentVideo: getCurrentVideoNumber(),
            isComplete: isSessionComplete(),
            completedVideoIds: completedVideos
        };
    }

    // Public API
    return {
        init,
        getCurrentVideo,
        getCurrentVideoNumber,
        getTotalVideos,
        getProgressString,
        isLastVideo,
        isSessionComplete,
        completeCurrentVideo,
        getAllVideos,
        getSessionId,
        getCompletedVideos,
        resetSession,
        getSessionSummary
    };
})();

console.log('📊 State module loaded'); //#claude
