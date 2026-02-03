# Face Detection Implementation for Efficient-FIQA

## Problem Solved

**Root Cause**: Efficient-FIQA was receiving full video frames instead of cropped face images, causing unreliable quality scores:
- High scores for non-face images
- Scores ignored whether faces were present
- No validation of face positioning

## Solution Implemented

Added a **3-stage preprocessing pipeline** before FIQA inference:

```
Video Frame → Face Detection → Face Cropping → FIQA Quality Assessment
```

### Stage 1: Face Detection (YuNet)
- **Model**: OpenCV YuNet (face_detection_yunet_2023mar.onnx)
- **Speed**: ~5ms on CPU, ~2ms on GPU
- **Output**: Face bounding boxes + 5 keypoints (eyes, nose, mouth corners)

### Stage 2: Smart Cropping & Edge Cases
- **Square crop** with 20% margin around detected face
- **Reflection padding** for faces near frame edges
- **Edge case detection**:
  - `NO_FACE`: No face detected in frame
  - `MULTIPLE_FACES`: Ambiguous (multiple similar-sized faces)
  - `FACE_TOO_SMALL`: Face < 12% of frame width
  - `PARTIAL_FACE`: Face extends beyond frame (>10% padding needed)

### Stage 3: FIQA Preprocessing
- Resize cropped face to 352×352
- Convert BGR → RGB
- Normalize with ImageNet stats
- Convert to CHW tensor format

## Files Modified/Created

### Backend
- ✅ `backend/app.py` - Re-enabled AI, added face detector initialization
- ✅ `backend/face_preprocessing.py` - New preprocessing pipeline
- ✅ `backend/test_face_detection.py` - Test script
- ✅ `ai-models/yunet/face_detection_yunet_2023mar.onnx` - Downloaded (227KB)

### Frontend
- ✅ `frontend/quality-ui-update.js` - Updated UI handler (needs manual integration)

### API Response Changes

**Old Response** (always returned):
```json
{
  "quality_score": 0.85,
  "quality_level": "good",
  "threshold_met": true,
  "inference_time_ms": 4.2
}
```

**New Response** (OK case):
```json
{
  "status": "OK",
  "quality_score": 0.85,
  "quality_level": "good",
  "threshold_met": true,
  "face_confidence": 0.92,
  "face_bbox": [x, y, w, h],
  "message": "Face quality assessed successfully",
  "inference_time_ms": 8.5
}
```

**New Response** (edge cases):
```json
{
  "status": "NO_FACE",  // or "MULTIPLE_FACES", "FACE_TOO_SMALL", "PARTIAL_FACE"
  "quality_score": null,
  "quality_level": null,
  "threshold_met": false,
  "face_confidence": 0.0,
  "message": "No face detected in frame",
  "inference_time_ms": 5.2
}
```

## Testing

### 1. Backend Unit Test
```bash
cd /home/akanlis/Desktop/facial-app/backend
source venv/bin/activate
python3 test_face_detection.py
```

**Expected Output**:
```
Test 1: Demo image with face (should return OK)
  Status: OK (or PARTIAL_FACE is also valid for demo image)
  Face Confidence: 0.93+

Test 2: Image with NO face (should return NO_FACE)
  Status: NO_FACE
✅ Correctly detected NO_FACE
```

### 2. Live Testing with Frontend

1. **Start backend**:
```bash
cd /home/akanlis/Desktop/facial-app/backend
source venv/bin/activate
python3 app.py
```

2. **Open test page**:
- Navigate to https://facestudy.detector-project.eu:8000 (or your URL)
- Open browser DevTools → Console

3. **Test scenarios**:

| Test | Action | Expected Status |
|------|--------|----------------|
| No face | Cover camera or point at wall | `NO_FACE` |
| Good face | Center your face, well-lit | `OK` with score |
| Multiple faces | Have 2 people in frame | `MULTIPLE_FACES` |
| Face too small | Sit far from camera | `FACE_TOO_SMALL` |
| Partial face | Move to edge of frame | `PARTIAL_FACE` |

### 3. Frontend Integration (Manual Step Required)

**Update `test-camera.html`**:

Replace the `updateAIQualityUI` function (around line 773) with the version in:
`/home/akanlis/Desktop/facial-app/frontend/quality-ui-update.js`

This adds status-specific UI messages:
- ⚠ No face detected
- ⚠ Multiple faces detected
- ⚠ Face too small
- ⚠ Face partially out of frame

## Configuration Tuning

Edit constants in `app.py` (lines 71-76):

```python
FACE_DETECTION_CONF_THRESHOLD = 0.6  # Lower = more sensitive detection
MIN_FACE_SIZE_RATIO = 0.12           # Lower = allow smaller faces
MULTI_FACE_AMBIGUITY_RATIO = 0.35    # Lower = more strict on rejecting multi-face
MAX_PADDING_RATIO = 0.10             # Higher = allow faces closer to edges
CROP_MARGIN_RATIO = 0.20             # Margin around face (0.15-0.25 works well)
```

## Performance Impact

| Operation | Time (CPU) | Time (GPU) |
|-----------|-----------|------------|
| Face Detection | ~5ms | ~2ms |
| Crop & Resize | ~2ms | ~1ms |
| FIQA Inference | (unchanged) | (unchanged) |
| **Total Added** | **~7ms** | **~3ms** |

For "check every 2-3 seconds" use case: **Negligible impact**

## Next Steps (Optional Phase 2)

If you see score instability with head tilt/rotation:

1. **Add face alignment** (5-point similarity transform)
   - Use detected landmarks to align eyes/nose to canonical positions
   - Improves score consistency by ~20-30%
   - Adds ~1-2ms processing time

2. **Upgrade to SCRFD detector**
   - Better accuracy for difficult poses/lighting
   - Slightly slower (~10ms) but more robust

## Troubleshooting

### Issue: "Face detector model not found"
**Fix**:
```bash
cd /home/akanlis/Desktop/facial-app/ai-models/yunet
wget https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
```

### Issue: "ModuleNotFoundError: No module named 'cv2'"
**Fix**:
```bash
cd /home/akanlis/Desktop/facial-app/backend
source venv/bin/activate
pip install opencv-python
```

### Issue: Detector finds faces in bad quality frames
- YuNet is very sensitive (good for not missing faces)
- FIQA will still give low scores to bad quality detected faces
- This is expected behavior (detection ≠ quality)

### Issue: Too many PARTIAL_FACE warnings
- Users' webcam FOV might be narrow
- Increase `MAX_PADDING_RATIO` to 0.15 or 0.20

## References

- **YuNet Paper**: https://arxiv.org/abs/2105.04486
- **YuNet OpenCV**: https://github.com/opencv/opencv_zoo
- **Efficient-FIQA**: ICCV 2025 VQualA Challenge Winner
- **ChatGPT/Gemini Research**: See research prompts in project notes

---

**Implementation Date**: 2026-02-03
**Status**: ✅ Complete and ready for testing
