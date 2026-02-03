# AI Quality Integration - Implementation Guide

## ✅ Completed Tasks

1. **Model Preparation** (✅ DONE)
   - Cloned Efficient-FIQA repository
   - Exported PyTorch model to ONNX (0.99 MB)
   - Converted ONNX to TensorRT FP16 (6.9 MB)
   - **Performance**: 3.8ms GPU latency, 263 QPS

2. **Triton Deployment** (✅ DONE)
   - Created Triton model repository at `/home/akanlis/Desktop/facial-app/ai-models/triton_models/`
   - Created config.pbtxt with dynamic batching
   - Deployed Triton server (Docker container: `facial-app-triton`)
   - Verified model is READY on port 8000

3. **Backend Integration** (✅ DONE)
   - Updated `requirements.txt` with tritonclient, Pillow, numpy
   - Installed dependencies in venv
   - Added `/api/quality/check` endpoint to Flask backend
   - Added image preprocessing function

4. **Frontend HTML** (✅ DONE)
   - Added AI quality panel HTML to `test-camera.html`
   - Added CSS styling for score circle and panel

## ⏳ Remaining Tasks

### 1. Add JavaScript Functions for AI Quality Checking

Add these global variables after line 363 in `test-camera.html`:

```javascript
// AI Quality checking state
let aiQualityCheckInterval = null;
let aiQualityBuffer = [];  // Buffer to track last 15 quality checks
const AI_CHECK_INTERVAL = 2000;  // Check every 2 seconds
const AI_BUFFER_SIZE = 15;  // Need 15 consecutive good frames
const AI_THRESHOLD = 0.5;  // Minimum quality score (0-1)
const BACKEND_URL = 'http://localhost:5001';
```

Add these functions before the `startCamera()` function:

```javascript
/**
 * Capture current frame from video as base64 image
 */
function captureFrameAsBase64() {
    const video = document.getElementById('preview');
    const canvas = document.getElementById('analysisCanvas');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Check AI quality of current frame
 */
async function checkAIQuality() {
    try {
        // Update status
        document.getElementById('aiStatus').textContent = 'Checking...';
        document.getElementById('aiStatus').style.color = '#007aff';

        // Capture frame
        const imageData = captureFrameAsBase64();

        // Send to backend for AI inference
        const response = await fetch(`${BACKEND_URL}/api/quality/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        // Update UI with results
        updateAIQualityUI(result);

        // Update buffer
        updateQualityBuffer(result.threshold_met);

        return result;
    } catch (error) {
        console.error('AI quality check failed:', error);
        document.getElementById('aiStatus').textContent = `Error: ${error.message}`;
        document.getElementById('aiStatus').style.color = '#ff3b30';
        return null;
    }
}

/**
 * Update AI quality UI with results
 */
function updateAIQualityUI(result) {
    // Update score circle
    const scoreValue = document.getElementById('scoreValue');
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreLevel = document.getElementById('scoreLevel');
    const scoreStatus = document.getElementById('scoreStatus');

    // Display score
    scoreValue.textContent = result.quality_score.toFixed(2);

    // Update circle color based on quality
    let color;
    if (result.quality_level === 'good') {
        color = '#34c759';
    } else if (result.quality_level === 'acceptable') {
        color = '#ff9500';
    } else {
        color = '#ff3b30';
    }

    // Update circle gradient (0-360 degrees based on score)
    const degrees = result.quality_score * 360;
    scoreCircle.style.background = `conic-gradient(${color} ${degrees}deg, #2a2a2a ${degrees}deg)`;

    // Update level text
    scoreLevel.textContent = result.quality_level.toUpperCase();
    scoreLevel.className = `score-level ${result.quality_level}`;

    // Update status
    if (result.threshold_met) {
        document.getElementById('aiStatus').textContent = '✓ Good quality';
        document.getElementById('aiStatus').style.color = '#34c759';
        scoreStatus.textContent = 'Ready for recording';
    } else {
        document.getElementById('aiStatus').textContent = '✗ Improve lighting/position';
        document.getElementById('aiStatus').style.color = '#ff9500';
        scoreStatus.textContent = 'Adjust camera for better quality';
    }

    // Update other info
    document.getElementById('aiLastCheck').textContent = new Date().toLocaleTimeString();
    document.getElementById('aiInferenceTime').textContent = `${result.inference_time_ms}ms`;
}

/**
 * Update quality buffer and check if recording can be enabled
 */
function updateQualityBuffer(isGood) {
    // Add to buffer
    aiQualityBuffer.push(isGood);

    // Keep only last 15 checks
    if (aiQualityBuffer.length > AI_BUFFER_SIZE) {
        aiQualityBuffer.shift();
    }

    // Count good frames
    const goodFrames = aiQualityBuffer.filter(x => x).length;
    document.getElementById('aiGoodFrames').textContent = `${goodFrames} / ${AI_BUFFER_SIZE}`;

    // Check if all frames are good
    const allGood = aiQualityBuffer.length === AI_BUFFER_SIZE &&
                    aiQualityBuffer.every(x => x);

    // Update record button state (if exists)
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
        if (allGood) {
            recordBtn.disabled = false;
            document.getElementById('scoreStatus').textContent = '✓ Recording enabled!';
            document.getElementById('scoreStatus').style.color = '#34c759';
        } else {
            recordBtn.disabled = true;
        }
    }

    return allGood;
}

/**
 * Start AI quality checking loop
 */
