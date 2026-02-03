# Facial Data Collection Web App

Research video recording system for collecting facial data at scale (target: 1500 participants).

## 🎯 Project Overview

- **7-8 videos** per session (~45-90s each)
- **Live text prompts** during recording
- **No video playback** (immediate accept/retake)
- **5-8 minute** average session time
- **PWA architecture** for iOS reliability
- **Self-hosted** Flask backend

## 📁 Project Structure

```
facial-app/
├── frontend/
│   ├── index.html              # Landing page with PWA setup ✅
│   ├── recording.html          # Main recording interface ✅
│   ├── complete.html           # Session completion ✅
│   ├── manifest.json           # PWA manifest ✅
│   ├── service-worker.js       # Service worker for offline support ✅
│   ├── icons/
│   │   ├── icon.svg            # Source icon ✅
│   │   ├── icon-192.png        # Generated ✅
│   │   ├── icon-512.png        # Generated ✅
│   │   └── generate-icons.sh   # Icon generation script ✅
│   ├── css/
│   │   └── styles.css          # Mobile-first responsive styles ✅
│   ├── js/
│   │   ├── dexie.min.js        # IndexedDB library ✅
│   │   ├── recorder.js         # Core recording + text overlays + Wake Lock ✅
│   │   ├── storage.js          # Chunked IndexedDB storage ✅
│   │   ├── state.js            # Session state management ✅
│   │   └── uploader.js         # Resumable upload (TODO - Milestone 4)
│   └── data/
│       └── videos.json         # Video protocol definition ✅
└── backend/
    ├── app.py                  # Flask server (TODO - Milestone 4)
    ├── requirements.txt        # Python dependencies (TODO - Milestone 4)
    └── uploads/                # Upload directory (TODO - Milestone 4)
```

## 🚀 Current Status: Milestone 3 (COMPLETE)

### ✅ What's Built

**Milestone 0: WebRTC Prototype + PWA Setup**
1. **WebRTC Prototype** (`/Desktop/facial-prototype.html`)
   - Camera access with aggressive constraints (1080p@60fps)
   - Codec detection (VP9+Opus → VP8+Opus → H.264 fallback)
   - 5-second test recording
   - Playback validation
   - System info display (resolution, codec, file size)

2. **PWA Foundation**
   - `manifest.json` with proper configuration
   - Service worker with caching strategy
   - PWA detection and installation prompts
   - iOS-specific warnings about 7-day data eviction

3. **Landing Page** (`frontend/index.html`)
   - PWA status indicator
   - Storage quota check
   - Browser detection
   - iOS installation instructions

**Milestone 1: Recording Interface**
4. **Recording Interface** (`frontend/recording.html`)
   - Instruction → Countdown → Recording → Decision screens
   - Text overlay system for live prompts
   - 9 prompts over 45 seconds (5s each)
   - Progress bar showing recording advancement
   - Accept/Retake flow WITHOUT video playback

5. **Core Recording Logic** (`frontend/js/recorder.js`)
   - MediaRecorder with chunked recording (5s intervals)
   - Wake Lock API with silent audio fallback
   - Interruption detection (calls, FaceTime, tab backgrounding)
   - Countdown animation (3-2-1)
   - Prompt sequencing with automatic transitions

6. **Mobile-First Styling** (`frontend/css/styles.css`)
   - iOS safe area support
   - Touch-optimized buttons
   - Backdrop blur overlays
   - Recording indicator with pulse animation
   - Responsive design (portrait & landscape)

**Milestone 2: IndexedDB Persistence**
7. **Storage Module** (`frontend/js/storage.js`)
   - Dexie.js wrapper for IndexedDB
   - Chunked storage pattern (write during recording)
   - Video metadata tracking
   - Resume logic for existing recordings
   - Storage quota checking

8. **Persistent Recording** (Updated `recorder.js`)
   - Chunks saved to IndexedDB immediately (iOS resilience)
   - Video metadata saved on accept
   - Chunks deleted on retake
   - Session progress displayed on page load
   - Videos survive browser restart

**Milestone 3: Multi-Video Sequence**
9. **Video Definitions** (`frontend/data/videos.json`)
   - 3 different video types defined
   - Video 1: Facial expressions (45s, 9 prompts, live mode)
   - Video 2: Head movements (60s, read-then-perform mode)
   - Video 3: Eye movements (45s, read-then-perform mode)
   - Support for both "live_prompts" and "read_then_perform" modes

10. **Session State Management** (`frontend/js/state.js`)
    - Tracks current video index (1/3, 2/3, 3/3)
    - Loads video definitions from videos.json
    - Manages session progress and completion
    - Resumes from correct video after refresh
    - Prevents re-recording completed videos

11. **Multi-Video Flow** (Updated `recorder.js`)
    - Auto-advance to next video after accept
    - Dynamic instruction screen updates per video
    - Progress indicator shows current video number
    - Redirects to completion screen when done
    - Supports retaking current video only

12. **Completion Screen** (`frontend/complete.html`)
    - Session summary with all recorded videos
    - Video details (size, duration, codec)
    - "View Details" expandable section
    - Return to home button

### 📋 Next Steps (Milestone 4)

- [ ] Build Flask backend with upload endpoints
- [ ] Implement resumable chunked upload
- [ ] Background upload while recording continues
- [ ] Upload progress tracking and retry logic
- [ ] Server-side chunk reassembly

## 🛠️ Development Setup

### Prerequisites

