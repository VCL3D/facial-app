# Testing Guide: End-to-End Upload Integration

## Overview

This guide walks through testing the complete flow from recording to backend upload, including all the debug logging.

## Prerequisites

### 1. Start Backend Server

```bash
cd /home/akanlis/Desktop/facial-app/backend

# Install dependencies (first time only)
pip3 install -r requirements.txt

# Start server
python3 app.py
```

**Expected Output:**
```
============================================================
Facial Data Collection - Backend Server
============================================================
Data directory: /home/akanlis/Desktop/facial-app/data/facial_recordings
Server starting on http://localhost:5000
============================================================
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://0.0.0.0:5000
```

### 2. Start Frontend Server

In a separate terminal:

```bash
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh
```

**Expected Output:**
```
🚀 Starting development server for Facial Data Collection...

✓ Using Python 3
📡 Server running at: http://localhost:8001
🔗 Open in browser: http://localhost:8001

Press Ctrl+C to stop the server
```

## Testing Flow

### Step 1: Open Recording Page

1. Open **http://localhost:8001**
2. Click **"Start Recording Session"**
3. **Open browser console** (F12)

**Expected Console Output:**
```
💾 Video Uploader module loaded
   Backend URL: http://localhost:5000
   Chunk size: 1MB
   Max retries: 3
   Debug mode: ENABLED
📊 State module loaded
💾 Storage module loaded
📹 Facial Data Collection - Milestone 4
✅ Codec detection
✅ Text overlay system
✅ Accept/Retake flow (NO playback)
✅ Interruption detection
✅ Wake Lock + silent audio fallback
✅ IndexedDB persistence with chunked storage
✅ Multi-video sequence
✅ Backend upload integration
Ready to record!
🚀 Initializing session...
```

**Expected on First Visit:**
```
ℹ️ [15:30:45.123] Creating new session...
🔍 [15:30:45.234] Session creation response status: 201
✅ [15:30:45.235] Session created: abc-123-def-456
🔍 [15:30:45.236] Session data: {session_id: "abc-123-def-456", ...}
✅ Backend session created: abc-123-def-456
```

**Expected on Subsequent Visits:**
```
✅ Using existing backend session: abc-123-def-456
```

### Step 2: Record First Video

1. Click **"Start Recording"**
2. Wait for countdown (3... 2... 1...)
3. Recording starts with live prompts
4. Wait for video to complete (~45 seconds)
5. Click **"Accept"**

**Expected Console Output During Recording:**
```
📸 Initializing camera...
🎥 Camera: HD Webcam
🎥 Resolution: 1280x960 @ 30fps
✅ Camera initialized
🔒 Attempting Wake Lock...
✅ Wake Lock acquired
⏱️ Starting countdown...
🎬 Starting recording for: Facial Expressions (facial_expressions)
▶️ Recording started
📝 Saving chunk 0 (size: 512.5 KB)
📝 Saving chunk 1 (size: 512.3 KB)
...
⏹️ Recording stopped
📊 Total chunks: 8
💾 Saving metadata: {videoId: "...", promptId: "facial_expressions", ...}
✅ Video saved to IndexedDB
```

**Expected Console Output During Upload (After Accept):**
```
📤 Starting background upload...
ℹ️ [15:31:45.123] 🚀 Starting complete upload (video + metadata)
ℹ️ [15:31:45.124]    Video ID: video_1234567890
ℹ️ [15:31:45.125]    Blob size: 15.24 MB
🔍 [15:31:45.126]    Metadata: {videoId: "...", prompt_id: "facial_expressions", ...}
ℹ️ [15:31:45.127] Step 1/2: Uploading video chunks...
ℹ️ [15:31:45.128] 📤 Starting chunked upload for video video_1234567890
ℹ️ [15:31:45.129]    Size: 15.24 MB
🔍 [15:31:45.130]    Session: abc-123-def-456
🔍 [15:31:45.131]    Blob type: video/webm
ℹ️ [15:31:45.132]    Total chunks: 16
🔍 [15:31:45.133]    Chunk size: 1024KB
🔍 [15:31:45.134] Uploading chunk 0/15, size: 1024.0KB
🔍 [15:31:45.245] Chunk 0 uploaded in 111ms
🔍 [15:31:45.246] Chunk 0 response: {status: "chunk_received", chunk_index: 0, ...}
ℹ️ [15:31:45.247]    Chunk 1/16 uploaded (6.2%) - 113ms
🔍 [15:31:45.248]    Average speed: 9069.0 KB/s
...
ℹ️ [15:31:47.890]    Chunk 16/16 uploaded (100.0%) - 95ms
✅ [15:31:47.891] Video upload complete: abc-123-def-456/video_1234567890.webm
ℹ️ [15:31:47.892]    Total time: 2.8s
ℹ️ [15:31:47.893]    Average speed: 5442.9 KB/s
ℹ️ [15:31:47.894] Step 2/2: Uploading metadata...
ℹ️ [15:31:47.895] 📝 Uploading metadata for video video_1234567890
🔍 [15:31:47.896] Metadata: {videoId: "...", prompt_id: "facial_expressions", ...}
🔍 [15:31:47.982] Metadata response status: 200
✅ [15:31:47.983] Metadata uploaded for video video_1234567890
🔍 [15:31:47.984] Metadata response: {status: "metadata_saved", ...}
✅ [15:31:47.985] ✅ Complete upload finished in 2.9s
✅ Upload complete: video_1234567890
```

