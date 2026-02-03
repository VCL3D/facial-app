# Port Configuration - External Access Setup

## ✅ Current Setup (Port 8000 Routing)

### External Access
**URL**: `http://195.251.117.230:8000`

Your router forwards port 8000 → This entire application!

### Port Mapping

```
External World (Internet)
    ↓
Router (195.251.117.230:8000)
    ↓
    ├─ Flask Server (localhost:8000)
    │   ├─ Frontend: / → test-camera.html
    │   ├─ API: /api/session/create
    │   ├─ API: /api/upload/chunk
    │   ├─ API: /api/upload/metadata
    │   ├─ API: /api/quality/check (AI)
    │   └─ API: /health
    │
    └─ Triton Server (localhost:8003) [Internal Only]
        └─ AI Model: efficient_fiqa
```

### What Changed

**Before:**
```
- Frontend: Separate HTTP server on 8080
- Backend: Flask on 5001
- Triton: localhost:8000
- Problem: Multiple ports, complex routing
```

**After:**
```
- Frontend + Backend: Flask on 8000 (single port!)
- Triton: localhost:8003 (internal only, no external access needed)
- Solution: Everything through one port ✓
```

## Service Details

### 1. Flask (Port 8000) - **Externally Accessible**
- **Local**: `http://localhost:8000`
- **External**: `http://195.251.117.230:8000`
- **Purpose**: Serves frontend HTML/CSS/JS AND handles API requests
- **Status**: ✅ Running

**Routes:**
- `GET /` → Frontend (test-camera.html)
- `GET /<path>` → Static files (CSS, JS, images)
- `POST /api/session/create` → Create recording session
- `POST /api/upload/chunk` → Upload video chunks
- `POST /api/upload/metadata` → Save metadata
- `POST /api/quality/check` → AI quality assessment
- `GET /health` → Health check

### 2. Triton (Port 8003) - **Internal Only**
- **Local**: `http://localhost:8003`
- **External**: Not accessible (no router forwarding)
- **Purpose**: AI inference for quality checking
- **Status**: ✅ Running

**Routes:**
- `GET /v2/health/ready` → Server health
- `GET /v2/models/efficient_fiqa` → Model info
- `POST /v2/models/efficient_fiqa/infer` → Run inference

**Why internal only?**
- Only Flask backend needs to talk to Triton
- No need for external access → better security
- Reduces attack surface

## Testing Commands

### Test Local Access
```bash
# Frontend
curl http://localhost:8000/ | head -20

# Backend health
curl http://localhost:8000/health

# AI quality endpoint
curl -X POST http://localhost:8000/api/quality/check \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'

# Triton (internal)
curl http://localhost:8003/v2/health/ready
```

### Test External Access
```bash
# From another computer on the internet
curl http://195.251.117.230:8000/health

# Or open in browser:
http://195.251.117.230:8000
```

## Firewall Configuration

Your router is configured to forward:
```
External Port 8000 → Internal Port 8000 (Flask)
```

**No other ports need forwarding** because:
- Triton is internal only (port 8003)
- Everything goes through Flask on port 8000

## Starting Services

```bash
# 1. Start Triton (runs automatically on boot)
docker start facial-app-triton

# Verify Triton is ready
curl http://localhost:8003/v2/health/ready

# 2. Start Flask
cd /home/akanlis/Desktop/facial-app/backend
source venv/bin/activate
python3 app.py

# Flask will start on port 8000 and show:
#   Frontend: http://localhost:8000
#   External: http://195.251.117.230:8000
```

## Accessing the Application

### From Local Network
```
http://localhost:8000
http://195.251.117.230:8000
http://[your-local-ip]:8000
```

### From Internet (Outside Your Network)
```
http://195.251.117.230:8000
```

**What users see:**
1. Camera interface (test-camera.html)
2. AI quality checking panel
3. Recording controls
4. Real-time quality metrics

**What users DON'T see:**
- Triton server (internal only)
- Backend API details (abstracted by frontend)
- Model inference details

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│         External World (Internet)           │
└─────────────────┬───────────────────────────┘
                  │
          Port 8000 (Router Forwarding)
                  │
                  ▼
┌─────────────────────────────────────────────┐
│     Your Server (195.251.117.230)           │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │   Flask (Port 8000)                    │ │
│  │   ├─ Frontend (HTML/CSS/JS)            │ │
│  │   └─ Backend API (/api/*)              │ │
│  └──────────────┬─────────────────────────┘ │
│                 │ Internal                   │
│                 │ Connection                 │
│                 ▼                            │
│  ┌────────────────────────────────────────┐ │
│  │   Triton (Port 8003)                   │ │
│  │   └─ AI Model (Efficient-FIQA)         │ │
│  └────────────────────────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘
```

## Security Notes

**Good:**
- ✓ Only one port exposed externally (8000)
- ✓ Triton is internal only (can't be accessed from internet)
- ✓ AI inference happens server-side (model not exposed)

**Consider for Production:**
- Add HTTPS (SSL/TLS) using nginx reverse proxy
- Add rate limiting to prevent abuse
- Add authentication for API endpoints
- Use production WSGI server (gunicorn/uwsgi) instead of Flask dev server
- Add firewall rules beyond router forwarding

## Monitoring

```bash
# Check Flask is running
lsof -i :8000

# Check Triton is running
docker ps | grep triton

# View Flask logs
tail -f /tmp/flask_port8000.log

# View Triton logs
docker logs -f facial-app-triton

# Monitor GPU usage
watch -n 1 nvidia-smi
```

## Troubleshooting

### Can't access from external network
1. Check router port forwarding is enabled (8000 → 8000)
2. Check Flask is bound to 0.0.0.0 (not just 127.0.0.1)
3. Check firewall allows port 8000: `sudo ufw allow 8000`
4. Verify external IP: `curl ifconfig.me`

### Frontend loads but API fails
1. Check BACKEND_URL in test-camera.html is empty string: `const BACKEND_URL = '';`
2. Check Flask is running: `curl http://localhost:8000/health`
3. Check browser console for CORS errors

### AI quality check fails
1. Check Triton is running: `docker ps | grep triton`
2. Check Triton port: `curl http://localhost:8003/v2/health/ready`
3. Check Flask → Triton connection: `TRITON_URL` should be `localhost:8003`
4. Check Triton logs: `docker logs facial-app-triton | tail -20`

## Summary

**Single Port Setup**: Everything accessible via `http://195.251.117.230:8000`

**What works:**
- ✅ Frontend interface
- ✅ Session creation
- ✅ Video upload
- ✅ AI quality checking
- ✅ All API endpoints

**What's internal:**
- Triton AI server (localhost:8003)
- Backend → Triton communication
- GPU inference

**Benefits:**
- Simple routing (one port!)
- Better security (Triton not exposed)
- Easy to remember URL
- No CORS issues (same origin)
