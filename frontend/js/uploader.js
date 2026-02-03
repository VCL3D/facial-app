/**
 * Video Upload Module
 * Handles chunked uploads with retry logic and progress tracking
 */

const VideoUploader = (function() {
    // Use nginx reverse proxy for all API calls #claude
    const BACKEND_URL = ''; // Relative URLs -> nginx proxies to backend #claude
    console.log(`📡 Backend URL: ${BACKEND_URL || 'relative (nginx proxy)'}`); // #claude
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const MAX_RETRIES = 3;
    const RETRY_DELAY_BASE = 2000; // 2 seconds base delay
    const DEBUG = true; // Enable verbose logging //#claude

    // #claude - Server logger for mobile debugging
    async function logToServer(level, message, context = {}) {
        try {
            await fetch('/api/log/client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message: `[VideoUploader] ${message}`, context })
            });
        } catch (err) {
            // Silently fail if server logging fails
        }
    }

    // Debug logger //#claude
    function log(level, ...args) { //#claude
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); //#claude
        const prefix = { //#claude
            info: `ℹ️ [${timestamp}]`, //#claude
            success: `✅ [${timestamp}]`, //#claude
            warn: `⚠️ [${timestamp}]`, //#claude
            error: `❌ [${timestamp}]`, //#claude
            debug: `🔍 [${timestamp}]` //#claude
        }[level] || `[${timestamp}]`; //#claude
        console.log(prefix, ...args); //#claude
        // #claude - Also log errors and warnings to server
        if (level === 'error' || level === 'warn') {
            logToServer(level, args.join(' '));
        }
    } //#claude

    /**
     * Create a new session on the backend
     */
    async function createSession(participantId = null) {
        try {
            // #claude v48: Get participant name from localStorage
            const participantName = localStorage.getItem('participantName') || 'Anonymous';
            log('info', 'Creating new session...', `participant: ${participantName}`); //#claude v48
            //#claude
            const response = await fetch(`${BACKEND_URL}/api/session/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participant_id: participantId,
                    participant_name: participantName  // #claude v48
                })
            });

            log('debug', 'Session creation response status:', response.status); //#claude

            if (!response.ok) {
                throw new Error(`Session creation failed: ${response.statusText}`);
            }

            const data = await response.json();
            log('success', 'Session created:', data.session_id); //#claude
            log('debug', 'Session data:', data); //#claude
            return data.session_id;
        } catch (error) {
            log('error', 'Session creation error:', error.message); //#claude
            log('debug', 'Full error:', error); //#claude
            throw error;
        }
    }

    /**
     * Split blob into chunks
     */
    function* chunkBlob(blob, chunkSize) {
        let offset = 0;
        while (offset < blob.size) {
            const chunk = blob.slice(offset, offset + chunkSize);
            yield chunk;
            offset += chunkSize;
        }
    }

    /**
     * Upload a single chunk with retry logic
     */
    async function uploadChunkWithRetry(sessionId, videoId, chunkIndex, totalChunks, chunk, retryCount = 0) {
        try {
            log('debug', `Uploading chunk ${chunkIndex}/${totalChunks - 1}, size: ${(chunk.size / 1024).toFixed(1)}KB`); //#claude
            //#claude
            const formData = new FormData();
            formData.append('session_id', sessionId);
            formData.append('video_id', videoId);
            formData.append('chunk_index', chunkIndex.toString());
            formData.append('total_chunks', totalChunks.toString());
            formData.append('chunk', chunk, `chunk_${chunkIndex}`);

            const startTime = Date.now(); //#claude
            const response = await fetch(`${BACKEND_URL}/api/upload/chunk`, {
                method: 'POST',
                body: formData
            });
            const duration = Date.now() - startTime; //#claude
            log('debug', `Chunk ${chunkIndex} uploaded in ${duration}ms`); //#claude

            if (!response.ok) {
                throw new Error(`Chunk upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            log('debug', `Chunk ${chunkIndex} response:`, data); //#claude
            return data;

        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                // Exponential backoff: 2^retry seconds + random jitter
                const delay = Math.pow(2, retryCount) * RETRY_DELAY_BASE + Math.random() * 1000;
                log('warn', `Chunk ${chunkIndex} failed, retrying (${retryCount + 1}/${MAX_RETRIES}) in ${delay.toFixed(0)}ms...`); //#claude
                log('debug', `Chunk ${chunkIndex} error:`, error.message); //#claude

                await new Promise(resolve => setTimeout(resolve, delay));
                return uploadChunkWithRetry(sessionId, videoId, chunkIndex, totalChunks, chunk, retryCount + 1);
            } else {
                log('error', `Chunk ${chunkIndex} failed after ${MAX_RETRIES} retries`); //#claude
                log('debug', 'Final error:', error); //#claude
                throw error;
            }
        }
    }

    /**
     * Upload video blob in chunks
     */
    async function uploadVideo(sessionId, videoId, blob, onProgress = null) {
        const startTime = Date.now(); //#claude
        try {
            log('info', `📤 Starting chunked upload for video ${videoId}`); //#claude
            log('info', `   Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`); //#claude
            log('debug', `   Session: ${sessionId}`); //#claude
            log('debug', `   Blob type: ${blob.type}`); //#claude

            // Calculate total chunks
            const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
            log('info', `   Total chunks: ${totalChunks}`); //#claude
            log('debug', `   Chunk size: ${(CHUNK_SIZE / 1024).toFixed(0)}KB`); //#claude

            let chunkIndex = 0;
            let totalBytesUploaded = 0; //#claude

            // Upload each chunk sequentially
            for (const chunk of chunkBlob(blob, CHUNK_SIZE)) {
                const chunkStartTime = Date.now(); //#claude
                const result = await uploadChunkWithRetry(sessionId, videoId, chunkIndex, totalChunks, chunk);
                const chunkDuration = Date.now() - chunkStartTime; //#claude
                totalBytesUploaded += chunk.size; //#claude

                // Update progress
                const progress = ((chunkIndex + 1) / totalChunks) * 100;
                const avgSpeed = (totalBytesUploaded / 1024) / ((Date.now() - startTime) / 1000); //#claude
                //#claude
                if (onProgress) {
                    onProgress(progress, chunkIndex + 1, totalChunks);
                }

                log('info', `   Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${progress.toFixed(1)}%) - ${chunkDuration}ms`); //#claude
                log('debug', `   Average speed: ${avgSpeed.toFixed(1)} KB/s`); //#claude

                // Check if video is complete
                if (result.status === 'video_complete') {
                    const totalDuration = Date.now() - startTime; //#claude
                    log('success', `Video upload complete: ${result.file_path}`); //#claude
                    log('info', `   Total time: ${(totalDuration / 1000).toFixed(1)}s`); //#claude
                    log('info', `   Average speed: ${avgSpeed.toFixed(1)} KB/s`); //#claude
                    return result;
                }

                chunkIndex++;
            }

            throw new Error('Upload completed but video not marked as complete');

        } catch (error) {
            const duration = Date.now() - startTime; //#claude
            log('error', `Video upload failed after ${(duration / 1000).toFixed(1)}s:`, error.message); //#claude
            log('debug', 'Full error:', error); //#claude
            throw error;
        }
    }

    /**
     * Upload video metadata
     */
    async function uploadMetadata(sessionId, videoId, metadata) {
        try {
            log('info', `📝 Uploading metadata for video ${videoId}`); //#claude
            log('debug', 'Metadata:', metadata); //#claude
            //#claude
            const response = await fetch(`${BACKEND_URL}/api/upload/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    video_id: videoId,
                    ...metadata
                })
            });

            log('debug', 'Metadata response status:', response.status); //#claude

            if (!response.ok) {
                throw new Error(`Metadata upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            log('success', `Metadata uploaded for video ${videoId}`); //#claude
            log('debug', 'Metadata response:', data); //#claude
            return data;

        } catch (error) {
            log('error', `Metadata upload failed:`, error.message); //#claude
            log('debug', 'Full error:', error); //#claude
            throw error;
        }
    }

    /**
     * Complete video upload: video blob + metadata
     */
    async function uploadComplete(sessionId, videoBlob, metadata, onProgress = null) {
        const startTime = Date.now(); //#claude
        try {
            const videoId = metadata.videoId || `video_${Date.now()}`;
            //#claude
            log('info', '🚀 Starting complete upload (video + metadata)'); //#claude
            log('info', `   Video ID: ${videoId}`); //#claude
            log('info', `   Blob size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`); //#claude
            log('debug', '   Metadata:', metadata); //#claude

            // Upload video chunks
            log('info', 'Step 1/2: Uploading video chunks...'); //#claude
            await uploadVideo(sessionId, videoId, videoBlob, onProgress);

            // Upload metadata
            log('info', 'Step 2/2: Uploading metadata...'); //#claude
            await uploadMetadata(sessionId, videoId, metadata);

            const totalDuration = Date.now() - startTime; //#claude
            log('success', `✅ Complete upload finished in ${(totalDuration / 1000).toFixed(1)}s`); //#claude

            return { success: true, videoId };

        } catch (error) {
            const duration = Date.now() - startTime; //#claude
            log('error', `Complete upload failed after ${(duration / 1000).toFixed(1)}s:`, error.message); //#claude
            log('debug', 'Full error:', error); //#claude
            return { success: false, error: error.message };
        }
    }

    /**
     * Get session info from backend
     */
    async function getSession(sessionId) {
        try {
            log('info', `📊 Fetching session info for: ${sessionId}`); //#claude
            //#claude
            const response = await fetch(`${BACKEND_URL}/api/session/${sessionId}`);

            log('debug', 'Session fetch response status:', response.status); //#claude

            if (!response.ok) {
                throw new Error(`Failed to get session: ${response.statusText}`);
            }

            const data = await response.json(); //#claude
            log('success', 'Session info retrieved'); //#claude
            log('debug', 'Session data:', data); //#claude
            return data; //#claude
        } catch (error) {
            log('error', 'Get session error:', error.message); //#claude
            log('debug', 'Full error:', error); //#claude
            throw error;
        }
    }

    // Public API
    return {
        createSession,
        uploadVideo,
        uploadMetadata,
        uploadComplete,
        getSession,
        BACKEND_URL
    };
})();

// Module initialization log //#claude
console.log('💾 Video Uploader module loaded'); //#claude
console.log(`   Backend URL: ${VideoUploader.BACKEND_URL}`); //#claude
console.log('   Chunk size: 1MB'); //#claude
console.log('   Max retries: 3'); //#claude
console.log('   Debug mode: ENABLED'); //#claude
