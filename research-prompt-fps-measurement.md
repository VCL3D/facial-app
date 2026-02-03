# Gemini Deep Research Prompt: Browser-Based Video FPS Measurement

## Research Question

What are the most reliable and performant methods for measuring the actual frame rate (FPS) of recorded video blobs in a web browser, specifically for validating MediaRecorder encoder configurations?

## Context

We're building a facial data collection web app that tests multiple MediaRecorder encoder configurations (VP8 24 Mbps, VP8 12 Mbps, browser default) to find the best settings for each device. We need to **measure the actual FPS** of test recordings to detect frame drops and encoder instability.

**Current Problem:**
- Our "FPS measurement" is a heuristic based on chunk count (not real frame counting)
- We're getting inconsistent results: Config 1 shows 30fps, Configs 2 & 3 show 24fps
- The heuristic just returns `cameraFPS * 0.8` if chunk count is low - this isn't measuring actual frames
- We need to know if the encoder is ACTUALLY dropping frames or maintaining 30fps

**Our Use Case:**
```javascript
// After recording 3-second test video
const testChunks = [blob1, blob2, blob3]; // WebM/VP8 video blobs
const videoBlob = new Blob(testChunks, { type: 'video/webm; codecs=vp8' });

// Need function like this:
const actualFPS = await measureRealVideoFPS(videoBlob);
// Should return: 30.0 (if all frames present), 24.5 (if frames dropped), etc.
```

**Technical Constraints:**
- Must work in browser (Chrome, Safari, Firefox)
- Should complete in 3-5 seconds maximum (running 3 tests in sequence)
- Video format: WebM/VP9, WebM/VP8, or MP4/H.264
- Test recordings are 3 seconds long, ~200-500KB each
- Camera reports 30fps via `MediaStreamTrack.getSettings().frameRate`

## Research Topics

### 1. `requestVideoFrameCallback()` API (Chrome 83+, Safari 15.4+)

**Questions:**
- How reliable is this API for counting frames in playback?
- Can it accurately measure FPS from a video blob?
- Are there known issues with:
  - Very short videos (3 seconds)?
  - WebM vs MP4 codec differences?
  - Variable frame rate (VFR) vs constant frame rate (CFR)?
- Does it work during headless/background playback?
- Performance impact on 3-second measurement?

**Example Code (if this is the right approach):**
```javascript
async function measureVideoFPS(blob) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    video.muted = true;

    let frameCount = 0;
    const metadata = await new Promise(resolve => {
        video.onloadedmetadata = () => resolve({ duration: video.duration });
    });

    video.requestVideoFrameCallback(function countFrame() {
        frameCount++;
        if (!video.ended) {
            video.requestVideoFrameCallback(countFrame);
        }
    });

    video.play();
    await new Promise(resolve => video.onended = resolve);

    return frameCount / metadata.duration;
}
```

**Is this approach correct? What are the gotchas?**

### 2. WebCodecs API (Chrome 94+, not Safari yet)

**Questions:**
- Can `VideoDecoder` count frames more accurately than playback?
- Does it work with WebM/VP8 and H.264?
- Performance vs `requestVideoFrameCallback()`?
- Is it overkill for simple FPS measurement?
- Browser support limitations?

### 3. Canvas-Based Frame Extraction

**Questions:**
- Can we use `video.requestAnimationFrame()` + canvas `getImageData()` to detect unique frames?
- Would frame hashing detect dropped frames?
- Too slow for production use (3 tests × 3 seconds = 9 seconds max budget)?

### 4. MediaRecorder Metadata Analysis

**Questions:**
- Do WebM container headers include frame timing metadata?
- Can we parse the blob directly without playback?
- Libraries: `ebml-js`, `ts-ebml`, `matroska` - are they suitable?
- Would this be faster than playback-based measurement?

### 5. Production Examples

**Questions:**
- How do video analysis tools (Loom, Zoom, Google Meet) measure recording FPS?
- Are there open-source implementations we can reference?
- Do browser DevTools use specific APIs for FPS measurement in the Performance panel?

### 6. Edge Cases & Accuracy

**Questions:**
- Variable Frame Rate (VFR) encodings: Do MediaRecorder outputs use VFR or CFR?
- First/last frame timing: Should we exclude them from FPS calculation?
- Audio-video sync: Does audio track affect frame timing measurement?
- Rounding errors: If camera says "30fps" but encoder produces 29.97fps (NTSC), is that a failure?

## Expected Deliverables

Please provide:

1. **Recommended approach** with justification (speed, accuracy, browser support)
2. **Complete working code example** that we can integrate into our test page
3. **Known limitations and browser compatibility matrix**
4. **Performance benchmarks** (if available from other projects)
5. **Fallback strategies** for browsers without `requestVideoFrameCallback()` (Safari <15.4, Firefox)
6. **Validation approach**: How to verify the FPS measurement is correct?

## Success Criteria

The ideal solution should:
- **Accurately count actual frames** in the recorded video (not estimate based on chunks)
- **Complete in <2 seconds** per 3-second test video
- **Work on Chrome 66+, Safari 13+, Firefox 60+** (our target browsers)
- **Distinguish between**:
  - True 30fps (all frames present)
  - Frame drops (e.g., 24fps actual when 30fps requested)
  - Encoder lag (frames delayed but not dropped)
- **Handle both WebM and MP4** container formats
- **Return decimal precision** (e.g., 29.97 vs 30.0 vs 24.5)

## Current (Wrong) Implementation

For reference, here's our current heuristic that we need to replace:

```javascript
// CURRENT - WRONG - Just estimates based on chunk count
async function measureVideoFPS(chunks, mimeType, recordingDuration, cameraFPS) {
    if (chunks.length === 0) return 0;

    // Expected ~30 chunks for 3s recording with 100ms chunk interval
    const expectedChunks = 30;
    const chunkRatio = chunks.length / expectedChunks;

    if (chunkRatio < 0.5) {
        return cameraFPS * 0.8; // Returns 24fps for 30fps camera
    }

    return cameraFPS; // Just returns camera setting, not actual frames!
}
```

**Why this is wrong:** Chunk count has nothing to do with frame count. We could get 30 chunks but only 24 frames per second if encoder is dropping frames.

## Additional Context

**Why we need this:**
- We discovered VP8 at 12 Mbps gives stable 30fps, but H.264 at 12 Mbps only achieves 24fps on the same device
- Without real frame counting, we can't reliably detect these encoder issues
- We want to automatically select the config with highest stable FPS

**Target devices:**
- Desktop: Chrome/Edge/Firefox on Windows/Mac/Linux
- Mobile: Chrome on Android, Safari on iOS
- Budget phones with MediaTek/Snapdragon 4xx chips (known encoder issues)

---

**Expected research depth:** Please prioritize battle-tested production approaches over experimental APIs. We need something that works TODAY across our target browsers, even if it's not the newest/fanciest API.