**Backend Console Output:**
```
📝 Creating new session: abc-123-def-456
✅ Created session directory: .../data/facial_recordings/abc-123-def-456
✅ Session abc-123-def-456 created successfully
127.0.0.1 - - [27/Jan/2026 15:31:45] "POST /api/session/create HTTP/1.1" 201 -
127.0.0.1 - - [27/Jan/2026 15:31:45] "POST /api/upload/chunk HTTP/1.1" 200 -
127.0.0.1 - - [27/Jan/2026 15:31:45] "POST /api/upload/chunk HTTP/1.1" 200 -
...
127.0.0.1 - - [27/Jan/2026 15:31:47] "POST /api/upload/metadata HTTP/1.1" 200 -
```

### Step 3: Record Second and Third Videos

1. After accepting the first video, you'll return to the instruction screen for Video 2
2. Repeat the recording process
3. After accepting Video 3, you'll be redirected to the completion screen

**Expected:** Each video uploads in the background while you continue to the next one.

### Step 4: Verify Uploaded Files

Check the backend data directory:

```bash
cd /home/akanlis/Desktop/facial-app/data/facial_recordings
ls -lh
```

**Expected:**
```
total 4.0K
drwxr-xr-x 2 user user 4.0K Jan 27 15:35 abc-123-def-456
```

```bash
cd abc-123-def-456
ls -lh
```

**Expected:**
```
-rw-r--r-- 1 user user  15M Jan 27 15:31 video_1234567890.webm
-rw-r--r-- 1 user user 1.2K Jan 27 15:31 video_1234567890.metadata.json
-rw-r--r-- 1 user user  16M Jan 27 15:33 video_1234567891.webm
-rw-r--r-- 1 user user 1.2K Jan 27 15:33 video_1234567891.metadata.json
-rw-r--r-- 1 user user  14M Jan 27 15:35 video_1234567892.webm
-rw-r--r-- 1 user user 1.2K Jan 27 15:35 video_1234567892.metadata.json
-rw-r--r-- 1 user user  512 Jan 27 15:30 session.json
```

### Step 5: Verify Video Playback

Test that uploaded videos are playable:

```bash
cd /home/akanlis/Desktop/facial-app/data/facial_recordings/abc-123-def-456
vlc video_1234567890.webm
# or
mpv video_1234567890.webm
# or use your system's default video player
```

**Expected:** Video plays correctly showing the recording.

### Step 6: Check Backend Session Info

Query the backend API:

```bash
SESSION_ID="abc-123-def-456"  # Replace with your actual session ID
curl http://localhost:5000/api/session/$SESSION_ID | jq
```

**Expected Response:**
```json
{
  "session_id": "abc-123-def-456",
  "participant_id": null,
  "created_at": "2026-01-27T15:30:45.123456",
  "status": "created",
  "videos": [
    {
      "video_id": "video_1234567890",
      "prompt_id": "facial_expressions",
      "uploaded_at": "2026-01-27T15:31:47.985432"
    },
    {
      "video_id": "video_1234567891",
      "prompt_id": "head_movements",
      "uploaded_at": "2026-01-27T15:33:22.123456"
    },
    {
      "video_id": "video_1234567892",
      "prompt_id": "eye_movements",
      "uploaded_at": "2026-01-27T15:35:12.654321"
    }
  ]
}
```

## Troubleshooting

### Issue: "Backend session not available, skipping upload"

**Cause:** Backend server is not running or frontend can't connect

**Solution:**
1. Check backend is running on port 5000
2. Check CORS is enabled
3. Check browser console for connection errors
4. Try: `curl http://localhost:5000/health`

### Issue: Upload fails with "Failed to fetch"

**Cause:** Network/CORS issue

**Solution:**
1. Check backend logs for errors
2. Verify CORS is enabled in backend
3. Try clearing localStorage: `localStorage.clear()`
4. Refresh page and try again

### Issue: Chunks upload slowly

**Cause:** Network speed or large video file

**Check Console:**
```
🔍 Average speed: 234.5 KB/s  ← This should be >1000 KB/s on localhost
```

**Solution:**
- For localhost, speed should be very fast (5000+ KB/s)
- If slow, check system resources
- Backend may be rate-limited

### Issue: Video not found in data directory

**Cause:** Upload may have failed silently

**Check:**
1. Browser console for upload errors
2. Backend console for server errors
3. Check partial uploads: `ls /home/akanlis/Desktop/facial-app/data/facial_recordings/*/`

### Issue: "Session already complete, redirecting..."

**Cause:** Session state thinks all videos are done

**Solution:**
```bash
# Clear session state
localStorage.removeItem('sessionState');
localStorage.removeItem('backendSessionId');
# Refresh page
```

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads recording page
- [ ] Backend session created on first visit
- [ ] Backend session reused on subsequent visits
- [ ] Video 1 records successfully
- [ ] Video 1 saves to IndexedDB
- [ ] Video 1 uploads start immediately after accept
- [ ] Upload progress logs visible in console
- [ ] Upload completes successfully
- [ ] Backend logs show chunk uploads
- [ ] Video 2 and 3 record and upload
- [ ] All 3 videos appear in data directory
- [ ] Videos are playable
- [ ] Session info API returns correct data
- [ ] Backend session persists across page refreshes

## Performance Expectations

### Localhost Performance
- **Upload speed**: 5,000-10,000 KB/s
- **15MB video upload time**: 2-3 seconds
- **Per-chunk upload time**: 50-150ms

### Real Network Performance (Future)
- **Upload speed**: 500-2000 KB/s (4G/WiFi)
- **15MB video upload time**: 10-30 seconds
- **Retry logic**: Automatic on failure

## Next Steps

After verifying the upload integration:
1. Test with network throttling (Chrome DevTools → Network → Slow 3G)
2. Test retry logic by stopping backend mid-upload
3. Test multiple sessions (clear localStorage between tests)
4. Proceed to Milestone 5: Background Upload Optimization

---

**Status**: Upload Integration Complete
**Version**: 1.4.0 (Milestone 4)
**Last Updated**: 2026-01-27
