# Background Upload - Testing Guide

## What Was Implemented

### Summary
The app now uploads videos **in the background** while users continue recording. Users no longer wait 5-15 seconds between videos for uploads to complete.

### Components Added

1. **upload-manager.js** - Core background upload engine
   - Persistent queue in localStorage
   - Automatic retry with exponential backoff (2s, 4s, 8s, 16s, 32s)
   - Crash recovery (resumes on page reload)
   - Sequential processing (one upload at a time)

2. **UI Indicator** - Subtle status indicator (top-right corner)
   - `📤 Uploading... (2 pending)` - Active upload
   - `✅ 3 uploaded` - All complete
   - `⚠️ 1 failed` - Upload failures

3. **Integration Changes**
   - [recorder.js](frontend/js/recorder.js) - Enqueues videos instead of blocking
   - [recording.html](frontend/recording.html) - Loads upload-manager.js and shows indicator
   - [complete.html](frontend/complete.html) - Waits for pending uploads before cleanup

## How It Works

### Normal Flow
```
User: Record Video 1 → Accept
  ↓
App: Save to IndexedDB → Enqueue upload → Show next video immediately
  ↓
Background: Upload Video 1 starts
  ↓
User: Record Video 2 → Accept (while Video 1 uploads)
  ↓
App: Enqueue Video 2 → Show next video immediately
  ↓
Background: Video 1 finishes → Video 2 starts uploading
```

**Result:** User records 3 videos in ~3-4 minutes instead of ~4-5 minutes

### Failure & Recovery

#### Scenario 1: Network Disconnects
```
Upload Video 1 → Network fails at 50%
  ↓
Upload Manager: Retry attempt 1 (wait 2s)
  ↓
Still no network: Retry attempt 2 (wait 4s)
  ↓
Network returns: Retry attempt 3 (succeeds)
```

#### Scenario 2: Browser Crashes Mid-Upload
```
Upload Video 1 → 60% complete → Browser crashes
  ↓
User reopens page
  ↓
Upload Manager: Load queue from localStorage
  ↓
Reset status from 'uploading' to 'pending'
  ↓
Resume upload from beginning
```

#### Scenario 3: Completion Screen with Pending Uploads
```
User finishes 3 videos
  ↓
Navigate to complete.html
  ↓
Upload Manager: Check queue - 1 video still uploading
  ↓
Show "⏳ Uploading..." status
  ↓
Wait up to 5 minutes for completion
  ↓
Show final status: "✅ All uploaded" or "⚠️ 1 failed"
```

## Testing Instructions

### 1. Basic Flow Test (Happy Path)

**Goal:** Verify videos upload in background without blocking

**Steps:**
1. Open https://localhost (or https://195.251.117.230)
2. Start recording session
3. Record Video 1 → Accept
   - ✅ **Check**: Immediately advances to Video 2 (no waiting)
   - ✅ **Check**: Top-right shows "📤 Uploading..."
4. Record Video 2 → Accept while Video 1 uploads
   - ✅ **Check**: Still advances immediately
   - ✅ **Check**: Indicator shows "📤 Uploading... (1 pending)"
5. Record Video 3 → Accept
6. Navigate to completion screen
   - ✅ **Check**: Shows "✅ All uploaded" when done

**Console Checks:**
```javascript
// Should see these logs:
✅ Video enqueued for upload
▶️ Starting queue processing...
📤 Uploading facial_expressions (attempt 1/5)...
✅ Upload complete: facial_expressions
```

**Backend Verification:**
```bash
# Check that all 3 videos exist on server
ls -lh ~/Desktop/facial-app/data/facial_recordings/{session-id}/
# Should see 3 .webm files
```

### 2. Network Failure Test

**Goal:** Verify retry logic works

**Steps:**
1. Start recording session
2. Record Video 1 → Accept
3. **Open DevTools** → Network tab → **Enable "Offline" mode**
4. Watch console for retry attempts:
   ```
   ❌ Upload failed (attempt 1/5): Failed to fetch
   ⏳ Retrying in 2s...
   ❌ Upload failed (attempt 2/5): Failed to fetch
   ⏳ Retrying in 4s...
   ```
5. **Disable "Offline" mode** after ~10 seconds
6. ✅ **Check**: Upload completes on next retry
   ```
   📤 Uploading facial_expressions (attempt 3/5)...
   ✅ Upload complete: facial_expressions
   ```

