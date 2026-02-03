# Milestone 4: Backend + Upload

## What Was Built

Milestone 4 implements the backend server and chunked upload system:

### Backend (Flask)
- **Session Management**: Create and track recording sessions
- **Chunked Upload**: Receive 1MB chunks and reassemble videos
- **Metadata Storage**: Store video and session metadata as JSON
- **File Organization**: Automatic directory structure for each session

### Frontend Uploader
- **Chunk Splitting**: Split large video blobs into 1MB chunks
- **Retry Logic**: Exponential backoff (3 retries per chunk)
- **Progress Tracking**: Real-time upload progress callbacks
- **Sequential Upload**: Chunks uploaded one at a time for reliability

## Files Created

### Backend
- [`backend/app.py`](backend/app.py) - Flask server with upload endpoints
- [`backend/requirements.txt`](backend/requirements.txt) - Python dependencies

### Frontend
- [`frontend/js/uploader.js`](frontend/js/uploader.js) - Upload module

### Data Storage
- `data/facial_recordings/{session_id}/` - Session directories
- `data/facial_recordings/{session_id}/{video_id}.webm` - Video files
- `data/facial_recordings/{session_id}/{video_id}.metadata.json` - Video metadata
- `data/facial_recordings/{session_id}/session.json` - Session info

## API Endpoints

### POST /api/session/create
Create a new recording session

**Request:**
```json
{
  "participant_id": "optional_identifier"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "created_at": "2026-01-27T15:30:00",
  "status": "created"
}
```

### POST /api/upload/chunk
Upload a video chunk

**Form Data:**
- `session_id`: Session identifier
- `video_id`: Video identifier
- `chunk_index`: Current chunk (0-based)
- `total_chunks`: Total number of chunks
- `chunk`: Binary file data

**Response (partial):**
```json
{
  "status": "chunk_received",
  "chunk_index": 0,
  "total_chunks": 10,
  "received": 1
}
```

**Response (complete):**
```json
{
  "status": "video_complete",
  "video_id": "video_123",
  "file_path": "session_uuid/video_123.webm"
}
```

### POST /api/upload/metadata
Store video metadata

**Request:**
```json
{
  "session_id": "uuid",
  "video_id": "video_123",
  "prompt_id": "facial_expressions",
  "duration": 45.2,
  "file_size": 15728640,
  "codec": "vp9",
  "resolution": "1280x960",
  "frame_rate": 30,
  "camera_model": "HD Webcam",
  "browser": "Chrome 144.0",
  "timestamp": "2026-01-27T15:30:00"
}
```

**Response:**
```json
{
  "status": "metadata_saved",
  "video_id": "video_123"
}
```

### GET /api/session/{session_id}
Get session information

**Response:**
```json
{
  "session_id": "uuid",
  "created_at": "2026-01-27T15:30:00",
  "status": "created",
  "videos": [
    {
      "video_id": "video_123",
      "prompt_id": "facial_expressions",
      "uploaded_at": "2026-01-27T15:35:00"
    }
  ]
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "facial-data-collection-backend",
  "version": "1.0.0"
}
```

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd /home/akanlis/Desktop/facial-app/backend
pip3 install -r requirements.txt
```

### 2. Start Backend Server

```bash
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

### 3. Start Frontend Server

In a separate terminal:

```bash
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh
```

**Frontend:** http://localhost:8001
**Backend:** http://localhost:5000

## Testing the Upload Flow

### Manual Test with curl

```bash
# 1. Create session
SESSION_ID=$(curl -X POST http://localhost:5000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{"participant_id": "test_user"}' \
  | jq -r '.session_id')

echo "Session ID: $SESSION_ID"

# 2. Upload a test chunk (create a small test file)
echo "test data" > /tmp/test_chunk.dat

curl -X POST http://localhost:5000/api/upload/chunk \
  -F "session_id=$SESSION_ID" \
  -F "video_id=test_video_001" \
  -F "chunk_index=0" \
  -F "total_chunks=1" \
  -F "chunk=@/tmp/test_chunk.dat"

# 3. Upload metadata
curl -X POST http://localhost:5000/api/upload/metadata \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"video_id\": \"test_video_001\",
    \"prompt_id\": \"test\",
    \"duration\": 5.0,
    \"file_size\": 1024
  }"

# 4. Verify session
curl http://localhost:5000/api/session/$SESSION_ID | jq
```

