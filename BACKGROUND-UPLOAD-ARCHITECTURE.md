# Robust Background Upload Architecture

## Overview
Upload previous video in the background while user records the next video, with 100% reliability and failure recovery.

## Current Status (Blocking Upload)
**Pros:**
- ✅ Simple and reliable
- ✅ User knows upload succeeded before continuing
- ✅ No queue management needed
- ✅ No memory pressure from concurrent operations

**Cons:**
- ❌ Slower UX - user waits 5-15 seconds between videos
- ❌ Session takes longer (extra 30-60s for 3 videos)

## Proposed Architecture (Background Upload)

### Core Principles
1. **Fire and Forget**: Start upload, don't block UI
2. **Persistent Queue**: Track upload state in localStorage
3. **Automatic Retry**: Exponential backoff on failures
4. **Order Preservation**: Videos upload in recording order
5. **Memory Efficient**: Only one upload active at a time
6. **Crash Recovery**: Resume on page reload
7. **User Feedback**: Subtle indicator of background activity

### Components

#### 1. Upload Queue (localStorage)
```javascript
// Structure stored in localStorage
{
  "uploadQueue": [
    {
      "videoId": "uuid-1",
      "promptId": "facial_expressions",
      "status": "pending",          // pending | uploading | completed | failed
      "attempts": 0,
      "lastAttempt": 1738092000000,
      "error": null,
      "chunkProgress": 0,           // Last successful chunk index
      "totalChunks": 25
    },
    {
      "videoId": "uuid-2",
      "promptId": "head_movements",
      "status": "uploading",
      "attempts": 1,
      "chunkProgress": 15,
      "totalChunks": 30
    }
  ],
  "sessionId": "backend-session-id"
}
```

#### 2. Upload State Machine

```
┌─────────────┐
│   PENDING   │ (Video recorded, waiting to upload)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  UPLOADING  │ (Chunks being sent)
└──────┬──────┘
       │
       ├──────► Success ──────► COMPLETED
       │
       └──────► Failure ──────► RETRY (up to 5 attempts)
                                    │
                                    ├──► Success ──► COMPLETED
                                    │
                                    └──► Max Retries ──► FAILED (permanent)
```

#### 3. Upload Manager Module

**File:** `frontend/js/upload-manager.js`

**Responsibilities:**
- Manage upload queue
- Process uploads one at a time (avoid network contention)
- Handle retries with exponential backoff
- Persist state to localStorage
- Resume on page reload
- Update UI indicators

**Key Functions:**

