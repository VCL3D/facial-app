# Milestone 1 Testing Guide

## 🎯 What's New

Milestone 1 adds the **actual recording interface** with:

✅ **Text overlay system** - Live prompts change every 5s during recording
✅ **Accept/Retake flow** - NO video playback, immediate decision
✅ **Interruption detection** - Detects calls, FaceTime, tab switching
✅ **Wake Lock** - Prevents screen sleep during 45s recording
✅ **Countdown** - 3-second countdown before recording starts
✅ **Progress bar** - Shows recording progress

## 🚀 Quick Start

```bash
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh
```

Then visit: **http://localhost:8000/recording.html**

## 📋 Test Checklist

### Basic Flow (Desktop)
- [ ] Click "Start Recording"
- [ ] Camera permission requested and granted
- [ ] 3-second countdown shows (3... 2... 1...)
- [ ] Recording starts with red "REC" indicator
- [ ] **Text overlay** changes every 5 seconds:
  - "Show a happy expression 😊"
  - "Show a sad expression 😢"
  - "Show an angry expression 😠"
  - ... (9 prompts total, 45 seconds)
- [ ] Progress bar fills as prompts advance
- [ ] Recording automatically stops after last prompt
- [ ] "Recording Complete!" screen shows
- [ ] **NO video playback** - just Accept/Retake buttons
- [ ] Click "Accept" → Alert confirms success
- [ ] Page reloads (ready for next test)

### Retake Flow
- [ ] Complete a recording
- [ ] Click "Retake" instead of Accept
- [ ] Returns to instruction screen
- [ ] Can record again from start

### Manual Stop
- [ ] Start recording
- [ ] Click "Stop Recording" button mid-way
- [ ] Should stop and show decision screen

## 🔬 iOS-Specific Tests (If you have iPhone)

### Wake Lock Test
- [ ] Start recording on iPhone
- [ ] **Don't touch screen** for 45 seconds
- [ ] Screen should stay on (Wake Lock or silent audio)
- [ ] Recording should complete successfully

### Call Interruption Test (CRITICAL)
- [ ] Start recording
- [ ] Have someone call you (or simulate with timer)
- [ ] **Expected**: Orange warning "Recording paused - Call detected"
- [ ] Dismiss call
- [ ] **Expected**: "Call ended. Recording will restart..." message
- [ ] Recording should resume after 2 seconds

### Tab Backgrounding Test
- [ ] Start recording
- [ ] Switch to another tab or app
- [ ] **Expected**: Warning "Keep this app in foreground!"
- [ ] Switch back to app
- [ ] Warning should disappear

## 📊 Expected Results

### File Size (45 seconds)
- **Firefox (VP8)**: ~2.5 MB
- **Chrome (VP9)**: ~2.2 MB
- **Safari (H.264)**: ~3.0 MB

### Codec Detection
Check browser console (F12) for:
```
✅ Using codec: video/webm; codecs="vp8,opus"
```

### Console Output
Should see:
```
📹 Facial Data Collection - Milestone 1
✅ Codec detection
✅ Text overlay system
✅ Accept/Retake flow (NO playback)
✅ Interruption detection
✅ Wake Lock + silent audio fallback
Ready to record!
```

During recording:
```
✅ Wake Lock acquired (or Silent audio loop started)
📹 Camera: 1280x720 @ 30fps
MediaRecorder created with mimeType: video/webm;codecs=vp8,opus
🎬 Recording started
Chunk received: 612.45 KB
Chunk received: 598.32 KB
...
✅ Recording complete: 45.1s
File size: 2.46 MB
```

## 🐛 Common Issues

### Camera not starting
- Check browser permissions
- Must use http:// or https:// (not file://)
- Try reloading page

### Wake Lock not working
- Normal on desktop (not needed)
- On iOS, it falls back to silent audio (check console)
- Should see: "Silent audio loop started (Wake Lock fallback)"

### Text overlays not visible
- Check if recording started (look for red REC indicator)
- Check browser console for errors
- Try refreshing page

### Recording seems frozen
- Check console for interruption warnings
- Might be call/notification interruption on mobile
- Try dismissing any system notifications

## ✅ Success Criteria

**Milestone 1 is complete if:**
- [x] Full 45s recording works with 9 prompts
- [x] Text overlays change every 5 seconds
- [x] Accept/Retake works (NO playback!)
- [x] Console shows proper codec detection
- [x] Wake Lock acquired (or silent audio fallback)
- [x] File size is reasonable (~2-3 MB)

## 🎯 What's Next (Milestone 2)

Milestone 2 will add:
- **IndexedDB persistence** - Videos survive page refresh
- **Chunked storage** - Write 5MB chunks DURING recording (iOS resilience)
- **Resume capability** - Continue session after browser restart
- **Storage quota check** - Warn if insufficient space

## 📝 Notes

- This is a **single-video test** with 9 prompts (45s total)
- **NO video playback** by design (faster UX, simpler code)
- **NO upload yet** (Milestone 4)
- **NO multi-video sequence yet** (Milestone 3)
- Interruption detection is iOS-critical (industry: 74% completion with this)
- Wake Lock is mandatory for 45-90s videos on mobile

---

**Ready to test?** Run the server and open http://localhost:8000/recording.html! 🚀