### Browser Console Test

Open browser console on http://localhost:8001 and run:

```javascript
// Test session creation
const sessionId = await VideoUploader.createSession('test_participant');
console.log('Session ID:', sessionId);

// Test with a small blob
const testBlob = new Blob(['test data'], { type: 'video/webm' });

// Upload with progress tracking
await VideoUploader.uploadComplete(
  sessionId,
  testBlob,
  {
    videoId: 'test_video_001',
    prompt_id: 'test',
    duration: 5.0,
    file_size: testBlob.size,
    codec: 'test',
    resolution: '640x480',
    frame_rate: 30
  },
  (progress, current, total) => {
    console.log(`Progress: ${progress.toFixed(1)}% (${current}/${total} chunks)`);
  }
);

// Verify
const session = await VideoUploader.getSession(sessionId);
console.log('Session:', session);
```

## Frontend Integration

The uploader is now ready to be integrated into the recording flow. Example usage:

```javascript
// After recording is complete in recorder.js
async function handleAccept() {
  try {
    // Get or create session ID
    if (!window.backendSessionId) {
      window.backendSessionId = await VideoUploader.createSession();
    }

    // Prepare metadata
    const metadata = {
      videoId: currentVideoId,
      prompt_id: currentPromptId,
      duration: videoDuration,
      file_size: videoBlob.size,
      codec: detectedCodec,
      resolution: `${videoWidth}x${videoHeight}`,
      frame_rate: videoFrameRate,
      camera_model: cameraModel,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    // Upload (can be done in background)
    VideoUploader.uploadComplete(
      window.backendSessionId,
      videoBlob,
      metadata,
      (progress) => {
        console.log(`Upload: ${progress.toFixed(1)}%`);
      }
    ).then(result => {
      if (result.success) {
        console.log('✅ Upload complete:', result.videoId);
      } else {
        console.error('❌ Upload failed:', result.error);
      }
    });

  } catch (err) {
    console.error('Upload error:', err);
  }
}
```

## Directory Structure After Upload

```
data/facial_recordings/
└── {session_id}/
    ├── session.json
    ├── video_001.webm
    ├── video_001.metadata.json
    ├── video_002.webm
    ├── video_002.metadata.json
    └── video_003.webm
    └── video_003.metadata.json
```

## Upload Features

### Chunking
- Videos split into 1MB chunks
- Reduces memory pressure
- Allows resumable uploads (foundation for future enhancement)

### Retry Logic
- Each chunk retried up to 3 times
- Exponential backoff: 2^n seconds + random jitter
- Handles network instability gracefully

### Progress Tracking
- Optional progress callback
- Reports percentage, current chunk, total chunks
- Can be used to show upload UI

### Sequential Upload
- Chunks uploaded one at a time (not parallel)
- More reliable on unstable connections
- Easier to track progress

## Error Handling

### Client-Side
- Network errors → Retry with exponential backoff
- Blob too large → Automatic chunking
- Session not found → Clear error message

### Server-Side
- Missing chunks → Return 400 error
- Invalid session → Return 404 error
- File write errors → Return 500 error

## Next Steps (Milestone 5)

- **Background Upload**: Upload while user continues recording
- **Upload Queue**: Manage multiple videos uploading
- **Resumable Upload**: Resume from specific chunk after page reload
- **Upload UI**: Show upload progress in the interface

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Session creation endpoint works (curl test)
- [ ] Chunk upload endpoint works (curl test)
- [ ] Video reassembly works (multiple chunks)
- [ ] Metadata endpoint works
- [ ] Session endpoint returns correct data
- [ ] Browser console test passes
- [ ] Uploaded videos are playable
- [ ] Retry logic works (simulate network failure)
- [ ] Progress callback fires correctly

---

**Status**: Ready for Integration
**Last Updated**: 2026-01-27
