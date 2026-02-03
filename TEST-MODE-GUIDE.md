# Test Mode Configuration Guide

## Overview

Test mode allows rapid testing with short videos (5 seconds each) while stress-testing the upload system with artificially inflated file sizes.

## What Was Changed

### 1. Short Test Videos (3 videos × 5 seconds each)

**File:** [frontend/data/videos.json](frontend/data/videos.json)

**Before (Production):**
- Video 1: 45 seconds, 9 prompts
- Video 2: 60 seconds, read-then-perform
- Video 3: 45 seconds, read-then-perform
- **Total time:** ~3-4 minutes

**Now (Test Mode):**
- Video 1: 5 seconds, 1 prompt ("Look at camera and smile")
- Video 2: 5 seconds, 1 prompt ("Turn head left and right")
- Video 3: 5 seconds, 1 prompt ("Nod your head")
- **Total time:** ~30-45 seconds

**Backup:** Production config saved to `videos.PRODUCTION.json`

### 2. File Size Inflation

**File:** [frontend/js/recorder.js](frontend/js/recorder.js) lines 3-11

**Configuration:**
```javascript
const TEST_MODE = {
    enabled: true,           // SET TO FALSE FOR PRODUCTION
    inflateFileSize: true,   // Artificially increase file size
    targetSizeMB: 25         // Target file size (simulates real 45-60s video)
};
```

**How It Works:**
1. User records 5-second video (~2-3 MB actual size)
2. After recording, system adds random padding to reach 25 MB
3. Inflated file uploaded to backend (stress tests upload)
4. Original video quality preserved (padding appended after video data)

### 3. Storage Helper Function

**File:** [frontend/js/storage.js](frontend/js/storage.js) lines 265-292

Added `saveInflatedBlob()` function:
- Replaces original chunks with inflated blob
- Updates metadata with new file size
- Maintains compatibility with upload system

## Benefits

### For Testers
✅ **Faster iteration:** 30 seconds per session vs 3-4 minutes
✅ **No fatigue:** Simple 5-second tasks, not exhausting
✅ **More test cycles:** Can test 10× more scenarios in same time

### For Developers
✅ **Upload stress testing:** 25 MB files test real-world conditions
✅ **Network reliability:** Test retry logic, timeouts, failures
✅ **Background upload:** Test queue processing under load
✅ **Crash recovery:** Test with realistic file sizes

## Usage

### Enable Test Mode (Current State)

**Already configured!** Just use the app normally:

```bash
# Open browser
https://localhost/recording.html

# Record 3 quick videos (5 seconds each)
# Files automatically inflated to 25 MB each
# Total uploaded: 75 MB
```

### Console Output

When recording with test mode enabled:

```
🧪 TEST MODE: Inflating file size for upload stress test...
  Original size: 2.34 MB
  ✅ Inflated to: 25.00 MB (added 22.66 MB padding)
📤 Enqueuing video for background upload...
```

### Disable Test Mode (Production)

**Before deploying to real users:**

1. **Edit [frontend/js/recorder.js](frontend/js/recorder.js) line 7:**
   ```javascript
   enabled: false,  // SET TO FALSE FOR PRODUCTION
   ```

2. **Restore production videos:**
   ```bash
   cp frontend/data/videos.PRODUCTION.json frontend/data/videos.json
   ```

3. **Verify:**
   ```bash
   # Check TEST_MODE.enabled = false
   grep "enabled:" frontend/js/recorder.js

   # Check videos.json has full prompts
   cat frontend/data/videos.json | grep duration
   ```

## Testing Scenarios

### 1. Basic Upload Test (Happy Path)

**Goal:** Verify inflated files upload successfully

**Steps:**
1. Record 3 videos (15 seconds total)
2. Check console for inflation logs
3. Wait for uploads to complete
4. Verify on server:
   ```bash
   ls -lh ~/Desktop/facial-app/data/facial_recordings/*/
   # Should see 3 files × ~25 MB each
   ```

**Expected:** All 3 videos uploaded successfully

### 2. Network Failure Test

**Goal:** Test retry logic with large files

**Steps:**
1. Record Video 1 → Accept
2. **Enable offline mode** in DevTools
3. Watch console for retries
4. **Disable offline** after 10 seconds
5. Upload completes

**Expected:** Retries with exponential backoff, succeeds when network returns

### 3. Multiple Quick Recordings

**Goal:** Test background upload queue with large files

**Steps:**
1. Record all 3 videos quickly (back-to-back)
2. All enqueue immediately
3. Watch upload indicator: "📤 Uploading... (2 pending)"
4. Monitor console for sequential processing

**Expected:** Videos upload one at a time, all succeed

### 4. Browser Crash Test

**Goal:** Verify upload resume with inflated files

**Steps:**
1. Record Video 1 → Accept (starts uploading 25 MB)
2. **Force close browser** mid-upload
3. Reopen browser
4. Navigate back to app
5. Check console for resume message