```javascript
class UploadManager {
  constructor() {
    this.isProcessing = false;
    this.currentUpload = null;
    this.queue = this.loadQueue();
  }

  /**
   * Add video to upload queue (called after recording)
   */
  async enqueueVideo(videoId, promptId, metadata) {
    const queueItem = {
      videoId,
      promptId,
      status: 'pending',
      attempts: 0,
      lastAttempt: null,
      error: null,
      chunkProgress: 0,
      metadata
    };

    this.queue.push(queueItem);
    this.saveQueue();

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process queue - upload one video at a time
   */
  async processQueue() {
    if (this.isProcessing) return; // Already processing
    this.isProcessing = true;

    while (true) {
      // Find next pending or failed video
      const next = this.queue.find(item =>
        item.status === 'pending' ||
        (item.status === 'failed' && item.attempts < 5)
      );

      if (!next) {
        // No more videos to upload
        this.isProcessing = false;
        this.updateUIIndicator('idle');
        break;
      }

      // Upload this video
      await this.uploadVideo(next);

      // Brief pause between uploads (250ms)
      await new Promise(r => setTimeout(r, 250));
    }
  }

  /**
   * Upload single video with retry logic
   */
  async uploadVideo(queueItem) {
    const MAX_ATTEMPTS = 5;

    queueItem.status = 'uploading';
    queueItem.attempts++;
    queueItem.lastAttempt = Date.now();
    this.saveQueue();
    this.updateUIIndicator('uploading', queueItem);

    try {
      // Get video blob from IndexedDB
      const blob = await FacialStorage.getVideoBlob(queueItem.videoId);
      if (!blob) {
        throw new Error('Video blob not found in storage');
      }

      // Upload with progress tracking
      const result = await VideoUploader.uploadComplete(
        window.backendSessionId,
        blob,
        queueItem.metadata,
        (progress) => {
          // Update chunk progress for resume capability
          const chunkIndex = Math.floor(progress / 4); // Rough chunk estimate
          queueItem.chunkProgress = chunkIndex;
          this.saveQueue();
        }
      );

      if (result.success) {
        queueItem.status = 'completed';
        queueItem.error = null;
        console.log(`✅ Background upload complete: ${queueItem.promptId}`);

        // Optional: Delete from IndexedDB to free space
        // await FacialStorage.deleteVideo(queueItem.videoId);
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (err) {
      console.error(`❌ Upload failed (attempt ${queueItem.attempts}/${MAX_ATTEMPTS}):`, err);

      if (queueItem.attempts >= MAX_ATTEMPTS) {
        queueItem.status = 'failed';
        queueItem.error = err.message;
        console.error(`🚨 Video upload permanently failed: ${queueItem.promptId}`);
        // TODO: Alert user or add to failure list
      } else {
        queueItem.status = 'pending'; // Will retry
        queueItem.error = err.message;

        // Exponential backoff: 2^attempts seconds
        const delayMs = Math.pow(2, queueItem.attempts) * 1000;
        console.log(`⏳ Retrying in ${delayMs/1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    this.saveQueue();
  }

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    const stored = localStorage.getItem('uploadQueue');
    if (!stored) return [];

    try {
      const data = JSON.parse(stored);
      return data.queue || [];
    } catch {
      return [];
    }
  }

  /**
   * Save queue to localStorage
   */
  saveQueue() {
    const data = {
      queue: this.queue,
      sessionId: window.backendSessionId,
      lastUpdated: Date.now()
    };
    localStorage.setItem('uploadQueue', JSON.stringify(data));
  }

  /**
   * Update UI indicator (subtle background activity)
   */
  updateUIIndicator(state, item = null) {
    const indicator = document.getElementById('uploadIndicator');
    if (!indicator) return;

    switch (state) {
      case 'uploading':
        const pending = this.queue.filter(i => i.status === 'pending').length;
        indicator.textContent = `📤 Uploading... (${pending} pending)`;
        indicator.className = 'upload-indicator active';
        break;

      case 'idle':
        const completed = this.queue.filter(i => i.status === 'completed').length;
        indicator.textContent = `✅ ${completed} uploaded`;
        indicator.className = 'upload-indicator idle';
        break;

      case 'error':
        const failed = this.queue.filter(i => i.status === 'failed').length;
        indicator.textContent = `⚠️ ${failed} failed`;
        indicator.className = 'upload-indicator error';
        break;
    }
  }

  /**
   * Get summary for debugging
   */
  getSummary() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(i => i.status === 'pending').length,
      uploading: this.queue.filter(i => i.status === 'uploading').length,
      completed: this.queue.filter(i => i.status === 'completed').length,
      failed: this.queue.filter(i => i.status === 'failed').length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Resume on page load
   */
  static resumeUploads() {
    const manager = new UploadManager();
    const summary = manager.getSummary();

    console.log('📤 Upload queue summary:', summary);

    // Reset any 'uploading' status to 'pending' (interrupted by page reload)
    manager.queue.forEach(item => {
      if (item.status === 'uploading') {
        item.status = 'pending';
      }
    });
    manager.saveQueue();

    // Start processing
    if (summary.pending > 0 || summary.failed > 0) {
      console.log(`▶️ Resuming uploads: ${summary.pending} pending, ${summary.failed} retrying`);
      manager.processQueue();
    }

    return manager;
  }
}

// Export
window.UploadManager = UploadManager;
```

#### 4. Integration Points

**A. After Recording (recorder.js)**

```javascript
// BEFORE (blocking):
async function handleAccept() {
  // ... save to IndexedDB ...

  // BLOCKING upload
  await VideoUploader.uploadComplete(...);

  // Advance to next video
  advanceToNextVideo();
}

