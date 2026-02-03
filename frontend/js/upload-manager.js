/**
 * Background Upload Manager
 * Handles reliable background video uploads with retry logic and crash recovery
 */

// Client-side logger - sends logs to server for mobile debugging  // #claude
async function logToServer(level, message, context = {}) {  // #claude
    try {  // #claude
        await fetch('/api/log/client', {  // #claude
            method: 'POST',  // #claude
            headers: { 'Content-Type': 'application/json' },  // #claude
            body: JSON.stringify({ level, message, context })  // #claude
        });  // #claude
    } catch (err) {  // #claude
        // Silently fail if server logging fails  // #claude
    }  // #claude
}  // #claude

class UploadManager { // #claude
    constructor() { // #claude
        this.isProcessing = false; // #claude
        this.currentUpload = null; // #claude
        this.queue = this.loadQueue(); // #claude
        this.blobStore = new Map(); // #claude v15: In-memory blob storage (videoId -> Blob)
        console.log('📤 UploadManager initialized'); // #claude
        console.log('ℹ️  V15: Using in-memory blob store (no IndexedDB retrieval)'); // #claude
    } // #claude

    /**
     * Add video to upload queue (called after recording)
     * @param {Blob} blob - V15: The video blob from memory (no IndexedDB retrieval)
     */
    async enqueueVideo(videoId, promptId, metadata, blob = null) { // #claude v15: Added blob parameter
        // #claude v40: Check if this promptId already exists in queue (prevent duplicates)
        const existing = this.queue.find(item => item.promptId === promptId);
        if (existing) {
            // If already completed successfully, skip
            if (existing.status === 'completed') {
                console.warn(`⚠️ Video already uploaded: ${promptId} - skipping duplicate`);
                return;
            }

            // If pending/uploading BUT blob exists in memory, skip (legitimate duplicate)
            const existingBlob = this.blobStore.get(existing.videoId);
            if ((existing.status === 'pending' || existing.status === 'uploading') && existingBlob) {
                console.warn(`⚠️ Video already in queue with blob: ${promptId} (status: ${existing.status}) - skipping duplicate`);
                return;
            }

            // If pending/uploading but NO blob (e.g., after page refresh), allow re-enqueue with new blob
            if ((existing.status === 'pending' || existing.status === 'uploading') && !existingBlob && blob) {
                console.log(`🔄 Re-enqueuing ${promptId} with fresh blob (previous blob lost)`);
                this.blobStore.set(videoId, blob);
                // Update existing queue item with new videoId and metadata
                existing.videoId = videoId;
                existing.metadata = metadata;
                existing.attempts = 0; // Reset attempts
                existing.error = null;
                this.saveQueue();

                // Restart processing if needed
                if (!this.isProcessing) {
                    this.processQueue();
                }
                return;
            }
        }

        const queueItem = { // #claude
            videoId, // #claude
            promptId, // #claude
            status: 'pending', // #claude
            attempts: 0, // #claude
            lastAttempt: null, // #claude
            error: null, // #claude
            chunkProgress: 0, // #claude
            metadata, // #claude
            enqueuedAt: Date.now() // #claude
        }; // #claude

        this.queue.push(queueItem); // #claude
        this.saveQueue(); // #claude

        // #claude v15: Store blob in memory (not in localStorage - can't serialize Blobs)
        if (blob) {
            this.blobStore.set(videoId, blob);
            console.log(`✅ Video enqueued: ${promptId} (Queue size: ${this.queue.length}) - Blob in memory: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
            console.log(`✅ Video enqueued: ${promptId} (Queue size: ${this.queue.length}) - Will retrieve from IndexedDB`);
        }

        // Start processing if not already running // #claude
        if (!this.isProcessing) { // #claude
            this.processQueue(); // #claude
        } // #claude
    } // #claude

    /**
     * Process queue - upload one video at a time
     */
    async processQueue() { // #claude
        if (this.isProcessing) { // #claude
            console.log('⏸️ Queue already processing'); // #claude
            return; // #claude
        } // #claude

        this.isProcessing = true; // #claude
        console.log('▶️ Starting queue processing...'); // #claude

        while (true) { // #claude
            // Find next pending or failed video (with retry attempts left) // #claude
            const next = this.queue.find(item => // #claude
                item.status === 'pending' || // #claude
                (item.status === 'failed' && item.attempts < 5) // #claude
            ); // #claude

            if (!next) { // #claude
                // No more videos to upload // #claude
                this.isProcessing = false; // #claude
                this.updateUIIndicator('idle'); // #claude
                this.hideUploadStatus(); // #claude v22: Clear status message
                console.log('✅ Queue processing complete'); // #claude
                break; // #claude
            } // #claude

            // Upload this video // #claude
            await this.uploadVideo(next); // #claude

            // Brief pause between uploads (250ms) // #claude
            await new Promise(r => setTimeout(r, 250)); // #claude
        } // #claude
    } // #claude

    /**
     * Upload single video with retry logic
     */
    async uploadVideo(queueItem) { // #claude
        const MAX_ATTEMPTS = 5; // #claude

        queueItem.status = 'uploading'; // #claude
        queueItem.attempts++; // #claude
        queueItem.lastAttempt = Date.now(); // #claude
        this.saveQueue(); // #claude
        this.updateUIIndicator('uploading', queueItem); // #claude

        // #claude v38: Calculate video number using only unique promptIds (not total queue length which includes duplicates)
        const uniquePromptIds = [...new Set(this.queue.map(item => item.promptId))];
        const videoNumber = uniquePromptIds.indexOf(queueItem.promptId) + 1;
        const totalVideos = uniquePromptIds.length;
        this.showUploadStatus(`📤 Uploading video ${videoNumber} of ${totalVideos}...`);

        console.log(`📤 Uploading ${queueItem.promptId} (attempt ${queueItem.attempts}/${MAX_ATTEMPTS})...`); // #claude

        try { // #claude
            // Check if backend session exists // #claude
            if (!window.backendSessionId) { // #claude
                const error = 'Backend session not available';  // #claude
                await logToServer('error', error, { videoId: queueItem.videoId, promptId: queueItem.promptId });  // #claude
                throw new Error(error); // #claude
            } // #claude

            // #claude v15: Try memory first, fallback to IndexedDB
            let blob;

            // Check memory store first (v15 fast path)
            if (this.blobStore.has(queueItem.videoId)) {
                console.log(`  ⚡ V15: Using blob from MEMORY (instant)`);
                await logToServer('info', 'Using blob from memory store (v15)', { videoId: queueItem.videoId, promptId: queueItem.promptId });
                blob = this.blobStore.get(queueItem.videoId);
                console.log(`  ✅ Blob from memory: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            } else {
                // Fallback to IndexedDB (slow, for backwards compatibility)
                console.log(`  📦 V15: Blob not in memory, retrieving from IndexedDB (slow fallback)...`);
                await logToServer('info', 'Retrieving blob from IndexedDB (v15 fallback)', { videoId: queueItem.videoId, promptId: queueItem.promptId });

                try {
                    console.log(`  🔍 Calling FacialStorage.getVideoBlob...`);
                    await logToServer('info', 'Calling FacialStorage.getVideoBlob', { videoId: queueItem.videoId, promptId: queueItem.promptId }).catch(() => {});
                    blob = await FacialStorage.getVideoBlob(queueItem.videoId);
                    console.log(`  ✅ FacialStorage.getVideoBlob returned:`, blob ? `blob of size ${blob.size}` : 'null/undefined');
                    await logToServer('info', 'FacialStorage.getVideoBlob returned', { videoId: queueItem.videoId, promptId: queueItem.promptId, blobSize: blob ? blob.size : 'null' }).catch(() => {});
                } catch (getBlobError) {
                    console.error(`  ❌ FacialStorage.getVideoBlob threw error:`, getBlobError);
                    await logToServer('error', `FacialStorage.getVideoBlob threw error: ${getBlobError.message}`, { videoId: queueItem.videoId, promptId: queueItem.promptId, stack: getBlobError.stack });
                    throw getBlobError;
                }
            }

            if (!blob) { // #claude
                const error = 'Video blob not found in storage';  // #claude
                await logToServer('error', error, { videoId: queueItem.videoId, promptId: queueItem.promptId });  // #claude
                throw new Error(error); // #claude
            } // #claude

            console.log(`  📦 Blob retrieved: ${(blob.size / 1024 / 1024).toFixed(2)} MB`); // #claude
            await logToServer('info', `Blob retrieved successfully`, { videoId: queueItem.videoId, promptId: queueItem.promptId, sizeMB: (blob.size / 1024 / 1024).toFixed(2) });  // #claude

            // #claude - Check if VideoUploader is defined
            console.log('  🔍 Checking VideoUploader availability...');
            await logToServer('info', `VideoUploader check: ${typeof VideoUploader}`, { videoId: queueItem.videoId, promptId: queueItem.promptId });
            if (typeof VideoUploader === 'undefined') {
                const error = 'VideoUploader module not loaded!';
                await logToServer('error', error, { videoId: queueItem.videoId, promptId: queueItem.promptId });
                throw new Error(error);
            }
            console.log('  ✅ VideoUploader is available');

            // #claude - Defensive: Ensure we proceed even if logging fails
            await logToServer('info', 'About to call VideoUploader.uploadComplete', { videoId: queueItem.videoId, promptId: queueItem.promptId }).catch(e => console.log('Log failed:', e));

            // #claude - Defensive: Check if uploadComplete function exists
            if (!VideoUploader.uploadComplete) {
                const error = 'VideoUploader.uploadComplete function not found!';
                await logToServer('error', error, { videoId: queueItem.videoId, promptId: queueItem.promptId }).catch(() => {});
                throw new Error(error);
            }
            await logToServer('info', 'VideoUploader.uploadComplete function exists', { videoId: queueItem.videoId, promptId: queueItem.promptId }).catch(() => {});

            // Upload with progress tracking // #claude
            const result = await VideoUploader.uploadComplete( // #claude
                window.backendSessionId, // #claude
                blob, // #claude
                queueItem.metadata, // #claude
                (progress) => { // #claude
                    // Update chunk progress for resume capability // #claude
                    const chunkIndex = Math.floor(progress / 4); // Rough chunk estimate // #claude
                    queueItem.chunkProgress = chunkIndex; // #claude
                    this.saveQueue(); // #claude
                } // #claude
            ); // #claude

            // #claude - Log result
            console.log('  ✅ VideoUploader.uploadComplete returned:', result);
            await logToServer('info', 'VideoUploader.uploadComplete completed', { videoId: queueItem.videoId, promptId: queueItem.promptId, result: JSON.stringify(result) });

            if (result.success) { // #claude
                queueItem.status = 'completed'; // #claude
                queueItem.error = null; // #claude
                queueItem.completedAt = Date.now(); // #claude
                console.log(`✅ Upload complete: ${queueItem.promptId}`); // #claude

                // #claude v38: Show success message using unique promptIds (not total queue length)
                const uniquePromptIds = [...new Set(this.queue.map(item => item.promptId))];
                const videoNumber = uniquePromptIds.indexOf(queueItem.promptId) + 1;
                const totalVideos = uniquePromptIds.length;
                this.showUploadStatus(`✅ Video ${videoNumber} of ${totalVideos} uploaded!`);
                await new Promise(r => setTimeout(r, 1000)); // Show for 1 second
                this.hideUploadStatus();

                // #claude v15: Delete blob from memory store
                if (this.blobStore.has(queueItem.videoId)) {
                    this.blobStore.delete(queueItem.videoId);
                    console.log(`🗑️ V15: Deleted ${queueItem.videoId} blob from memory`);
                    await logToServer('info', 'Deleted video blob from memory after upload', { videoId: queueItem.videoId, promptId: queueItem.promptId });
                }

                // #claude - Also delete from IndexedDB if it exists there (backwards compat)
                try {
                    await FacialStorage.deleteVideo(queueItem.videoId);
                    console.log(`🗑️ Deleted ${queueItem.videoId} chunks from IndexedDB (if any)`);
                    await logToServer('info', 'Deleted video chunks from IndexedDB after upload', { videoId: queueItem.videoId, promptId: queueItem.promptId });
                } catch (deleteErr) {
                    console.warn(`⚠️ Failed to delete chunks from IndexedDB for ${queueItem.videoId}:`, deleteErr);
                    // Don't fail the upload if cleanup fails
                }
            } else { // #claude
                throw new Error(result.error || 'Upload failed'); // #claude
            } // #claude

        } catch (err) { // #claude
            console.error(`❌ Upload failed (attempt ${queueItem.attempts}/${MAX_ATTEMPTS}):`, err.message); // #claude
            await logToServer('error', `Upload failed (attempt ${queueItem.attempts}/${MAX_ATTEMPTS})`, {  // #claude
                videoId: queueItem.videoId,  // #claude
                promptId: queueItem.promptId,  // #claude
                error: err.message,  // #claude
                stack: err.stack,  // #claude
                attempts: queueItem.attempts  // #claude
            });  // #claude

            if (queueItem.attempts >= MAX_ATTEMPTS) { // #claude
                queueItem.status = 'failed'; // #claude
                queueItem.error = err.message; // #claude
                console.error(`🚨 Video upload permanently failed: ${queueItem.promptId}`); // #claude
                await logToServer('error', `Video upload PERMANENTLY FAILED after ${MAX_ATTEMPTS} attempts`, {  // #claude
                    videoId: queueItem.videoId,  // #claude
                    promptId: queueItem.promptId,  // #claude
                    error: err.message  // #claude
                });  // #claude
            } else { // #claude
                queueItem.status = 'pending'; // Will retry // #claude
                queueItem.error = err.message; // #claude

                // Exponential backoff: 2^attempts seconds // #claude
                const delayMs = Math.pow(2, queueItem.attempts) * 1000; // #claude
                console.log(`⏳ Retrying in ${delayMs/1000}s...`); // #claude
                await new Promise(r => setTimeout(r, delayMs)); // #claude
            } // #claude
        } // #claude

        this.saveQueue(); // #claude
    } // #claude