function startAIQualityChecking() {
    // Show AI panel
    document.getElementById('aiQualityPanel').style.display = 'block';

    // Reset buffer
    aiQualityBuffer = [];

    // Start periodic checking
    aiQualityCheckInterval = setInterval(async () => {
        await checkAIQuality();
    }, AI_CHECK_INTERVAL);

    // Do first check immediately
    checkAIQuality();
}

/**
 * Stop AI quality checking
 */
function stopAIQualityChecking() {
    if (aiQualityCheckInterval) {
        clearInterval(aiQualityCheckInterval);
        aiQualityCheckInterval = null;
    }

    // Hide AI panel
    document.getElementById('aiQualityPanel').style.display = 'none';

    // Reset buffer
    aiQualityBuffer = [];
}
```

### 2. Integrate into Camera Start Flow

Modify the `startCamera()` function to start AI quality checking after camera initializes. Find the existing `startCamera()` function and add this after the camera starts successfully:

```javascript
// After camera starts successfully, add:
startAIQualityChecking();
```

### 3. Integrate into Camera Stop Flow

Find where the camera stream is stopped and add:

```javascript
stopAIQualityChecking();
```

## 🧪 Testing Instructions

### 1. Start All Services

```bash
# Terminal 1: Start Triton server (if not already running)
docker start facial-app-triton

# Verify Triton is ready
curl http://localhost:8000/v2/models/efficient_fiqa/ready

# Terminal 2: Start Flask backend
cd /home/akanlis/Desktop/facial-app/backend
source venv/bin/activate
python3 app.py
```

### 2. Test Backend Endpoint

Create a test image and verify the endpoint works:

```bash
# Test with a simple image (create test_image.py)
python3 -c "
import base64
import requests
from PIL import Image
import io

# Create a test image (solid color 352x352)
img = Image.new('RGB', (352, 352), color='red')
buffer = io.BytesIO()
img.save(buffer, format='JPEG')
img_str = base64.b64encode(buffer.getvalue()).decode()

# Test endpoint
response = requests.post(
    'http://localhost:5001/api/quality/check',
    json={'image': f'data:image/jpeg;base64,{img_str}'}
)

print('Status:', response.status_code)
print('Response:', response.json())
"
```

Expected output:
```json
{
  "quality_score": 0.XXXX,
  "quality_level": "poor/acceptable/good",
  "threshold_met": true/false,
  "inference_time_ms": X.XX
}
```

### 3. Test Frontend Integration

1. Open browser: `http://localhost:5001` (or open `frontend/test-camera.html`)
2. Click "Start Camera"
3. Verify:
   - AI Quality panel appears
   - Score circle updates every 2 seconds
   - Quality level shows (poor/acceptable/good)
   - Good frames counter increments
   - Inference time is displayed (~4-10ms)

### 4. Test Quality Buffer

1. Point camera at well-lit face
2. Wait for 30 seconds (15 checks × 2s)
3. Verify "Good Frames" reaches "15 / 15"
4. Verify status shows "✓ Recording enabled!"

## 📊 Expected Performance

- **Inference Latency**: 4-10ms (GPU) + 2-5ms (network) = ~10ms total
- **Check Frequency**: Every 2 seconds
- **Buffer Requirement**: 15 consecutive good frames = 30 seconds minimum
- **Throughput**: Triton can handle 40-60 concurrent users on RTX 3060

## 🐛 Troubleshooting

### Triton Connection Failed

```bash
# Check Triton is running
docker ps | grep triton

# Check logs
docker logs facial-app-triton | tail -20

# Restart if needed
docker restart facial-app-triton
```

### Backend Errors

```bash
# Check Flask is running on port 5001
lsof -i :5001

# Check backend logs for errors
cd /home/akanlis/Desktop/facial-app/backend
python3 app.py
```

### CORS Issues

If you see CORS errors in browser console, verify Flask-CORS is enabled in `app.py`:
```python
from flask_cors import CORS
app = Flask(__name__)
CORS(app)  # Should be present
```

### Slow Inference

If inference takes >50ms:
1. Check GPU is being used: `nvidia-smi` (should show python process)
2. Check Triton dynamic batching is working
3. Verify TensorRT engine was built correctly

## 📁 File Locations

- **TensorRT Engine**: `/home/akanlis/Desktop/facial-app/ai-models/triton_models/efficient_fiqa/1/model.plan`
- **Triton Config**: `/home/akanlis/Desktop/facial-app/ai-models/triton_models/efficient_fiqa/config.pbtxt`
- **Flask Backend**: `/home/akanlis/Desktop/facial-app/backend/app.py`
- **Frontend**: `/home/akanlis/Desktop/facial-app/frontend/test-camera.html`

## 🎯 Next Steps

Once end-to-end testing is successful:

1. **Optimize Parameters**:
   - Adjust `AI_CHECK_INTERVAL` (currently 2000ms)
   - Adjust `AI_BUFFER_SIZE` (currently 15 frames)
   - Adjust `AI_THRESHOLD` (currently 0.5)

2. **Add Visual Feedback**:
   - Show real-time quality score on video overlay
   - Add progress bar for buffer filling
   - Add camera positioning guidelines

3. **Production Optimizations**:
   - Add request queuing on backend
   - Implement exponential backoff for retries
   - Add metrics logging (Prometheus/Grafana)

4. **RTX 5090 Migration**:
   - Same TensorRT engine works
   - Update Triton config: increase `count` to 4-6 instances
   - Increase max_batch_size to 32
   - Expected throughput: 100+ users