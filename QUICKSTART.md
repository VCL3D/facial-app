# Quick Start Guide

## System Ready! ✅

All dependencies are installed and configured. The system uses a Python virtual environment for backend dependencies.

## Starting the Application

### Option 1: Start Everything (Recommended)

```bash
cd /home/akanlis/Desktop/facial-app
./start-all.sh
```

This will:
- Start the backend server on **http://localhost:5001**
- Start the frontend server on **http://localhost:8001**
- Display logs for both servers
- Press `Ctrl+C` to stop both servers

### Option 2: Start Backend Only

```bash
cd /home/akanlis/Desktop/facial-app/backend
./start-backend.sh
```

### Option 3: Start Frontend Only

```bash
cd /home/akanlis/Desktop/facial-app
./start-dev-server.sh
```

## Testing the System

1. **Start the application**:
   ```bash
   ./start-all.sh
   ```

2. **Open your browser** to http://localhost:8001

3. **Test your camera** (optional but recommended):
   - Click "Test Camera" button
   - Allow camera access
   - Verify camera model and resolution shown
   - Click "Back to Home" when done

4. **Start recording session**:
   - Click "Start Recording Session"
   - Follow the on-screen instructions
   - Record, accept, or retake videos
   - Check browser console (F12) for detailed upload logs

5. **Verify uploads**:
   ```bash
   ls -lh data/facial_recordings/
   ```

   You should see a session directory with uploaded `.webm` files and `.metadata.json` files.

## Checking Logs

- **Backend logs**: `tail -f backend.log`
- **Frontend**: Check browser console (F12 → Console tab)

## Data Management

### Automatic Cleanup

The app automatically clears all session data after completion:
- **Auto-cleanup**: 30 seconds after reaching completion screen
- **Manual cleanup**: Clicking "Return Home" or "Start New Session" immediately clears data

This prevents data corruption and ensures a fresh start for each session.

### Manual Data Clear (if needed)

If you encounter any issues:
1. Go to http://localhost:8001/clear-data.html
2. Click "Clear All Data"
3. Or use the link from home page footer: "Troubleshooting: Clear All Data"

### Backend won't start
```bash
# Check if port 5001 is already in use <!--#claude-->
lsof -i :5001 <!--#claude-->

# View backend logs
cat backend.log
```

### Frontend won't start
```bash
# Check if port 8001 is already in use
lsof -i :8001
```

### Uploads not working
1. Check that backend is running: `curl http://localhost:5001/health`
2. Expected response: `{"status": "healthy", "data_dir": "..."}`
3. Check browser console for detailed error logs
4. Check backend.log for server-side errors

## System Architecture

```
Frontend (Port 8001)
   ↓
WebRTC Recording → IndexedDB → Blocking Upload (with progress modal)
   ↓
Backend (Port 5001) <!--#claude-->
   ↓
File System: data/facial_recordings/{session_id}/
   ├── {video_id}.webm
   ├── {video_id}.metadata.json
   └── session.json
```

## Upload Strategy <!--#claude-->

The app uses a **blocking upload** approach: <!--#claude-->
- After clicking "Accept", a modal appears with upload progress <!--#claude-->
- User must wait for upload to complete before continuing <!--#claude-->
- Progress bar shows real-time upload status (0-100%) <!--#claude-->
- Only advances to next video after successful upload <!--#claude-->
- This ensures no data loss and clear feedback <!--#claude-->

## Recording Quality

- **Video**: 12 Mbps bitrate, 1080p @ 30-60fps (Full HD)
- **Audio**: 320 kbps bitrate, 48kHz sample rate (High Quality)
- **Codec**: VP9 (WebM) or H.264 fallback
- **Expected file size**: ~50-60 MB per 45-second video

## Current Progress

✅ Milestone 0: PWA Setup
✅ Milestone 1: Single Video with Live Prompts
✅ Milestone 2: Local Persistence (IndexedDB)
✅ Milestone 3: Multi-Video Sequence (3 videos)
✅ Milestone 4: Backend + Upload Integration

**Next**: Milestone 5: Background Upload Optimization

## Resources

- Full testing guide: [TESTING-GUIDE.md](TESTING-GUIDE.md)
- Backend API documentation: [MILESTONE4-BACKEND.md](MILESTONE4-BACKEND.md)
- Development plan: See plan file in `~/.claude/plans/`
