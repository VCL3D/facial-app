# Comprehensive Testing Checklist - Facial Data Collection App

## Test Environment Setup
- [ ] Local HTTPS: https://localhost
- [ ] Network HTTPS: https://195.251.117.230
- [ ] Backend running on port 5001
- [ ] Nginx reverse proxy configured
- [ ] Browser DevTools open for console monitoring

## 1. Browser Compatibility Tests

### Desktop Browsers
- [ ] Chrome/Chromium (latest)
  - [ ] Camera access granted
  - [ ] 1080p recording achievable
  - [ ] WebM/VP9 codec detected
  - [ ] Upload completes successfully
  - [ ] IndexedDB persists after refresh

- [ ] Firefox (latest)
  - [ ] Camera access granted
  - [ ] Recording quality check
  - [ ] Codec detection
  - [ ] Upload works
  - [ ] Storage persists

- [ ] Safari (macOS, if available)
  - [ ] Camera access granted
  - [ ] Recording quality
  - [ ] H.264 codec fallback
  - [ ] Upload works
  - [ ] Storage persists

### Mobile Browsers (CRITICAL)

#### iOS Safari (iPhone)
- [ ] **PWA Installation Test**
  - [ ] Add to Home Screen prompt appears
  - [ ] App runs in standalone mode
  - [ ] Storage quota check shows adequate space (check `navigator.storage.estimate()`)

- [ ] **Camera Access**
  - [ ] HTTPS access allows camera permission
  - [ ] Front camera activates
  - [ ] Preview shows correctly
  - [ ] No rotation issues

- [ ] **Recording Quality**
  - [ ] Check actual resolution achieved (likely 720p on older devices)
  - [ ] Check file size per video (~20-30MB for 45s)
  - [ ] Check codec (VP9 on iOS 18.4+, H.264 on older)

- [ ] **Interruption Handling**
  - [ ] Incoming phone call during recording (should pause gracefully)
  - [ ] FaceTime call during recording
  - [ ] Notification banner appears during recording
  - [ ] Switch to another app mid-recording (tab backgrounding)
  - [ ] Screen auto-lock during recording (Wake Lock should prevent)

- [ ] **Storage Tests**
  - [ ] Record 3 videos successfully
  - [ ] Check IndexedDB size (should be ~60-90MB)
  - [ ] Refresh browser - data persists
  - [ ] Force close Safari - reopen, data persists
  - [ ] Test low storage scenario (<100MB free)

- [ ] **Upload Tests**
  - [ ] Upload works over WiFi
  - [ ] Upload works over cellular
  - [ ] Network handoff (WiFi → Cellular mid-upload)
  - [ ] Upload resumes after page refresh
  - [ ] Upload progress shows correctly

- [ ] **7-Day ITP Test** (if PWA)
  - [ ] Set device date forward 8 days
  - [ ] Open app - data should still be there (PWA exemption)

#### Android Chrome
- [ ] **Camera Access**
  - [ ] HTTPS allows camera
  - [ ] Front camera works
  - [ ] Preview correct

- [ ] **Recording Quality**
  - [ ] Check resolution (1080p likely)
  - [ ] Check file size
  - [ ] Check codec (VP9 likely)

- [ ] **Storage Tests**
  - [ ] Record 3 videos
  - [ ] Data persists after refresh
  - [ ] Data persists after force close

- [ ] **Upload Tests**
  - [ ] WiFi upload
  - [ ] Cellular upload
  - [ ] Network handoff

#### Android Firefox
- [ ] Basic camera and recording test
- [ ] Upload test

## 2. Network Condition Tests

### Simulated Network Conditions (Chrome DevTools)

- [ ] **Fast 3G**
  - [ ] Recording works smoothly
  - [ ] Upload completes (measure time)
  - [ ] Chunked upload with progress

- [ ] **Slow 3G**
  - [ ] Recording still works
  - [ ] Upload takes longer but completes
  - [ ] Retry logic works on timeout

- [ ] **Offline → Online**
  - [ ] Record video offline
  - [ ] Upload fails gracefully
  - [ ] Go online
  - [ ] Upload resumes automatically

- [ ] **Connection Drop Mid-Upload**
  - [ ] Start upload
  - [ ] Disconnect network mid-way
  - [ ] Check retry behavior (exponential backoff)
  - [ ] Reconnect network
  - [ ] Upload resumes from last chunk

## 3. Video Quality Tests

### Recording Parameters
- [ ] **Resolution Check**
  - [ ] Log actual resolution from `videoTrack.getSettings()`
  - [ ] Desktop: Should be 1920x1080 or close
  - [ ] Mobile: Varies (720p-1080p)

- [ ] **Frame Rate Check**
  - [ ] Log actual frame rate
  - [ ] Desktop: Should be 60fps or 30fps
  - [ ] Mobile: Likely 30fps

