# Debug Stuck Upload Issue

## Problem
Completion screen shows "⏳ Uploading..." indefinitely

## Quick Fix - Run in Browser Console

On the **complete.html** page, open DevTools Console (F12) and run:

```javascript
// Check upload queue state
const manager = UploadManager.resumeUploads();
manager.getSummary()

// Should show:
// {total: 3, pending: 0, uploading: 0, completed: 3, failed: 0, isProcessing: false}

// If you see uploading: 1 or pending: 1, check the queue:
manager.queue

// Force clear the queue if stuck:
manager.clearQueue()
localStorage.removeItem('uploadQueue')

// Then refresh the page
location.reload()
```

## Root Causes

### 1. Upload Already Complete But Status Not Updated
**Symptom:** Page shows "Uploading" but videos are already on server

**Check:**
```bash
# On server, check if videos exist
ls -lh ~/Desktop/facial-app/data/facial_recordings/session_*/
# Should see 3 .webm files
```

**Fix:** Clear the queue:
```javascript
localStorage.removeItem('uploadQueue')
location.reload()
```

### 2. Upload Actually Stuck (Network/Server Issue)
**Symptom:** Videos not on server, queue shows `uploading: 1`

**Check Console for:**
```
❌ Upload failed (attempt 1/5): Failed to fetch
⏳ Retrying in 2s...
```

**Fix:**
1. Check backend is running: `ps aux | grep python`
2. Check network in DevTools
3. Wait for retries to complete (up to 5 attempts)

### 3. Upload Manager Not Processing
**Symptom:** Queue shows `pending: 1` but `isProcessing: false`

**Fix:**
```javascript
// Force start processing
manager.processQueue()
```

### 4. Completion Page Timeout Too Short
**Current timeout:** 30 seconds

If uploads are legitimately slow, they may timeout. Check console for:
```
⏰ Upload timeout
```

## Permanent Fix Options

### Option A: Skip Upload Wait on Completion Screen
Remove the wait logic entirely - let uploads finish in background

**Edit:** `frontend/complete.html` line 106
```javascript
// Comment out this block:
// if (summary.pending > 0 || summary.uploading > 0) {
//     ... wait logic ...
// }

// Replace with:
if (summary.pending > 0 || summary.uploading > 0) {
    console.log(`📤 ${summary.pending + summary.uploading} uploads still in progress`);
    sessionSummary.innerHTML += '<div class="summary-item"><strong>Upload Status:</strong> <span class="status-warning">📤 Uploading in background</span></div>';
}
```

### Option B: Increase Timeout
Change line 116 in complete.html:
```javascript
const result = await uploadManager.waitForCompletion(30000); // 30 seconds
// to:
const result = await uploadManager.waitForCompletion(120000); // 2 minutes
```

### Option C: Return to Blocking Upload
If background upload causes too many issues:
1. Revert recorder.js to use blocking upload (see git history)
2. Remove upload-manager.js
3. Users wait 5-10s per video but it's more reliable

## Current Session Debug

Run this on complete.html page:

```javascript
// 1. Check localStorage
JSON.parse(localStorage.getItem('uploadQueue'))

// 2. Check if backend session exists
localStorage.getItem('backendSessionId')

// 3. Manually check backend
fetch('/api/session/' + localStorage.getItem('backendSessionId'))
  .then(r => r.json())
  .then(console.log)

// 4. Check IndexedDB videos
FacialStorage.getAllVideos().then(console.log)
```

## Most Likely Issue

Based on your symptom ("stuck on uploading"), most likely:

**The uploads already finished but the queue state wasn't cleared properly.**

**Quick fix:**
```javascript
localStorage.removeItem('uploadQueue')
location.reload()
```

Then check if videos are on server:
```bash
ls ~/Desktop/facial-app/data/facial_recordings/session_*/
```

If 3 videos exist → uploads worked, just a UI bug.