    /**
     * Load queue from localStorage
     */
    loadQueue() { // #claude
        const stored = localStorage.getItem('uploadQueue'); // #claude
        if (!stored) return []; // #claude

        try { // #claude
            const data = JSON.parse(stored); // #claude
            return data.queue || []; // #claude
        } catch (err) { // #claude
            console.error('❌ Failed to load upload queue:', err); // #claude
            return []; // #claude
        } // #claude
    } // #claude

    /**
     * Save queue to localStorage
     */
    saveQueue() { // #claude
        const data = { // #claude
            queue: this.queue, // #claude
            sessionId: window.backendSessionId, // #claude
            lastUpdated: Date.now() // #claude
        }; // #claude
        localStorage.setItem('uploadQueue', JSON.stringify(data)); // #claude
    } // #claude

    /**
     * Update UI indicator (subtle background activity)
     */
    updateUIIndicator(state, item = null) { // #claude
        const indicator = document.getElementById('uploadIndicator'); // #claude
        if (!indicator) return; // #claude

        const pending = this.queue.filter(i => i.status === 'pending').length; // #claude
        const uploading = this.queue.filter(i => i.status === 'uploading').length; // #claude
        const completed = this.queue.filter(i => i.status === 'completed').length; // #claude
        const failed = this.queue.filter(i => i.status === 'failed').length; // #claude

        switch (state) { // #claude
            case 'uploading': // #claude
                indicator.textContent = `📤 Uploading... (${pending} pending)`; // #claude
                indicator.className = 'upload-indicator active'; // #claude
                break; // #claude

            case 'idle': // #claude
                if (completed > 0) { // #claude
                    indicator.textContent = `✅ ${completed} uploaded`; // #claude
                    indicator.className = 'upload-indicator idle'; // #claude
                } else { // #claude
                    indicator.textContent = ''; // #claude
                    indicator.className = 'upload-indicator hidden'; // #claude
                } // #claude
                break; // #claude

            case 'error': // #claude
                indicator.textContent = `⚠️ ${failed} failed`; // #claude
                indicator.className = 'upload-indicator error'; // #claude
                break; // #claude
        } // #claude

        // Show error state if any failed // #claude
        if (failed > 0) { // #claude
            this.updateUIIndicator('error'); // #claude
        } // #claude
    } // #claude

