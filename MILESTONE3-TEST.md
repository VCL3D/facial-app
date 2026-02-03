# Milestone 3 Testing Guide: Multi-Video Sequence

## What Was Built

Milestone 3 implements the multi-video sequence flow with 3 different video types:

1. **Video 1: Facial Expressions** (45s, live prompts mode)
   - 9 different expression prompts cycling every 5 seconds

2. **Video 2: Head Movements** (60s, read-then-perform mode)
   - 15 seconds to read instructions
   - 45 seconds to perform movements

3. **Video 3: Eye Movements** (45s, read-then-perform mode)
   - 15 seconds to read instructions
   - 30 seconds to perform movements

## New Features

### Progress Indicator
- Shows "Video X of 3" at the top of the screen
- Updates automatically as you progress through videos

### Dynamic Instruction Screen
- Title and description change based on current video
- Instructions adapt to video mode (live prompts vs read-then-perform)

### Auto-Advance After Accept
- After accepting a video, automatically loads the next video
- Returns to instruction screen for next video
- Navigates to completion screen after all 3 videos

### Session State Management
- Tracks which videos have been completed
- Allows resuming from correct video after page refresh
- Prevents re-recording completed videos

### Completion Screen
- Shows session summary with all recorded videos
- Displays video details (size, duration, codec)
- Provides return to home option

## Files Created/Modified

### New Files
- [frontend/data/videos.json](frontend/data/videos.json) - Video definitions
- [frontend/js/state.js](frontend/js/state.js) - Session state management
- [frontend/complete.html](frontend/complete.html) - Completion screen

### Modified Files
- [frontend/recording.html](frontend/recording.html) - Added progress indicator, dynamic title/description
- [frontend/css/styles.css](frontend/css/styles.css) - Added completion screen styles
- [frontend/js/recorder.js](frontend/js/recorder.js) - Integrated multi-video flow, auto-advance logic

## Testing Steps

### 1. Start Fresh Session

```bash
# Make sure server is running
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh

# Open in browser
# Visit: http://localhost:8001/recording.html
```

**Expected**:
- ✅ Progress indicator shows "Video 1 of 3"
- ✅ Title shows "Facial Expressions"
- ✅ Description shows "Show different facial expressions"
- ✅ Instructions are appropriate for live prompts mode

### 2. Record Video 1 (Facial Expressions)

**Click "Start Recording"**

**Expected**:
- ✅ Countdown: 3... 2... 1...
- ✅ Recording starts with live prompts above video
- ✅ Prompts cycle through 9 expressions every 5 seconds
- ✅ Progress bar fills over 45 seconds
- ✅ "Recording Complete!" screen appears after 45 seconds

**Click "Accept"**

**Expected**:
- ✅ Video saves to IndexedDB
- ✅ Page returns to instruction screen
- ✅ Progress indicator now shows "Video 2 of 3"
- ✅ Title changes to "Head Movements"
- ✅ Instructions change to read-then-perform mode

### 3. Record Video 2 (Head Movements)

**Click "Start Recording"**

**Expected**:
- ✅ Shows instruction text for 15 seconds
- ✅ Countdown: 3... 2... 1...
- ✅ Recording starts for 45 seconds
- ✅ Prompt stays as "Performing head movements..."
- ✅ Decision screen appears after recording

**Click "Accept"**

**Expected**:
- ✅ Video saves to IndexedDB
- ✅ Progress indicator shows "Video 3 of 3"
- ✅ Title changes to "Eye Movements"
- ✅ Instructions remain read-then-perform mode

### 4. Record Video 3 (Eye Movements)

**Click "Start Recording"**

**Expected**:
- ✅ Shows instruction text for 15 seconds
- ✅ Countdown: 3... 2... 1...
- ✅ Recording starts for 30 seconds
- ✅ Decision screen appears

**Click "Accept"**

**Expected**:
- ✅ Video saves to IndexedDB
- ✅ Browser navigates to `/complete.html`
- ✅ Completion screen shows:
  - Session ID
  - "3 of 3" videos recorded
  - Status: Complete ✓

### 5. Test Retake Flow

**During any video recording:**

**Click "Retake" instead of "Accept"**

**Expected**:
- ✅ Returns to instruction screen for SAME video
- ✅ Progress indicator stays at same number
- ✅ Can record same video again
- ✅ Old chunks deleted from IndexedDB

### 6. Test Session Persistence

**After recording Video 1 and accepting:**

**Refresh the page (F5)**

**Expected**:
- ✅ Page loads with "Video 2 of 3"
- ✅ Status message shows "You have 1 video(s) saved locally"
- ✅ Can continue with Video 2
- ✅ Video 1 is NOT re-recorded

**Complete Video 2 and Video 3, then refresh**