- Modern web browser (Chrome, Safari 16.4+, Firefox)
- Python 3.8+ (for backend, Milestone 4)
- Simple HTTP server for testing

### Running Locally

**Easy Way (Recommended):**
```bash
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh
```

Then visit: `http://localhost:8001/recording.html`

**Manual Way:**
```bash
# Serve frontend (choose one method)

# Python
cd facial-app/frontend
python3 -m http.server 8001

# Node.js
npx http-server frontend -p 8001

# PHP
cd facial-app/frontend
php -S localhost:8001
```

Then visit: `http://localhost:8001`

### Testing the Prototype

```bash
# Open the standalone prototype
open /home/akanlis/Desktop/facial-prototype.html

# Or serve it via HTTP for PWA features
cd /home/akanlis/Desktop
python3 -m http.server 8000
# Visit: http://localhost:8000/facial-prototype.html
```

## 📱 iOS Safari Constraints & Mitigations

### Critical Issues (from industry research)

1. **7-Day Data Eviction** → PWA architecture (MANDATORY)
2. **50-100MB Storage Quota** → PWA gets 60% of disk instead
3. **Memory Crashes** → Chunked storage (5MB chunks during recording)
4. **Call Interruptions** → Interruption detection with mute/unmute events
5. **Screen Sleep** → Wake Lock API + silent audio fallback
6. **Network Handoffs** → Resumable upload with localStorage offset tracking

### Expected Completion Rates

- **iOS**: 75-80% (industry baseline: 74-81%)
- **Android**: 85-90% (industry baseline: 88-92%)
- **Overall**: 79-83% weighted average

From 1500 recruits → ~1,185-1,245 complete sessions → **8,295-9,960 videos**

## 🧪 Testing Checklist

### iOS-Specific Tests (CRITICAL)
- [ ] iPhone 12+ (Safari 18+ with VP9 support)
- [ ] iPhone 8-11 (older Safari with H.264 only)
- [ ] Low device storage (<1GB free)
- [ ] PWA vs regular Safari tab
- [ ] Incoming phone call during recording
- [ ] FaceTime call interruption
- [ ] Notification banner interruption
- [ ] Screen auto-lock (Wake Lock test)
- [ ] Network handoff (WiFi ↔ Cellular)
- [ ] 7-day ITP verification (PWA exemption)

### Android & General Tests
- [ ] Android Chrome (VP9 codec)
- [ ] Budget Android (<$200, low memory)
- [ ] Tablet (iPad/Android - text overlay positioning)
- [ ] Slow 3G network simulation
- [ ] Page reload mid-session
- [ ] Browser crash recovery
- [ ] Full storage scenario

## 📊 Key Metrics to Track

### Performance
- Actual video quality (resolution, bitrate, file size)
- Session duration (with/without retakes)
- Upload speed on typical network
- Storage quota usage per video

### User Behavior
- Completion rate (% finishing all 7-8 videos)
- Drop-off points (which video loses users)
- Retake rate per video
- Time to accept/retake decision

### Quality
- Codec distribution (VP9 vs H.264)
- Device distribution (iOS vs Android)
- Network type during upload
- Upload failure rate

## 🔧 Technical Details

### WebRTC Constraints
```javascript
{
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 60, min: 30 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
}
```

### MediaRecorder Configuration
```javascript
{
  mimeType: 'video/webm; codecs=vp9', // or h264 fallback
  videoBitsPerSecond: 4000000,  // 4 Mbps
  audioBitsPerSecond: 128000    // 128 kbps
}
```

### Expected File Sizes (at 720p@30fps, 4 Mbps)
- 45s video: ~23 MB
- 60s video: ~30 MB
- 90s video: ~45 MB
- **Total session**: 200-250 MB (7-8 videos)

## 📚 Resources

- [Plan Document](/.claude/plans/melodic-gathering-diffie.md) - Full implementation plan
- [Technical Spec](/Desktop/facial-data-collection-plan.md) - Original requirements
- [iOS Safari Constraints](/Downloads/iOS Safari Web Video Recording Challenges.pdf) - Industry research

## 🎓 Development Philosophy

**Vibe Coding Principles:**
- Build small, test frequently
- Validate on real devices early (Day 1!)
- Watch users without helping them
- Measure everything that matters
- Accept imperfect code early (refactor later)

## 📅 Timeline

- **Week 1**: Rapid prototyping + iOS foundations (Milestones 0-5)
- **Week 2**: Scale & polish (Milestones 6-7)
- **Week 3**: Production ready (Milestones 8-9)
- **Week 4**: 1500 participant launch

## 🐛 Known Issues / TODOs

- [x] Icons need to be generated as PNG (currently SVG only) - ✅ DONE
- [x] Service worker paths assume root deployment (may need adjustment) - ✅ DONE
- [x] Recording flow with text overlays - ✅ DONE (Milestone 1)
- [x] IndexedDB persistence - ✅ DONE (Milestone 2)
- [x] Multi-video sequence - ✅ DONE (Milestone 3)
- [ ] Backend server with upload endpoints (Milestone 4 next)
- [ ] Resumable chunked upload (Milestone 4)
- [ ] Background upload while recording (Milestone 5)

## 📝 License & Usage

Research project for facial data collection. Not for commercial use.

---

**Current Milestone**: 3 (Multi-Video Sequence) ✅
**Next Milestone**: 4 (Backend + Upload System)
**Last Updated**: 2026-01-27