- [ ] **Bitrate Check**
  - [ ] Check file size vs duration
  - [ ] ~20-40MB for 45s video is good
  - [ ] Too small (<10MB) = too compressed
  - [ ] Too large (>100MB) = inefficient

- [ ] **Codec Check**
  - [ ] Log codec from `mediaRecorder.mimeType`
  - [ ] Prefer: VP9
  - [ ] Fallback: VP8 or H.264

### Visual Quality
- [ ] **Lighting Conditions**
  - [ ] Well-lit room (should be clear)
  - [ ] Low light (should still be usable)
  - [ ] Backlit (should see face, not silhouette)

- [ ] **Focus & Clarity**
  - [ ] Face is in focus
  - [ ] Facial features clearly visible
  - [ ] No excessive blur

## 4. Storage Tests

### IndexedDB Limits
- [ ] **Quota Check**
  - [ ] Log available storage: `navigator.storage.estimate()`
  - [ ] Desktop: Usually GB+ available
  - [ ] Mobile: Varies widely (50MB-500MB)

- [ ] **Chunked Storage**
  - [ ] Verify chunks write during recording (not at end)
  - [ ] Check memory usage in DevTools (should stay low)
  - [ ] Large video (90s) should not crash browser

- [ ] **Corruption Prevention**
  - [ ] Try recording 4th video when only 3 expected (should block)
  - [ ] Try recording duplicate video ID (should block)
  - [ ] Run `FacialStorage.validateSessionHealth()` after 3 videos

### Persistence Tests
- [ ] **Browser Refresh**
  - [ ] Record 2 videos
  - [ ] Refresh page
  - [ ] Should show "2 of 3 complete"
  - [ ] Continue to 3rd video

- [ ] **Browser Close/Reopen**
  - [ ] Record 2 videos
  - [ ] Close browser completely
  - [ ] Reopen and navigate to app
  - [ ] Data should persist

- [ ] **Crash Recovery**
  - [ ] Record 1 video
  - [ ] Force crash browser (kill process)
  - [ ] Reopen
  - [ ] Video 1 should be saved

## 5. Upload Reliability Tests

### Chunked Upload
- [ ] **Single Video Upload**
  - [ ] Record 1 video (~25MB)
  - [ ] Watch upload progress (0% → 100%)
  - [ ] Check server: file should exist and be playable

- [ ] **Multiple Video Upload**
  - [ ] Record 3 videos in sequence
  - [ ] All 3 should upload
  - [ ] Check server: all 3 files exist

- [ ] **Upload Retry Logic**
  - [ ] Disconnect network during chunk upload
  - [ ] Should retry 3 times with exponential backoff
  - [ ] Reconnect network
  - [ ] Upload should complete

### Failure Scenarios
- [ ] **Server Down**
  - [ ] Stop backend (`killall python`)
  - [ ] Try to record and upload
  - [ ] Should show error message
  - [ ] Restart backend
  - [ ] Upload should retry and succeed

- [ ] **Network Timeout**
  - [ ] Simulate high latency
  - [ ] Upload should retry on timeout

- [ ] **Partial Upload**
  - [ ] Interrupt upload at 50%
  - [ ] Refresh page
  - [ ] Upload should resume from chunk offset

## 6. User Experience Tests

### Flow Tests
- [ ] **Complete 3-Video Session**
  - [ ] Start from landing page
  - [ ] Read instructions
  - [ ] Complete Video 1 (Facial Expressions)
  - [ ] Complete Video 2 (Head Movements)
  - [ ] Complete Video 3 (Eye Movements)
  - [ ] See completion screen
  - [ ] Check server: 3 videos uploaded

- [ ] **Retake Flow**
  - [ ] Record video
  - [ ] Click "Retake"
  - [ ] Should return to countdown
  - [ ] Record again
  - [ ] Accept
  - [ ] Only latest recording should be saved

- [ ] **Multiple Retakes**
  - [ ] Retake same video 3 times
  - [ ] Final accept should upload only once
  - [ ] No duplicate videos in storage

### UI/UX
- [ ] **Text Overlay Readability**
  - [ ] During "live prompts" mode, text is readable
  - [ ] Text doesn't block face view too much
  - [ ] Timing feels natural (not too fast/slow)

- [ ] **Instructions Clear**
  - [ ] "Read then perform" instructions are understandable
  - [ ] Read duration (15s) is enough time

- [ ] **Progress Indicator**
  - [ ] Shows "Video 1 of 3" correctly
  - [ ] Updates after each completion

- [ ] **Upload Modal**
  - [ ] Appears during upload
  - [ ] Shows progress bar (0-100%)
  - [ ] Shows file size
  - [ ] Disappears after completion