    /**
     * Show upload status message to user (prominent, not subtle indicator)
     */
    showUploadStatus(message) { // #claude v22
        // Use uploadIndicator which is always visible (outside screen divs)
        const indicator = document.getElementById('uploadIndicator');
        if (indicator) {
            indicator.textContent = message;
            indicator.className = 'upload-indicator active';
            indicator.classList.remove('hidden');
        }
        console.log(message); // Always log to console
    } // #claude v22

    /**
     * Hide upload status message
     */
    hideUploadStatus() { // #claude v22
        const indicator = document.getElementById('uploadIndicator');
        if (indicator) {
            indicator.className = 'upload-indicator hidden';
        }
    } // #claude v22

    /**
     * Get summary for debugging
     */
    getSummary() { // #claude
        return { // #claude
            total: this.queue.length, // #claude
            pending: this.queue.filter(i => i.status === 'pending').length, // #claude
            uploading: this.queue.filter(i => i.status === 'uploading').length, // #claude
            completed: this.queue.filter(i => i.status === 'completed').length, // #claude
            failed: this.queue.filter(i => i.status === 'failed').length, // #claude
            isProcessing: this.isProcessing // #claude
        }; // #claude
    } // #claude

    /**
     * Wait for all uploads to complete (used in completion screen)
     */
    async waitForCompletion(timeoutMs = 300000) { // 5 minutes timeout // #claude
        const startTime = Date.now(); // #claude

        while (true) { // #claude
            const summary = this.getSummary(); // #claude

            // Check if done // #claude
            if (summary.pending === 0 && summary.uploading === 0) { // #claude
                console.log('✅ All uploads complete'); // #claude
                return { // #claude
                    success: true, // #claude
                    completed: summary.completed, // #claude
                    failed: summary.failed // #claude
                }; // #claude
            } // #claude

            // Check timeout // #claude
            if (Date.now() - startTime > timeoutMs) { // #claude
                console.error('⏰ Upload timeout'); // #claude
                return { // #claude
                    success: false, // #claude
                    completed: summary.completed, // #claude
                    failed: summary.failed, // #claude
                    pending: summary.pending + summary.uploading, // #claude
                    error: 'Timeout waiting for uploads' // #claude
                }; // #claude
            } // #claude

            // Wait 1 second before checking again // #claude
            await new Promise(r => setTimeout(r, 1000)); // #claude
        } // #claude
    } // #claude