**Expected Result:**
- Upload automatically retries with increasing delays
- Succeeds when network returns
- User can continue recording during retries

### 3. Browser Crash Test

**Goal:** Verify uploads resume after crash

**Steps:**
1. Start recording session
2. Record Video 1 → Accept (upload starts)
3. **Force close browser** (don't wait for upload to finish)
   - Linux: `killall chrome` or `killall firefox`
   - Or manually close browser process
4. **Reopen browser** → Navigate to https://localhost/recording.html
5. ✅ **Check console**:
   ```
   📤 Upload queue summary: { total: 1, pending: 1, uploading: 0, ... }
   🔄 Reset facial_expressions from 'uploading' to 'pending'
   ▶️ Resuming uploads: 1 pending, 0 failed
   ```
6. ✅ **Check**: Upload resumes and completes

**Expected Result:**
- Queue persists in localStorage
- Upload automatically resumes
- No data loss

### 4. Multiple Quick Recordings Test

**Goal:** Verify queue handles rapid recordings

**Steps:**
1. Start recording session
2. Record all 3 videos as fast as possible:
   - Video 1: Record ~2 seconds → Accept immediately
   - Video 2: Record ~2 seconds → Accept immediately
   - Video 3: Record ~2 seconds → Accept immediately
3. ✅ **Check indicator**: Shows "📤 Uploading... (2 pending)"
4. ✅ **Check console**: Videos upload sequentially
   ```
   ✅ Video enqueued: facial_expressions (Queue size: 1)
   ✅ Video enqueued: head_movements (Queue size: 2)
   ✅ Video enqueued: eye_movements (Queue size: 3)
   📤 Uploading facial_expressions...
   ✅ Upload complete: facial_expressions
   📤 Uploading head_movements...
   ✅ Upload complete: head_movements
   📤 Uploading eye_movements...
   ✅ Upload complete: eye_movements
   ```

**Expected Result:**
- All 3 videos enqueue instantly
- Upload manager processes sequentially (not in parallel)
- All complete successfully

### 5. Server Down Test

**Goal:** Verify behavior when backend is unavailable

**Steps:**
1. **Stop backend:**
   ```bash
   killall python
   ```
2. Start recording session (may show warning about backend)
3. Record Video 1 → Accept
4. ✅ **Check console**:
   ```
   ❌ Upload failed (attempt 1/5): Failed to fetch
   ⏳ Retrying in 2s...
   ❌ Upload failed (attempt 2/5): Failed to fetch
   ⏳ Retrying in 4s...
   ...continues up to attempt 5...
   🚨 Video upload permanently failed: facial_expressions
   ```
5. ✅ **Check indicator**: Shows "⚠️ 1 failed"
6. **Restart backend:**
   ```bash
   cd ~/Desktop/facial-app/backend
   venv/bin/python app.py &
   ```
7. Refresh page
8. ✅ **Check**: Failed upload doesn't auto-retry (maxed out attempts)

**Expected Result:**
- Retry up to 5 times with exponential backoff
- Mark as permanently failed after max attempts
- UI shows failure status

### 6. Completion Screen Wait Test

**Goal:** Verify completion screen waits for uploads

**Steps:**
1. Start recording session
2. Record all 3 videos quickly
3. Navigate to completion screen **while uploads are still pending**
4. ✅ **Check**: Shows "Upload Status: ⏳ Uploading..."
5. Wait for uploads to complete
6. ✅ **Check**: Status updates to "Upload Status: ✅ All uploaded"

**Console Checks:**
```javascript
⏳ Waiting for 2 uploads to complete...
✅ All 3 uploads complete
```

### 7. Memory Stress Test

**Goal:** Verify recording while uploading doesn't affect quality

**Steps:**
1. **Open DevTools** → Performance/Memory tab
2. Start baseline memory measurement
3. Record Video 1 → Accept (starts upload)
4. **Immediately** record Video 2 (while Video 1 uploads)
5. ✅ **Check**:
   - No frame drops during recording
   - Video 2 quality same as Video 1
   - Memory stays under 200MB

**Verify Video Quality:**
```bash
# Download and play videos
ls -lh ~/Desktop/facial-app/data/facial_recordings/{session-id}/*.webm
# Both should be similar size (~20-40MB for 45s video)
```

### 8. localStorage Inspection Test

**Goal:** Understand queue persistence

**Steps:**
1. Record Video 1 → Accept
2. **Open DevTools Console**:
   ```javascript
   // View queue
   window.uploadManager.getSummary()
   // Output: {total: 1, pending: 0, uploading: 1, completed: 0, failed: 0}

   // View raw queue data
   JSON.parse(localStorage.getItem('uploadQueue'))
   // Shows full queue structure
   ```
3. ✅ **Check**: Queue contains videoId, promptId, status, attempts, metadata

### 9. Concurrent Sessions Test (Edge Case)

**Goal:** Verify behavior if user opens two tabs

**Steps:**
1. Open Tab 1: https://localhost/recording.html
2. Open Tab 2: https://localhost/recording.html
3. Record videos in both tabs
4. ✅ **Expected behavior**:
   - Each tab has its own UploadManager instance
   - Both upload in background
   - May interfere (both processing same queue)

**Note:** This is an edge case. Consider adding tab locking if needed.

## Debugging Tools

### Console Commands

```javascript
// Get upload queue summary
window.uploadManager.getSummary()

// View full queue
window.uploadManager.queue

// Check localStorage
localStorage.getItem('uploadQueue')

// Clear queue (for testing)
window.uploadManager.clearQueue()

// Force process queue
window.uploadManager.processQueue()
```

### Network Throttling (Chrome DevTools)

1. DevTools → Network tab
2. Throttling dropdown → "Slow 3G"
3. Test uploads under poor network conditions

### Offline Mode (Chrome DevTools)

1. DevTools → Network tab
2. Check "Offline" checkbox
3. Test retry logic

## Success Criteria

✅ **Must Pass:**
1. Videos upload in background without blocking UI
2. Uploads resume after browser crash (localStorage)
3. Retry works when network disconnects/reconnects
4. Sequential upload (not parallel)
5. Completion screen waits for pending uploads
6. Failed uploads marked clearly in UI

✅ **Nice to Have:**
1. No memory leaks during long sessions
2. Recording quality unaffected while uploading
3. Error messages are clear and actionable

## Known Limitations

1. **No pause/cancel**: Once enqueued, uploads continue until success or 5 failures
2. **No upload progress during recording**: Indicator shows pending count, not percentage
3. **No per-video retry control**: All videos retry with same strategy
4. **Tab conflicts**: Multiple tabs may process same queue (rare edge case)

## Next Steps After Testing

Based on test results, consider:

1. **If uploads are too slow**: Increase chunk size (currently 1MB)
2. **If memory is high**: Enable delete-after-upload (currently disabled)
3. **If retries are insufficient**: Increase max attempts from 5 to 10
4. **If UI indicator is missed**: Make it more prominent or add sound
5. **If uploads fail often**: Add "Retry Failed" button in completion screen

## Comparison: Blocking vs Background Upload

### Blocking Upload (Before)
```
Record Video 1 (45s) → Accept → Upload (10s wait) → Video 2
Record Video 2 (60s) → Accept → Upload (10s wait) → Video 3
Record Video 3 (45s) → Accept → Upload (10s wait) → Complete

Total time: 45 + 10 + 60 + 10 + 45 + 10 = 180 seconds (3 minutes)
```

### Background Upload (Now)
```
Record Video 1 (45s) → Accept → Video 2 (upload happens in background)
Record Video 2 (60s) → Accept → Video 3 (upload happens in background)
Record Video 3 (45s) → Accept → Complete (wait for uploads to finish ~5s)

Total time: 45 + 60 + 45 + 5 = 155 seconds (2.5 minutes)
```

**Time Saved:** ~25-30 seconds per session (15-20% faster)

---

## Quick Start

**To test right now:**

1. Open browser to https://localhost or https://195.251.117.230
2. Open DevTools Console (F12)
3. Start recording session
4. Watch console logs for upload activity
5. Check top-right corner for upload indicator
6. Try disconnecting network mid-upload to test retry

**Backend must be running:**
```bash
ps aux | grep "python.*app.py"
# Should see process on port 5001
```

**If backend isn't running:**
```bash
cd ~/Desktop/facial-app/backend
venv/bin/python app.py > ../backend.log 2>&1 &
```

Good luck testing! 🚀