## 7. Edge Cases & Stress Tests

### Session Corruption
- [ ] **Manual Corruption Test**
  - [ ] Open DevTools console
  - [ ] Try: `FacialStorage.saveVideoMetadata({videoId: 'duplicate', promptId: 'facial_expressions', ...})`
  - [ ] Should block duplicate save

- [ ] **Concurrent Recording Prevention**
  - [ ] Try opening two tabs
  - [ ] Both try to record
  - [ ] Should not corrupt state

### Memory Stress
- [ ] **Budget Device Test**
  - [ ] Test on device with <2GB RAM
  - [ ] Record all 3 videos
  - [ ] Should not crash

- [ ] **Large Video Test**
  - [ ] Record longest video (90s speech)
  - [ ] Check memory usage
  - [ ] Should not exceed 200MB

### Storage Stress
- [ ] **Low Storage Scenario**
  - [ ] Fill device to <100MB free
  - [ ] Try to start session
  - [ ] Should warn about low storage

## 8. Backend Tests

### API Endpoints
- [ ] **POST /api/session/create**
  - [ ] Returns session_id
  - [ ] Creates directory on server
  - [ ] session.json file created

- [ ] **POST /api/upload/chunk**
  - [ ] Accepts 1MB chunks
  - [ ] Stores chunks in temp directory
  - [ ] Returns success

- [ ] **POST /api/upload/metadata**
  - [ ] Saves metadata.json
  - [ ] Reassembles video from chunks
  - [ ] Final video is playable

- [ ] **GET /api/session/{id}**
  - [ ] Returns session info
  - [ ] Lists uploaded videos

### File Integrity
- [ ] **Video Playback**
  - [ ] Download uploaded video from server
  - [ ] Play in VLC or browser
  - [ ] Video plays without corruption
  - [ ] Audio syncs with video

- [ ] **Metadata Accuracy**
  - [ ] Check metadata.json for each video
  - [ ] Resolution matches actual
  - [ ] Duration matches actual
  - [ ] Codec matches actual

## 9. Security Tests

### HTTPS
- [ ] **Certificate Validation**
  - [ ] Browser shows warning for self-signed cert (expected)
  - [ ] After "Proceed", site loads
  - [ ] Camera access works over HTTPS

- [ ] **Mixed Content**
  - [ ] No mixed content warnings in console
  - [ ] All resources load over HTTPS
  - [ ] Backend API calls go through nginx reverse proxy

### Data Privacy
- [ ] **No Console Errors**
  - [ ] No sensitive data logged to console
  - [ ] Session IDs are UUIDs (not guessable)

## 10. Performance Benchmarks

### Timing Metrics
- [ ] **Session Duration**
  - [ ] Complete 3-video session
  - [ ] Measure total time (target: 3-5 minutes)

- [ ] **Upload Speed**
  - [ ] Measure time for 25MB video upload
  - [ ] Fast WiFi: <10 seconds
  - [ ] Slow 3G: <60 seconds

- [ ] **Recording Overhead**
  - [ ] Check CPU usage during recording
  - [ ] Should be <50% on modern device

### Resource Usage
- [ ] **Memory Usage**
  - [ ] Monitor in DevTools
  - [ ] During recording: <150MB
  - [ ] After 3 videos stored: <100MB
  - [ ] Should not continuously increase (no leaks)

- [ ] **Storage Usage**
  - [ ] Check IndexedDB size after 3 videos
  - [ ] Should be 60-120MB total

## 11. Accessibility Tests

### Keyboard Navigation
- [ ] **Tab Navigation**
  - [ ] Can tab through buttons
  - [ ] Enter/Space activates buttons

### Screen Reader (if applicable)
- [ ] **Button Labels**
  - [ ] Buttons have clear labels
  - [ ] Status messages are announced

## Critical Issues Log

### Blockers (Must Fix Before Launch)
- [ ] Camera doesn't work on [device/browser]
- [ ] Upload fails consistently on [condition]
- [ ] Storage corruption after [scenario]
- [ ] App crashes on [device/browser]

### High Priority (Should Fix)
- [ ] Poor video quality on [device]
- [ ] Slow upload on [network]
- [ ] Confusing UX at [step]

### Low Priority (Nice to Have)
- [ ] Minor UI glitch
- [ ] Edge case handling

## Testing Notes

**Device Inventory:**
- Desktop: [Your computer specs]
- Mobile 1: [iPhone model, iOS version]
- Mobile 2: [Android model, Android version]

**Network Conditions Tested:**
- WiFi: [Speed test results]
- Cellular: [4G/5G]
- Throttled: [3G simulation]

**Success Criteria:**
- [ ] 90%+ of tests pass
- [ ] No critical blockers
- [ ] All priority devices work
- [ ] Upload success rate >95%