    /**
     * Resume on page load - static factory method
     */
    static resumeUploads() { // #claude
        const manager = new UploadManager(); // #claude

        // #claude v38: Clean up completed uploads from previous sessions
        const stored = localStorage.getItem('uploadQueue');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                const storedSessionId = data.sessionId;
                const currentSessionId = window.backendSessionId;

                if (storedSessionId && currentSessionId && storedSessionId !== currentSessionId) {
                    // Different session - remove all completed uploads from old session
                    const beforeCount = manager.queue.length;
                    manager.queue = manager.queue.filter(item => item.status !== 'completed');
                    const removedCount = beforeCount - manager.queue.length;
                    if (removedCount > 0) {
                        console.log(`🗑️ Cleaned up ${removedCount} completed uploads from previous session`);
                        manager.saveQueue();
                    }
                }
            } catch (err) {
                console.error('Failed to clean up old uploads:', err);
            }
        }

        const summary = manager.getSummary(); // #claude
        console.log('📤 Upload queue summary:', summary); // #claude

        // Reset any 'uploading' status to 'pending' (interrupted by page reload) // #claude
        manager.queue.forEach(item => { // #claude
            if (item.status === 'uploading') { // #claude
                item.status = 'pending'; // #claude
                console.log(`  🔄 Reset ${item.promptId} from 'uploading' to 'pending'`); // #claude
            } // #claude
        }); // #claude
        manager.saveQueue(); // #claude

        // Start processing if there are pending/failed uploads // #claude
        if (summary.pending > 0 || summary.failed > 0) { // #claude
            console.log(`▶️ Resuming uploads: ${summary.pending} pending, ${summary.failed} failed`); // #claude
            manager.processQueue(); // #claude
        } else if (summary.completed > 0) { // #claude
            console.log(`✅ All uploads already complete (${summary.completed} videos)`); // #claude
        } // #claude

        return manager; // #claude
    } // #claude

    /**
     * Clear queue (for testing or reset)
     */
    clearQueue() { // #claude
        this.queue = []; // #claude
        this.saveQueue(); // #claude
        console.log('🗑️ Upload queue cleared'); // #claude
    } // #claude

    // #claude v50: Cancel/remove a pending upload for a specific promptId (used during retakes)
    cancelUpload(promptId) {
        const index = this.queue.findIndex(item => item.promptId === promptId);
        if (index === -1) {
            console.log(`ℹ️ No queue item found for ${promptId}`);
            return false;
        }

        const item = this.queue[index];

        // Can only cancel pending items (not currently uploading)
        if (item.status === 'uploading') {
            console.warn(`⚠️ Cannot cancel ${promptId} - already uploading (status: ${item.status})`);
            return false;
        }

        // Remove from queue
        this.queue.splice(index, 1);
        this.saveQueue();

        // Remove blob from memory if exists
        if (this.blobStore.has(item.videoId)) {
            this.blobStore.delete(item.videoId);
            console.log(`🗑️ Deleted blob from memory: ${item.videoId}`);
        }

        console.log(`✅ Cancelled upload for ${promptId} (was ${item.status})`);
        return true;
    }
} // #claude

// Export // #claude
window.UploadManager = UploadManager; // #claude
console.log('📤 Upload Manager module loaded'); // #claude
