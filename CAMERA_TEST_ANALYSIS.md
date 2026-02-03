# Camera Test Tool - Technical Analysis

## Overview
The test-camera.html tool provides comprehensive quality assessment of video streams through:
1. **AI-based quality checking** (via Triton backend)
2. **Traditional image quality metrics** (client-side)
3. **Camera capabilities detection**

---

## 1. AI Quality Integration

### Architecture
```
Frontend (test-camera.html)
    ↓ (capture frame as base64 JPEG)
    ↓ POST /api/quality/check
Backend (app.py)
    ↓ (preprocess to 352x352, ImageNet normalization)
Triton Inference Server (localhost:8003)
    ↓ (Efficient-FIQA model inference)
    ↓ (returns quality score 0-1)
Backend
    ↓ (classify as poor/acceptable/good)
Frontend
    ↓ (display results + update buffer)
```

### Implementation Details

**Frontend Capture** (line 472-486):
- Draws current video frame to canvas
- Exports as JPEG base64 (quality 0.95)
- Full resolution capture (no downsampling before send)

**Backend Processing** (app.py lines 73-112):
- Resizes to 352x352 (Efficient-FIQA requirement)
- Applies ImageNet normalization (mean/std)
- Converts HWC → CHW format
- Adds batch dimension

**Triton Inference**:
- Model: `efficient_fiqa` version 1
- Input: 352x352x3 FP32 tensor
- Output: Single quality score (0-1 range)

**Quality Classification**:
- **Good**: score ≥ 0.7
- **Acceptable**: score ≥ 0.5 and < 0.7
- **Poor**: score < 0.5

**Checking Loop** (line 610-624):
- Runs every 2 seconds (`AI_CHECK_INTERVAL`)
- Maintains buffer of last 15 checks (`AI_BUFFER_SIZE`)
- Enables recording only when all 15 consecutive checks pass threshold (≥ 0.5)
- Updates circular quality indicator in real-time

---

## 2. Traditional Quality Measurements

All measurements run every 2 seconds on 640x480 downsampled canvas for performance.

### 2.1 Blur Score (Laplacian Variance)
**Function**: `analyzeBlur()` (lines 839-876)

**Algorithm**:
- Applies 3x3 Laplacian kernel (second derivative)
- Calculates variance of Laplacian values
- Higher variance = sharper edges = less blur

**Thresholds**:
- ✅ **Good**: > 100 (sharp)
- ⚠️ **Acceptable**: 50-100 (moderate blur)
- ❌ **Poor**: < 50 (very blurry)

**Why it works**: Blur reduces high-frequency components (edges), so Laplacian response is weaker.

---

### 2.2 Noise Level
**Function**: `estimateNoise()` (lines 885-928)

**Algorithm**:
- Measures pixel-to-pixel differences (horizontal & vertical)
- Filters out large differences (edges) by keeping only diff < 50
- Calculates standard deviation of small differences
- Scales to 0-100 range

**Thresholds**:
- ✅ **Good**: < 30 (clean)
- ⚠️ **Acceptable**: 30-60 (moderate noise)
- ❌ **Poor**: > 60 (very noisy)

**Why it works**: Noise creates random variation between neighboring pixels, while real edges create consistent large differences.

---

### 2.3 Overexposure (Face Region)
**Function**: `detectOverexposure()` (lines 937-?)

**Algorithm**:
- Focuses on center 60% of frame (where face is expected)
- Counts pixels with luminance > 240 (out of 255)
- Returns percentage of overexposed pixels

**Thresholds**:
- ✅ **Good**: < 5% (minimal overexposure)
- ⚠️ **Acceptable**: 5-15% (some highlights)
- ❌ **Poor**: > 15% (face blown out)

**Critical for facial data**: Background overexposure (windows, lights) is acceptable; face overexposure is not.

---

### 2.4 Brightness
**Function**: `measureBrightness()`

**Algorithm**:
- Calculates average luminance across entire frame
- Luminance = 0.299*R + 0.587*G + 0.114*B

**Thresholds**:
- ✅ **Good**: 80-180 (optimal range for facial detail)
- ⚠️ **Acceptable**: 60-80 or 180-200 (suboptimal)
- ❌ **Poor**: < 60 (too dark) or > 200 (too bright)

---

### 2.5 Contrast
**Function**: `measureContrast()`

**Algorithm**:
- Calculates standard deviation of luminance values
- Higher std dev = more tonal variation = better contrast

**Thresholds**:
- ✅ **Good**: > 40 (strong contrast)
- ⚠️ **Acceptable**: 25-40 (moderate contrast)
- ❌ **Poor**: < 25 (flat/washed out)

---

### 2.6 Color Balance
**Function**: `analyzeColorBalance()`

**Algorithm**:
- Calculates average R, G, B across frame
- Detects color casts (warm/cool/neutral)
- Scores based on deviation from neutral gray

**Thresholds**:
- ✅ **Good**: > 80 (neutral balance)
- ⚠️ **Acceptable**: 60-80 (slight cast)
- ❌ **Poor**: < 60 (strong color cast)

---

### 2.7 Stability
**Function**: `measureStability()`

**Algorithm**:
- Tracks variance of blur/noise/brightness over last N frames
- Low variance = stable conditions
- High variance = shaky/inconsistent

**Thresholds**:
- ✅ **Good**: > 75 (very stable)
- ⚠️ **Acceptable**: 50-75 (moderate movement)
- ❌ **Poor**: < 50 (shaky/unstable)

---

## 3. Proposed: Encoding Capability Test

