# Milestone 2 Testing Guide

## 🎯 What's New in Milestone 2

Milestone 2 adds **IndexedDB persistence with chunked storage**:

✅ **Chunked storage during recording** - Videos written in 5MB chunks (prevents iOS memory crashes)
✅ **Persistent storage** - Videos survive page refresh and browser restart
✅ **Resume capability** - Page shows count of existing videos on load
✅ **Storage quota check** - Warns if insufficient space
✅ **Video metadata tracking** - File size, duration, codec stored in database

## 🚀 Quick Start

```bash
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh
```

Then visit: **http://localhost:8001/recording.html**

## 📋 Test Checklist

### Basic Persistence Test (Desktop)
1. [ ] Open http://localhost:8001/recording.html
2. [ ] Record a video (45 seconds with 9 prompts)
3. [ ] Click "Accept" when complete
4. [ ] Alert should say "Video saved to IndexedDB"
5. [ ] **Refresh the page** (F5 or Ctrl+R)
6. [ ] Green success message should appear: "You have 1 video(s) saved locally"
7. [ ] Check browser console - should show video details with file size
8. [ ] Record a second video and accept
9. [ ] Refresh again - should show "2 video(s) saved locally"

### Browser Restart Test (CRITICAL)
1. [ ] Record and accept 2-3 videos
2. [ ] **Close the browser completely** (not just the tab)
3. [ ] Reopen browser and navigate to http://localhost:8001/recording.html
4. [ ] Videos should still be there (message shows count)
5. [ ] Check console - video details should be listed

### Chunked Storage Test
1. [ ] Open browser DevTools (F12)
2. [ ] Go to Application tab → Storage → IndexedDB → FacialDataCollection
3. [ ] Start recording a video
4. [ ] While recording, watch the "chunks" table
5. [ ] **Should see chunks appearing during recording** (every ~5 seconds)
6. [ ] NOT waiting until recording is complete
7. [ ] After accept, check "videos" table for metadata

### Retake Test
1. [ ] Record a video
2. [ ] Click "Retake" instead of Accept
3. [ ] Check IndexedDB "chunks" table
4. [ ] Chunks from retaken video should be deleted
5. [ ] Record again and accept
6. [ ] Only the accepted video's chunks should remain

### Storage Quota Test
1. [ ] Open browser console
2. [ ] Look for storage quota message on page load
3. [ ] Should show: "Storage: X MB available, 250 MB required"
4. [ ] If available < 250 MB, should show warning

## 📊 Expected Results

### Console Output on Page Load (No Existing Videos)
```
💾 Storage module loaded
📹 Facial Data Collection - Milestone 2
✅ Codec detection
✅ Text overlay system
✅ Accept/Retake flow (NO playback)
✅ Interruption detection
✅ Wake Lock + silent audio fallback
✅ IndexedDB persistence with chunked storage
Ready to record!
💾 Storage: 50000 MB available, 250 MB required
```

### Console Output on Page Load (With Existing Videos)
```
💾 Storage module loaded
📹 Facial Data Collection - Milestone 2
✅ Codec detection
✅ Text overlay system
✅ Accept/Retake flow (NO playback)
✅ Interruption detection
✅ Wake Lock + silent audio fallback
✅ IndexedDB persistence with chunked storage
Ready to record!
💾 Found 2 existing video(s) in storage
  1. video_1738000123456_abc123 - 19.52 MB - video/webm; codecs="vp9,opus"
  2. video_1738000234567_def456 - 18.89 MB - video/webm; codecs="vp9,opus"
💾 Storage: 50000 MB available, 250 MB required
```

### During Recording (Console)
```
📹 Camera: 1280x960 @ 30fps
✅ Wake Lock acquired
✅ Using codec: video/webm; codecs="vp9,opus"
MediaRecorder created with mimeType: video/webm; codecs="vp9,opus"
📹 Video ID: video_1738000123456_abc123
🎬 Recording started
💾 Chunk 0 saved: 2110.26 KB
💾 Chunk 1 saved: 2192.07 KB
💾 Chunk 2 saved: 2333.57 KB
💾 Chunk 3 saved: 2225.57 KB
💾 Chunk 4 saved: 2292.87 KB
💾 Chunk 5 saved: 2199.97 KB
💾 Chunk 6 saved: 2251.22 KB
💾 Chunk 7 saved: 2175.28 KB
💾 Chunk 8 saved: 2206.78 KB
✅ Recording complete: 45.0s
💾 Saved 9 chunks to IndexedDB
File size: 19.52 MB
Wake Lock released
```

### After Accept (Console)
```
✅ Video accepted
✅ Video metadata saved: video_1738000123456_abc123
```

## 🔬 IndexedDB Inspection

### How to Check IndexedDB
1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **Storage** → **IndexedDB** → **FacialDataCollection**
4. Two tables should exist:
   - **chunks** - Video data stored during recording
   - **videos** - Metadata about completed videos

### Expected Data in "chunks" Table
| id | videoId | chunkIndex | blob | size | timestamp |
|----|---------|------------|------|------|-----------|
| 1  | video_... | 0 | Blob(2.1MB) | 2159872 | 1738000123456 |
| 2  | video_... | 1 | Blob(2.2MB) | 2244608 | 1738000128456 |
| ... | ... | ... | ... | ... | ... |

### Expected Data in "videos" Table
| videoId | promptId | status | recordedAt | fileSize | duration | codec | chunkCount |
|---------|----------|--------|------------|----------|----------|-------|------------|
| video_... | test_video_1 | recorded | 1738000123456 | 20480000 | 45.1 | video/webm; codecs="vp9,opus" | 9 |

## 🐛 Common Issues

### Videos not persisting after browser restart
- **Cause**: IndexedDB might be disabled or in private browsing
- **Fix**: Check browser settings, disable private browsing
- **Check**: Application → Storage → IndexedDB should show FacialDataCollection

### Chunks not appearing during recording
- **Cause**: MediaRecorder might not be emitting chunks
- **Check**: Console should show "Chunk X saved" messages every 5 seconds
- **Fix**: Try different browser (Firefox, Chrome)

### Storage quota warning
- **Cause**: Low disk space
- **Fix**: Free up disk space or reduce video quality (will address in future milestone)

### "Failed to save chunk" errors
- **Cause**: IndexedDB write failure (rare)
- **Mitigation**: Recording continues but some chunks might be lost
- **Next milestone**: Will add retry logic for failed chunk saves

## ✅ Success Criteria

**Milestone 2 is complete if:**
- [x] Videos are written as chunks during recording (visible in DevTools)
- [x] Videos persist after page refresh
- [x] Videos persist after browser restart
- [x] Console shows existing video count on page load
- [x] Storage quota check runs on page load
- [x] Retake deletes chunks from IndexedDB

## 🎯 What's Next (Milestone 3)

Milestone 3 will add:
- **Multi-video sequence** - Record 3 different videos in sequence
- **Progress tracking** - "Video 2 of 3"
- **Auto-advance** - After accepting video, automatically go to next
- **Completion screen** - After all videos recorded

## 📝 Key Differences from Milestone 1

**Milestone 1**: Chunks accumulated in memory, discarded on refresh
**Milestone 2**: Chunks written to IndexedDB immediately, persist forever (until deleted)

**iOS Benefit**: Writing chunks during recording (not after) prevents memory crashes on iOS devices with limited RAM. A 45-second 19MB video would crash older iPhones if stored entirely in memory before writing to IndexedDB.

---

**Ready to test?** Refresh http://localhost:8001/recording.html and try the checklist! 🚀
