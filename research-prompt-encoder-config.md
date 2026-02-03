# Gemini Deep Research Prompt: MediaRecorder Encoder Configuration Best Practices

## Research Question

What are the current industry best practices and robust solutions for handling MediaRecorder encoder configuration compatibility across diverse devices (especially budget Android phones) in web-based video recording applications?

## Context

We're building a Progressive Web App (PWA) for facial video data collection targeting 1500 participants with diverse devices. We've encountered a critical issue where:

**The Problem:**
- Budget Android devices reject high bitrate configurations (12 Mbps video, 320 kbps audio) with `EncodingError: "The given encoder configuration is not supported by the encoder"`
- The error only appears when `MediaRecorder.start()` is called, NOT during constructor instantiation
- This causes recording failures on ~15-20% of devices (primarily budget Android phones)

**Our Current Solution:**
- Progressive fallback through 3 configurations:
  1. Config 1: 12 Mbps video + 320 kbps audio (full quality)
  2. Config 2: No bitrate hints, browser-managed with codec specified
  3. Config 3: No codec, no bitrate (maximum compatibility)
- Using `navigator.mediaCapabilities.encodingInfo()` API to check encoder support BEFORE creating MediaRecorder

**Our Constraints:**
- Must work on iOS Safari 13+ and Android Chrome 66+
- Need consistent video quality for ML training (ideally 720p+, 30fps)
- Recording duration: 45-90 seconds per video
- Target resolution: 1080p-4K on capable devices, 720p minimum
- Must handle H.264 (iOS/older Android) and WebM/VP9 (newer Android/Safari 18.4+)

## Research Topics

### 1. MediaCapabilities API Effectiveness
- How reliable is `navigator.mediaCapabilities.encodingInfo()` for predicting encoder failures?
- Are there known cases where it reports `supported: true` but encoding still fails?
- Do major web platforms (YouTube, Zoom, Meet, Loom, etc.) use this API for encoder selection?
- Browser support coverage and known bugs/limitations?

### 2. Industry Standard Fallback Strategies
- How do production video recording platforms (Loom, Descript, Riverside.fm, Vimeo Record, etc.) handle encoder compatibility?
- What bitrate/quality configurations do they use as fallbacks?
- Do they use adaptive bitrate selection based on device capabilities?
- Are there published case studies or engineering blogs about this problem?

### 3. Alternative Approaches
- **WebCodecs API**: Is this a better solution than MediaRecorder for cross-device compatibility? Trade-offs?
- **Device fingerprinting**: Can we detect budget devices upfront and skip high bitrate attempts? How accurate?
- **Progressive enhancement**: Should we start low quality and upgrade if encoder accepts it, or start high and fallback?
- **Browser-managed encoding**: How effective is omitting all bitrate/quality hints and letting the browser decide?

### 4. Quality vs Compatibility Trade-offs
- What's the minimum acceptable quality for video ML training datasets?
- How much quality loss occurs with browser-managed encoding on budget devices?
- Are there codec-specific compatibility issues (H.264 baseline vs main profile, WebM VP8 vs VP9)?
- Do audio codec failures correlate with video failures (AAC vs Opus)?

### 5. Error Recovery Patterns
- Should we retry with fallback config immediately, or restart camera stream?
- Can we resume recording after an EncodingError, or must we discard and retake?
- How do production apps communicate encoder limitations to users (warnings, automatic quality adjustments)?

### 6. Testing and Detection Strategies
- Are there known device models/chipsets that consistently fail with high bitrate H.264?
- Can we use User-Agent parsing or device characteristics to predict compatibility?
- Should we run encoder capability tests on first app launch and cache results?

### 7. Specific Technical Questions
- Why does `MediaRecorder` constructor succeed but `start()` fails? Is this by design or a browser bug?
- Does the MediaCapabilities API query the hardware encoder or software encoder?
- Are there performance implications of software encoding fallback on battery life?
- Should we check `capabilityInfo.powerEfficient` and prefer lower bitrates on battery-powered devices?

## Target Deliverables

Please provide:

1. **Summary of industry best practices** with links to engineering blogs, documentation, or open-source implementations
2. **Comparison of approaches**: MediaRecorder fallback vs WebCodecs vs device detection
3. **Recommended implementation** for our use case with justification
4. **Known device/browser compatibility matrix** for different encoder configs
5. **Edge cases and failure modes** we should handle
6. **Code examples or reference implementations** from production apps (if available)

## Success Criteria

The ideal solution should:
- Achieve 95%+ successful recording across all devices
- Maintain 720p+ quality on 80%+ of devices
- Minimize user-facing errors and retries
- Be maintainable and not require constant device database updates
- Work reliably with both H.264 and WebM codecs

## Additional Notes

- We already implemented MediaCapabilities API approach - want to validate this is best practice
- Open to completely different architectures if they're more robust
- Interested in how this problem is solved in native apps (WebRTC implementations, etc.) for comparison
- Budget Android devices often have MediaTek or Qualcomm Snapdragon 4xx series chips - are these known problem areas?

---

**Expected research depth:** Please prioritize finding real-world production implementations and engineering case studies over theoretical documentation. We want to know what actually works at scale, not just what the specs say.