// AFTER (background):
async function handleAccept() {
  // ... save to IndexedDB ...

  // ENQUEUE upload (non-blocking)
  window.uploadManager.enqueueVideo(videoId, promptId, metadata);

  // Immediately advance to next video
  advanceToNextVideo();
}
```

**B. Page Load (recording.html)**

```javascript
// Initialize upload manager on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Resume any pending uploads
  window.uploadManager = UploadManager.resumeUploads();

  // ... rest of initialization ...
});
```

**C. Completion Screen (complete.html)**

```javascript
// Wait for all uploads to complete before allowing navigation
async function ensureUploadsComplete() {
  const summary = window.uploadManager.getSummary();

  if (summary.pending > 0 || summary.uploading > 0) {
    showMessage('Waiting for uploads to complete...');

    // Poll until done
    while (true) {
      const current = window.uploadManager.getSummary();
      if (current.pending === 0 && current.uploading === 0) {
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Check for failures
  if (summary.failed > 0) {
    showWarning(`${summary.failed} video(s) failed to upload. Please check your connection.`);
  }
}
```

### Failure Scenarios & Recovery

#### Scenario 1: Network Disconnected During Upload
**What Happens:**
1. Upload attempt fails with network error
2. Video status → `pending`, attempts++
3. Exponential backoff (2s, 4s, 8s, 16s, 32s)
4. Retry up to 5 times
5. If network returns, retry succeeds

**User Experience:**
- Recording continues immediately
- Background indicator shows "⏳ Retrying upload..."
- No user action required

#### Scenario 2: Browser Crash Mid-Upload
**What Happens:**
1. Upload state saved in localStorage after each chunk
2. On reload: UploadManager detects interrupted upload
3. Status reset from `uploading` → `pending`
4. Upload resumes from beginning (chunk progress could resume from last chunk)

**User Experience:**
- Page reloads
- Sees "Resuming uploads..." message
- Background upload continues

#### Scenario 3: Server Down
**What Happens:**
1. Upload fails with 500/503 error
2. Retry with exponential backoff
3. After 5 attempts → permanent failure
4. Video stays in IndexedDB
5. User sees "⚠️ 1 failed" indicator

**User Experience:**
- Can continue recording other videos
- At completion screen, warned about failed uploads
- Option to "Retry Failed Uploads" button

#### Scenario 4: Multiple Videos Pending
**What Happens:**
1. User records Videos 1, 2, 3 quickly
2. All enqueued
3. UploadManager processes sequentially: 1 → 2 → 3
4. If Video 1 fails, it retries but doesn't block Video 2

**User Experience:**
- Smooth recording flow
- Background indicator: "📤 Uploading... (2 pending)"

#### Scenario 5: Recording While Uploading
**Concern:** Does upload affect recording quality?

**Mitigations:**
1. Only one upload active at a time (no parallel uploads)
2. Monitor memory usage: if high, pause upload during recording
3. Chunk size: 1MB (small enough to not block network)
4. Measure: Profile CPU/network during concurrent operations

**Test:** Record Video 2 while Video 1 uploads. Check:
- Recording quality maintained
- No frame drops
- Upload continues in background

### UI Components

#### Upload Indicator (Subtle, Non-Intrusive)

**Location:** Top-right corner of recording screen

```html
<div id="uploadIndicator" class="upload-indicator idle">
  ✅ 2 uploaded
</div>
```

```css
.upload-indicator {
  position: fixed;
  top: 16px;
  right: 16px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  z-index: 1000;
  transition: all 0.3s ease;
}

.upload-indicator.idle {
  background: rgba(0, 200, 0, 0.1);
  color: #00c000;
  opacity: 0.7;
}

.upload-indicator.active {
  background: rgba(0, 120, 255, 0.1);
  color: #0078ff;
  opacity: 1;
  animation: pulse 2s infinite;
}

.upload-indicator.error {
  background: rgba(255, 100, 0, 0.1);
  color: #ff6400;
  opacity: 1;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

### Memory Management

**Challenge:** Recording + Upload + Storage = High Memory Usage

**Strategy:**
1. **Chunked Recording:** Write chunks to IndexedDB during recording (5MB at a time)
2. **Single Upload:** Only one video uploading at a time
3. **Progressive Deletion:** After successful upload, optionally delete from IndexedDB
4. **Memory Monitoring:** Check `performance.memory` if available

**Code:**
```javascript
// After successful upload
async function onUploadComplete(videoId) {
  // Optional: Free space by deleting uploaded video
  const deleteAfterUpload = true; // Could be user preference

  if (deleteAfterUpload) {
    await FacialStorage.deleteVideo(videoId);
    console.log(`🗑️ Deleted ${videoId} from local storage (uploaded to server)`);
  }
}
```

### Monitoring & Debugging

**Console Logging:**
```javascript
// On page load
console.log('📤 Upload Queue Status:');
console.log('  Total:', summary.total);
console.log('  Pending:', summary.pending);
console.log('  Uploading:', summary.uploading);
console.log('  Completed:', summary.completed);
console.log('  Failed:', summary.failed);
```

**Developer Tools:**
```javascript
// Expose manager globally for debugging
window.uploadManager = manager;

// In console:
uploadManager.getSummary()
uploadManager.queue
localStorage.getItem('uploadQueue')
```

### Testing Strategy

**Unit Tests:**
1. Enqueue video → Queue length increases
2. Process queue → Status updates correctly
3. Retry logic → Exponential backoff timing
4. Failure handling → Status changes to 'failed' after 5 attempts

**Integration Tests:**
1. Record 3 videos quickly → All upload successfully
2. Disconnect network mid-upload → Retries when reconnected
3. Refresh during upload → Resumes correctly
4. Server returns 500 → Retries with backoff

**Performance Tests:**
1. Record while uploading → No quality degradation
2. Memory usage during concurrent ops → Stays under 200MB
3. Upload speed → Similar to blocking approach

## Migration Plan

### Phase 1: Implement (1-2 days)
- [ ] Create `upload-manager.js` module
- [ ] Add upload queue to localStorage
- [ ] Implement state machine and retry logic
- [ ] Add UI indicator component

### Phase 2: Integration (1 day)
- [ ] Update `recorder.js` to use UploadManager
- [ ] Update `recording.html` to initialize manager
- [ ] Update `complete.html` to wait for uploads

### Phase 3: Testing (2-3 days)
- [ ] Test all failure scenarios
- [ ] Test on multiple devices
- [ ] Test network conditions
- [ ] Performance testing (recording during upload)
- [ ] Memory profiling

### Phase 4: Refinement (1 day)
- [ ] Adjust retry timing based on test results
- [ ] Optimize memory usage
- [ ] Polish UI indicators
- [ ] Add user feedback for failures

**Total Estimate:** 5-7 days for production-ready background upload

## Decision: When to Use Which Approach?

### Use Blocking Upload When:
- ✅ Reliability is paramount
- ✅ User base has poor network conditions
- ✅ Devices have low memory (<2GB RAM)
- ✅ Simpler to debug and maintain

### Use Background Upload When:
- ✅ User experience speed is critical
- ✅ Network is generally reliable
- ✅ Session has many videos (7-8+)
- ✅ Team can dedicate time to robust implementation

## Recommendation

**For Current 3-Video Prototype:**
→ **Keep Blocking Upload** (simpler, proven to work)

**For Future 7-8 Video Scale:**
→ **Implement Background Upload** (better UX, worth the complexity)

**Rationale:**
- 3 videos × 10s upload = 30s extra wait (acceptable)
- 8 videos × 10s upload = 80s extra wait (frustrating)
- Background upload ROI increases with more videos

## Alternative: Hybrid Approach

**Compromise Solution:**
- Upload during countdown/instruction screens (pseudo-background)
- Not truly background, but feels faster
- Simpler than full background queue
- Example:
  ```
  Video 1: Record → Accept → [Upload during countdown for Video 2] → Video 2 starts
  ```

**Pros:**
- Simpler than full background upload
- Still improves UX
- Fewer failure modes

**Cons:**
- Not as smooth as true background
- Still blocks if upload is slow

**Implementation:** 2-3 days instead of 5-7 days

---

## Conclusion

Background upload is valuable for 7-8+ video sessions, but requires significant engineering effort for 100% reliability. For the current 3-video prototype, blocking upload is sufficient. Revisit after initial testing phase to decide if the investment is worth it.