### Goal
Determine which resolutions and frame rates the device can actually encode in real-time at 12 Mbps bitrate.

### Why This Matters
- **Current Issue**: App requests 8192x8192@60fps, but many devices can only encode 1920x1080@30fps
- **Problem**: Encoding falls behind → frame drops → stuttering preview
- **Need**: Test what the device can ACTUALLY handle before recording

---

### Implementation Plan

#### Test Matrix
```javascript
const TEST_CONFIGS = [
    { width: 7680, height: 4320, fps: 60, bitrate: 12000000 }, // 8K
    { width: 3840, height: 2160, fps: 60, bitrate: 12000000 }, // 4K
    { width: 1920, height: 1080, fps: 60, bitrate: 12000000 }, // 1080p
    { width: 1920, height: 1080, fps: 30, bitrate: 12000000 }, // 1080p@30
    { width: 1280, height: 720,  fps: 60, bitrate: 12000000 }, // 720p
];
```

#### For Each Configuration:
1. **Request Stream**:
   ```javascript
   const stream = await navigator.mediaDevices.getUserMedia({
       video: {
           width: { ideal: config.width },
           height: { ideal: config.height },
           frameRate: { ideal: config.fps },
           facingMode: { exact: 'user' }
       },
       audio: false
   });
   ```

2. **Check Actual vs Requested**:
   ```javascript
   const track = stream.getVideoTracks()[0];
   const settings = track.getSettings();
   const actualResolution = `${settings.width}x${settings.height}`;
   const actualFPS = settings.frameRate;
   ```

3. **Test Encoding**:
   ```javascript
   const recorder = new MediaRecorder(stream, {
       mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
       videoBitsPerSecond: config.bitrate
   });

   let chunks = [];
   recorder.ondataavailable = (e) => chunks.push(e.data);

   // Record for 3 seconds
   recorder.start(1000); // 1s chunks
   await sleep(3000);
   recorder.stop();
   ```

4. **Measure Performance**:
   ```javascript
   const metrics = {
       requestedResolution: `${config.width}x${config.height}`,
       actualResolution: actualResolution,
       requestedFPS: config.fps,
       actualFPS: actualFPS,
       chunksReceived: chunks.length,
       expectedChunks: 3,
       droppedFrames: (3 - chunks.length),
       totalSize: chunks.reduce((sum, c) => sum + c.size, 0),
       avgBitrate: (totalSize * 8) / 3, // bits per second
       canEncode: (chunks.length >= 2), // At least 2/3 chunks succeeded
       cpuUsageEstimate: measureCPUDuringEncoding() // If available
   };
   ```

5. **Display Results**:
   ```
   📊 Encoding Capability Test Results:

   ✅ 1920x1080@60fps  →  Achieved 1920x1080@60fps  (Excellent)
   ✅ 1920x1080@30fps  →  Achieved 1920x1080@30fps  (Excellent)
   ⚠️  3840x2160@60fps  →  Achieved 3840x2160@45fps  (Dropped frames)
   ❌ 7680x4320@60fps  →  Failed to initialize       (Not supported)

   Recommendation: Use 1920x1080@60fps for this device
   ```

---

### Integration Points

#### Option A: Separate Test Button
Add button to test-camera.html:
```html
<button onclick="runEncodingCapabilityTest()">
    🎬 Test Encoding Capabilities
</button>
```

#### Option B: Automatic on Page Load
Run test automatically when camera starts, show progress:
```
Testing encoding capabilities...
[████████░░] 80% (4/5 configs tested)
```

#### Option C: One-time Setup
Run once per device, save results to localStorage:
```javascript
const capabilities = JSON.parse(localStorage.getItem('encodingCapabilities'));
if (!capabilities || capabilities.timestamp < Date.now() - 7*24*60*60*1000) {
    // Re-test if no data or data > 7 days old
    await runEncodingCapabilityTest();
}
```

---

### Additional Metrics to Track

1. **Memory Usage**:
   ```javascript
   if (performance.memory) {
       const memoryMB = performance.memory.usedJSHeapSize / (1024*1024);
   }
   ```

2. **Frame Timing**:
   ```javascript
   recorder.ondataavailable = (e) => {
       const timestamp = e.timecode;
       const expectedTime = chunks.length * 1000; // 1s chunks
       const drift = timestamp - expectedTime;
       if (drift > 100) console.warn('Encoding falling behind');
   };
   ```

3. **Preview FPS**:
   ```javascript
   let lastFrameTime = 0;
   let frameCount = 0;

   function measurePreviewFPS() {
       const now = performance.now();
       frameCount++;
       if (now - lastFrameTime >= 1000) {
           const fps = frameCount;
           console.log(`Preview FPS: ${fps}`);
           frameCount = 0;
           lastFrameTime = now;
       }
       requestAnimationFrame(measurePreviewFPS);
   }
   ```

---

## Summary

### Current State
- ✅ AI quality checking via Triton is working
- ✅ Traditional metrics provide good real-time feedback
- ✅ Camera capabilities are detected

### Gaps
- ❌ No test for encoding performance at different resolutions
- ❌ No way to know if device can handle requested bitrate
- ❌ No feedback if encoding is falling behind during recording

### Recommendation
**Add Encoding Capability Test** with the following priority:
1. **Essential**: Test at 3-4 key resolutions (1080p, 4K, 8K) at 30fps and 60fps
2. **Important**: Measure actual bitrate achieved vs requested
3. **Nice-to-have**: Track CPU usage and memory during encoding

This would prevent users from starting recordings with settings their device cannot handle, reducing frustration and failed recordings.