**Expected:** Upload resumes from localStorage queue

### 5. Slow Network Test

**Goal:** Test upload progress with large files on slow connection

**Steps:**
1. **DevTools → Network → Slow 3G**
2. Record Video 1 → Accept
3. Watch upload indicator pulse
4. Monitor progress in console

**Expected:** Upload takes longer (~20-30 seconds) but completes

## File Size Calculations

### Actual Recording Size
- 5 seconds @ 1080p, 12 Mbps video + 320 kbps audio
- Video: (12 Mbps × 5s) / 8 = 7.5 MB
- Audio: (320 kbps × 5s) / 8 = 0.2 MB
- **Compressed actual:** ~2-3 MB (with VP9/H.264 compression)

### Inflated Size
- Original: 2-3 MB
- Padding: ~22-23 MB random data
- **Total:** 25 MB

### Simulates Production Video
- Real 45-second video @ same quality ≈ 18-27 MB
- Real 60-second video @ same quality ≈ 24-36 MB

## Adjusting Target Size

**To change inflated file size:**

Edit [frontend/js/recorder.js](frontend/js/recorder.js) line 10:

```javascript
const TEST_MODE = {
    enabled: true,
    inflateFileSize: true,
    targetSizeMB: 25  // Change this value
};
```

**Recommended values:**
- `10` MB: Quick tests, lower network stress
- `25` MB: Realistic (default, simulates 45s video)
- `50` MB: Heavy stress test (simulates 90s video)
- `100` MB: Extreme stress test

## Verification

### Check Test Mode Is Active

**Browser Console (F12):**
```javascript
// On any page, check:
fetch('/js/recorder.js')
  .then(r => r.text())
  .then(code => {
    const match = code.match(/enabled:\s*(true|false)/);
    console.log('TEST_MODE.enabled:', match ? match[1] : 'not found');
  });
```

### Check Video Sizes on Server

```bash
# After completing session, check actual uploaded file sizes
cd ~/Desktop/facial-app/data/facial_recordings

# Find most recent session
ls -lt | head -5

# Check file sizes
cd session_*/
ls -lh *.webm

# Should see ~25 MB files if test mode enabled
```

### Check Original vs Inflated

**Console logs during recording:**
```
Original size: 2.34 MB        # Actual recorded size
Inflated to: 25.00 MB         # After padding
```

## Troubleshooting

### Issue: Files Not Inflated

**Symptoms:** Files upload as ~2-3 MB instead of 25 MB

**Check:**
1. Console shows `🧪 TEST MODE: Inflating...`?
2. `TEST_MODE.enabled = true` in recorder.js?
3. `TEST_MODE.inflateFileSize = true`?

**Fix:** Verify configuration in recorder.js lines 7-11

### Issue: Inflation Fails

**Symptoms:** Console shows error during inflation

**Possible causes:**
- IndexedDB storage quota exceeded
- Browser security restrictions
- Memory limit reached

**Fix:** Check console error, may need to reduce `targetSizeMB`

### Issue: Uploads Too Slow

**Symptoms:** Even with 5s videos, uploads take forever

**Cause:** Inflated 25 MB files on slow network

**Options:**
1. Reduce `targetSizeMB` to 10 MB
2. Test on faster network
3. Temporarily disable inflation: `inflateFileSize: false`

## Production Checklist

**Before deploying to real users:**

- [ ] Set `TEST_MODE.enabled = false` in recorder.js
- [ ] Restore `videos.PRODUCTION.json` to `videos.json`
- [ ] Test one full session with production videos
- [ ] Verify file sizes are realistic (~20-40 MB for 45-60s)
- [ ] Update any documentation mentioning test mode
- [ ] Remove test session data from server

## File Reference

### Modified Files
1. ✅ [frontend/data/videos.json](frontend/data/videos.json) - Short test videos
2. ✅ [frontend/js/recorder.js](frontend/js/recorder.js) - TEST_MODE config + inflation logic
3. ✅ [frontend/js/storage.js](frontend/js/storage.js) - saveInflatedBlob() function

### Backup Files
1. 📄 [frontend/data/videos.PRODUCTION.json](frontend/data/videos.PRODUCTION.json) - Original production config

### Documentation
1. 📄 This file: TEST-MODE-GUIDE.md

## Quick Reference

**Enable test mode:**
```javascript
// recorder.js line 7
enabled: true
```

**Disable test mode:**
```javascript
// recorder.js line 7
enabled: false
```

**Restore production videos:**
```bash
cp frontend/data/videos.PRODUCTION.json frontend/data/videos.json
```

**Check current mode:**
```bash
grep "enabled:" frontend/js/recorder.js
```

---

**Ready for testing!** Open https://localhost/recording.html and record 3 quick 5-second videos. Check console logs for inflation messages and monitor upload sizes.
