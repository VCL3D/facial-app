// Facial Data Collection - IndexedDB Storage Module
// Milestone 2: Persistent storage with chunked recording (iOS resilience)

// =============================================================================
// Database Schema
// =============================================================================

const db = new Dexie('FacialDataCollection');

db.version(1).stores({
    // Chunks stored DURING recording (iOS resilience pattern)
    chunks: '++id, videoId, chunkIndex, timestamp',

    // Video metadata and status
    videos: 'videoId, promptId, status, recordedAt, fileSize, duration, codec'
});

// #claude - Server logger for mobile debugging
async function logToServer(level, message, context = {}) {
    try {
        await fetch('/api/log/client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message: `[FacialStorage] ${message}`, context })
        });
    } catch (err) {
        // Silently fail if server logging fails
    }
}

// =============================================================================
// Chunked Storage (iOS Pattern 1: Immediate Segmented Storage)
// =============================================================================

/**
 * Save a chunk immediately during recording (prevents memory crashes)
 * @param {string} videoId - Unique ID for this video
 * @param {number} chunkIndex - Sequential chunk number
 * @param {Blob} chunkBlob - The video chunk data
 */
async function saveChunk(videoId, chunkIndex, chunkBlob) {
    try {
        await db.chunks.add({
            videoId: videoId,
            chunkIndex: chunkIndex,
            blob: chunkBlob,
            size: chunkBlob.size,
            timestamp: Date.now()
        });

        console.log(`💾 Chunk ${chunkIndex} saved: ${(chunkBlob.size / 1024).toFixed(2)} KB`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to save chunk ${chunkIndex}:`, err);
        return false;
    }
}

/**
 * Reassemble all chunks into final video blob
 * @param {string} videoId - Video ID to reassemble
 * @returns {Blob|null} - Reassembled video blob or null if failed
 */
async function reassembleVideo(videoId) {
    try {
        console.log(`🔍 Reassembling video: ${videoId}`); // #claude - debug logging

        // #claude - Add timeout to detect hanging query
        const QUERY_TIMEOUT = 10000; // 10 seconds
        console.log(`🔍 Starting chunks query with ${QUERY_TIMEOUT}ms timeout...`);

        // #claude - Use toArray() instead of sortBy() - sortBy() seems to hang for video 3
        // Get all chunks for this video
        const chunksPromise = db.chunks
            .where('videoId')
            .equals(videoId)
            .toArray();  // #claude - Changed from sortBy to toArray

        // #claude - Race between query and timeout
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('IndexedDB query timeout after 10s')), QUERY_TIMEOUT)
        );

        let chunks = await Promise.race([chunksPromise, timeoutPromise]);
        console.log(`🔍 Found ${chunks.length} chunks for video ${videoId}`); // #claude - debug logging

        // #claude - Manually sort chunks by index (instead of using sortBy which hangs)
        chunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
        console.log(`🔍 Sorted ${chunks.length} chunks for video ${videoId}`); // #claude - debug logging

        if (chunks.length === 0) {
            console.warn(`⚠️ No chunks found for video ${videoId}`);
            // #claude - Log to server for mobile debugging
            if (typeof logToServer !== 'undefined') {
                await logToServer('warn', `No chunks found for video ${videoId}`, { videoId });
            }
            return null;
        }

        // #claude - Check if chunks have blob property
        const chunkInfo = chunks.map((c, i) => ({ // #claude
            index: c.chunkIndex, // #claude
            hasBlob: !!c.blob, // #claude
            hasData: !!c.data, // #claude
            size: c.size // #claude
        })); // #claude
        console.log(`🔍 Chunk properties:`, chunkInfo); // #claude - debug logging

        // Extract blobs and concatenate
        const blobs = chunks.map(chunk => chunk.blob);

        // #claude - Check if any blobs are undefined
        const invalidBlobs = blobs.filter(b => !b).length; // #claude
        if (invalidBlobs > 0) { // #claude
            console.error(`❌ ${invalidBlobs} chunks have undefined blob property`); // #claude
            if (typeof logToServer !== 'undefined') { // #claude
                await logToServer('error', `${invalidBlobs} chunks have undefined blob property`, { videoId, chunkInfo }); // #claude
            } // #claude
            return null; // #claude
        } // #claude

        const videoBlob = new Blob(blobs, { type: blobs[0].type });

        console.log(`✅ Video reassembled: ${chunks.length} chunks, ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
        return videoBlob;
    } catch (err) {
        console.error(`❌ Failed to reassemble video ${videoId}:`, err);
        // #claude - Log to server for mobile debugging
        if (typeof logToServer !== 'undefined') {
            await logToServer('error', `Failed to reassemble video ${videoId}`, { videoId, error: err.message, stack: err.stack });
        }
        return null;
    }
}

/**
 * Delete all chunks for a video (cleanup after upload or retake)
 * @param {string} videoId - Video ID to delete chunks for
 */
async function deleteChunks(videoId) {
    try {
        const deletedCount = await db.chunks
            .where('videoId')
            .equals(videoId)
            .delete();

        console.log(`🗑️ Deleted ${deletedCount} chunks for video ${videoId}`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to delete chunks for ${videoId}:`, err);
        return false;
    }
}

// =============================================================================
// Video Metadata Management
// =============================================================================

/**
 * Save video metadata after recording complete
 * @param {object} metadata - Video metadata
 */
async function saveVideoMetadata(metadata) {
    try {
        const currentVideos = await getAllVideos();
        const expectedMaxVideos = window.sessionExpectedVideoCount || 3;

        if (currentVideos.length >= expectedMaxVideos) {
            const errorMsg = `CORRUPTION PREVENTION: Cannot save video. Already have ${currentVideos.length} videos (expected max: ${expectedMaxVideos})`;
            console.error(`❌ ${errorMsg}`);
            // #claude v51: Log to backend
            if (window.clientLogger) {
                window.clientLogger.error('metadata_save_blocked_max_videos', {
                    currentCount: currentVideos.length,
                    expectedMax: expectedMaxVideos,
                    attemptedVideoId: metadata.videoId,
                    attemptedPromptId: metadata.promptId
                });
            }
            return false;
        }

        const duplicateCheck = currentVideos.find(v => v.promptId === metadata.promptId);
        if (duplicateCheck) {
            const errorMsg = `CORRUPTION PREVENTION: Duplicate promptId detected: ${metadata.promptId}`;
            console.error(`❌ ${errorMsg}`);
            // #claude v51: Log to backend
            if (window.clientLogger) {
                window.clientLogger.error('metadata_save_blocked_duplicate', {
                    promptId: metadata.promptId,
                    existingVideoId: duplicateCheck.videoId,
                    attemptedVideoId: metadata.videoId
                });
            }
            return false;
        }

        await db.videos.put({
            videoId: metadata.videoId,
            promptId: metadata.promptId,
            status: 'recorded',
            recordedAt: Date.now(),
            fileSize: metadata.fileSize,
            duration: metadata.duration,
            codec: metadata.codec,
            chunkCount: metadata.chunkCount
        });

        console.log(`✅ Video metadata saved: ${metadata.videoId} (${currentVideos.length + 1}/${expectedMaxVideos})`);
        return true;
    } catch (err) {
        console.error('❌ Failed to save video metadata:', err);
        return false;
    }
}

/**
 * Get metadata for a specific video
 * @param {string} videoId - Video ID to retrieve
 */
async function getVideoMetadata(videoId) {
    try {
        return await db.videos.get(videoId);
    } catch (err) {
        console.error(`❌ Failed to get video metadata for ${videoId}:`, err);
        return null;
    }
}

/**
 * Get all recorded videos
 */
async function getAllVideos() {
    try {
        return await db.videos.toArray();
    } catch (err) {
        console.error('❌ Failed to get all videos:', err);
        return [];
    }
}

/**
 * Delete video and all its chunks
 * @param {string} videoId - Video ID to delete
 */
async function deleteVideo(videoId) {
    try {
        await deleteChunks(videoId);
        await db.videos.delete(videoId);
        console.log(`✅ Video deleted: ${videoId}`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to delete video ${videoId}:`, err);
        return false;
    }
}

// =============================================================================
// Resume Logic
// =============================================================================

/**
 * Get session progress (which prompts have been completed)
 * @returns {object} - { completedPrompts: [], totalRecorded: number }
 */
async function getSessionProgress() {
    try {
        const videos = await getAllVideos();
        const completedPrompts = videos.map(v => v.promptId);

        return {
            completedPrompts: completedPrompts,
            totalRecorded: videos.length,
            videos: videos
        };
    } catch (err) {
        console.error('❌ Failed to get session progress:', err);
        return { completedPrompts: [], totalRecorded: 0, videos: [] };
    }
}

/**
 * Check if storage quota is sufficient
 * @param {number} requiredMB - Required storage in MB
 * @returns {boolean} - True if sufficient storage available
 */
async function checkStorageQuota(requiredMB = 250) {
    if (!navigator.storage || !navigator.storage.estimate) {
        console.warn('⚠️ Storage quota check not supported');
        return true; // Assume OK if can't check
    }

    try {
        const { quota, usage } = await navigator.storage.estimate();
        const availableMB = (quota - usage) / (1024 * 1024);

        console.log(`💾 Storage: ${availableMB.toFixed(0)} MB available, ${requiredMB} MB required`);

        if (availableMB < requiredMB) {
            console.warn(`⚠️ Insufficient storage: ${availableMB.toFixed(0)} MB available, need ${requiredMB} MB`);
            return false;
        }

        return true;
    } catch (err) {
        console.error('❌ Storage quota check failed:', err);
        return true; // Assume OK if check fails
    }
}

async function clearAllVideos() {
    try {
        console.log('🗑️ Clearing all videos from IndexedDB...');

        await db.chunks.clear();
        await db.videos.clear();

        console.log('✅ All videos cleared from storage');
        return true;
    } catch (err) {
        console.error('❌ Failed to clear videos:', err);
        return false;
    }
}

async function getVideoBlob(videoId) {
    try {
        console.log(`📦 Retrieving video blob for: ${videoId}`);
        const blob = await reassembleVideo(videoId);

        if (!blob) {
            console.error(`❌ No blob found for video: ${videoId}`);
            return null;
        }

        console.log(`✅ Video blob retrieved: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        return blob;
    } catch (err) {
        console.error(`❌ Failed to get video blob for ${videoId}:`, err);
        return null;
    }
}

/**
 * Save inflated blob (for TEST MODE stress testing) // #claude
 * Replaces existing chunks with single inflated blob // #claude
 */
async function saveInflatedBlob(videoId, inflatedBlob) { // #claude
    try { // #claude
        console.log(`🧪 Saving inflated blob for: ${videoId}`); // #claude

        // Delete existing chunks // #claude
        await db.chunks // #claude - FIXED: Use correct table name
            .where('videoId') // #claude
            .equals(videoId) // #claude
            .delete(); // #claude

        // Save as single chunk // #claude
        await db.chunks.add({ // #claude - FIXED: Use correct table name
            videoId: videoId, // #claude
            chunkIndex: 0, // #claude
            blob: inflatedBlob, // #claude - FIXED: Use 'blob' property name (matches reassembleVideo)
            size: inflatedBlob.size, // #claude
            timestamp: Date.now() // #claude
        }); // #claude

        // Update metadata // #claude
        await db.videos // #claude
            .where('videoId') // #claude
            .equals(videoId) // #claude
            .modify({ // #claude
                fileSize: inflatedBlob.size, // #claude
                chunkCount: 1 // #claude
            }); // #claude

        console.log(`✅ Inflated blob saved: ${(inflatedBlob.size / 1024 / 1024).toFixed(2)} MB`); // #claude
        return true; // #claude
    } catch (err) { // #claude
        console.error(`❌ Failed to save inflated blob for ${videoId}:`, err); // #claude
        return false; // #claude
    } // #claude
} // #claude

async function validateSessionHealth() {
    try {
        const videos = await getAllVideos();
        const expectedMaxVideos = window.sessionExpectedVideoCount || 3;
        const videoCount = videos.length;

        const health = {
            isHealthy: true,
            videoCount: videoCount,
            expectedMaxVideos: expectedMaxVideos,
            issues: []
        };

        if (videoCount > expectedMaxVideos) {
            health.isHealthy = false;
            health.issues.push(`Corruption: ${videoCount} videos found, expected max ${expectedMaxVideos}`);
        }

        const promptIds = videos.map(v => v.promptId);
        const uniquePrompts = new Set(promptIds);
        if (promptIds.length !== uniquePrompts.size) {
            health.isHealthy = false;
            health.issues.push('Corruption: Duplicate video IDs detected');
        }

        if (!health.isHealthy) {
            console.error('🚨 Session corruption detected:', health.issues);
        }

        return health;
    } catch (err) {
        console.error('❌ Failed to validate session health:', err);
        return {
            isHealthy: false,
            videoCount: 0,
            expectedMaxVideos: 0,
            issues: ['Failed to validate session']
        };
    }
}

// =============================================================================
// Export API
// =============================================================================

window.FacialStorage = {
    saveChunk,
    reassembleVideo,
    deleteChunks,
    saveVideoMetadata,
    getVideoMetadata,
    getAllVideos,
    deleteVideo,
    getVideoBlob,
    saveInflatedBlob, // #claude - TEST MODE: Save artificially inflated blob
    clearAllVideos,
    getSessionProgress,
    checkStorageQuota,
    validateSessionHealth,
    db
};

console.log('💾 Storage module loaded');