**Expected**:
- ✅ Automatically redirects to `/complete.html`
- ✅ Shows all 3 videos in completion screen

### 7. Test "View Details" on Completion Screen

**Click "View Details" button**

**Expected**:
- ✅ Details section expands
- ✅ Shows all 3 videos with:
  - Video number
  - Prompt ID (facial_expressions, head_movements, eye_movements)
  - File size in MB
  - Duration in seconds
  - Codec used

**Click "Return Home"**

**Expected**:
- ✅ Navigates to `/` (index.html)

## Browser Console Checks

### During Initialization

**Open browser console (F12)**

**Expected logs**:
```
📊 State module loaded
💾 Storage module loaded
📹 Facial Data Collection - Milestone 3
✅ Codec detection
✅ Text overlay system
✅ Accept/Retake flow (NO playback)
✅ Interruption detection
✅ Wake Lock + silent audio fallback
✅ IndexedDB persistence with chunked storage
✅ Multi-video sequence
Ready to record!
🚀 Initializing session...
✅ Loaded 3 video definitions
📍 Resuming at video 1/3: Facial Expressions
📹 Loading video: Facial Expressions (facial_expressions)
✅ Session initialized successfully
```

### After Accepting Video 1

**Expected logs**:
```
✅ Video accepted
💾 Saving metadata: {videoId: "...", promptId: "facial_expressions", ...}
✅ Video saved to IndexedDB
✅ Completed: Facial Expressions (facial_expressions)
➡️ Advanced to video 2/3
➡️ Advancing to next video...
📹 Loading video: Head Movements (head_movements)
```

### After Accepting Video 3

**Expected logs**:
```
✅ Video accepted
💾 Saving metadata: {videoId: "...", promptId: "eye_movements", ...}
✅ Video saved to IndexedDB
✅ Completed: Eye Movements (eye_movements)
➡️ Advanced to video 4/3  (indicates end)
🎉 Session complete!
```

## IndexedDB Inspection

### Check Stored Videos

**Open DevTools → Application → IndexedDB → FacialDataCollection**

**`videos` table should contain**:
- 3 entries after full session
- Each with unique `videoId`
- `promptId` values: "facial_expressions", "head_movements", "eye_movements"
- `status`: "pending_upload"
- File sizes: ~15-25 MB each

**`chunks` table should contain**:
- Multiple entries per video (typically 8-10 chunks per video)
- Each chunk: ~2-5 MB
- Total: ~24-30 chunks for all 3 videos

## Testing Edge Cases

### 1. Start Session, Refresh Immediately

**Expected**:
- ✅ Returns to Video 1 of 3
- ✅ No errors in console

### 2. Complete All 3 Videos, Try to Visit recording.html Again

**Expected**:
- ✅ Automatically redirects to `/complete.html`
- ✅ Cannot start new recordings

### 3. Delete IndexedDB Data, Refresh

**DevTools → Application → IndexedDB → Right-click "FacialDataCollection" → Delete**

**Refresh page**

**Expected**:
- ✅ Session restarts from Video 1 of 3
- ✅ No errors
- ✅ New session ID generated

### 4. Accept Video 1, Close Tab, Open Next Day

**Expected**:
- ✅ PWA should retain data (exempt from 7-day ITP)
- ✅ Resumes at Video 2 of 3
- ✅ Video 1 still in IndexedDB

## Common Issues & Solutions

### Issue: Progress indicator not showing
**Check**:
- Console errors for state.js loading?
- HTML element `#progressIndicator` exists?

### Issue: All videos showing same prompts
**Check**:
- videos.json loaded correctly?
- Console log shows different video names?

### Issue: Stuck on same video after accept
**Check**:
- Console shows "Advanced to video X"?
- SessionState.completeCurrentVideo() called?

### Issue: Completion screen shows 0 videos
**Check**:
- Videos actually saved to IndexedDB?
- Check `videos` table in DevTools

## Success Criteria

- [ ] Can record all 3 videos in sequence without errors
- [ ] Progress indicator updates correctly (1/3 → 2/3 → 3/3)
- [ ] Instruction screen changes for each video
- [ ] Auto-advance works after accept
- [ ] Retake returns to same video
- [ ] Session persists across page refresh
- [ ] Completion screen shows all 3 videos
- [ ] Console shows no errors
- [ ] All 3 videos saved to IndexedDB with correct promptIds

## Next Steps (Milestone 4)

After Milestone 3 is validated:

- [ ] Build Flask backend with upload endpoints
- [ ] Implement resumable chunked upload
- [ ] Background upload while recording next video
- [ ] Upload progress tracking
- [ ] Network retry logic

---

**Last Updated**: 2026-01-27
**Status**: Ready for Testing
