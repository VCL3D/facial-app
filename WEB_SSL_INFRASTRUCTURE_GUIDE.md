# Web & SSL Infrastructure Guide - Facial Data Collection App

## Overview

This document explains the web infrastructure, SSL/TLS configuration, port mapping, and external access setup for the Facial Data Collection application. Use this guide to understand, maintain, or improve the web/SSL components.

---

## Current Architecture

### Single-Port Design (Port 8000)

The application uses a **unified single-port architecture** where everything is accessible through port 8000:

```
Internet (https://195.251.117.230:8000)
    ↓
Router Port Forwarding (8000 → 8000)
    ↓
Flask Server (0.0.0.0:8000 with HTTPS)
    ├─ Frontend: / → test-camera.html
    ├─ Static Files: /<path> → CSS, JS, images
    ├─ API: /api/* → Backend endpoints
    └─ Internal: Triton AI (localhost:8003) ← Flask only
```

### Why Single Port?

**Previous architecture had issues:**
- Frontend: HTTP server on port 8080
- Backend: Flask on port 5001
- Triton: Port 8000
- **Problem**: Required multiple router port forwards, CORS issues, complex configuration

**Current solution:**
- Everything on port 8000
- Flask serves both frontend static files AND backend API
- Triton on port 8003 (internal only, no external access needed)
- **Benefits**: Simple routing, no CORS issues, one URL to remember

---

## Port Configuration Details

### Port 8000 (External Access - HTTPS)

**Service**: Flask (Python web server)
**Protocol**: HTTPS (TLS 1.2+)
**Binding**: `0.0.0.0:8000` (all network interfaces)
**Access**:
- Local: `https://localhost:8000`
- External: `https://195.251.117.230:8000`

**Routes Served**:
```python
# Frontend Routes
GET  /                        → test-camera.html (main app)
GET  /<path:path>             → Static files (CSS, JS, images)

# Backend API Routes
POST /api/session/create      → Create recording session
POST /api/upload/chunk        → Upload video chunks
POST /api/upload/metadata     → Store video metadata
GET  /api/session/<id>        → Get session info
POST /api/quality/check       → AI quality assessment
GET  /health                  → Health check endpoint
```

**SSL/TLS Configuration**:
```python
# In app.py
ssl_context = ('cert.pem', 'key.pem')
app.run(host='0.0.0.0', port=8000, debug=True, ssl_context=ssl_context)
```

### Port 8003 (Internal Only - HTTP)

**Service**: NVIDIA Triton Inference Server (Docker container)
**Protocol**: HTTP (no SSL needed, internal only)
**Binding**: `localhost:8003` (loopback only)
**Access**: Only from Flask backend on same machine

**Routes Served**:
```
POST /v2/models/efficient_fiqa/infer    → AI inference
GET  /v2/health/ready                   → Health check
GET  /v2/models/efficient_fiqa          → Model info
GET  /metrics                           → Prometheus metrics
```

**Why Internal Only?**
- Only Flask needs to talk to Triton
- No external access required
- Better security (not exposed to internet)
- Reduces attack surface

### Port 8002 (Monitoring - HTTP)

**Service**: Triton metrics endpoint
**Protocol**: HTTP
**Binding**: `localhost:8002`
**Purpose**: Prometheus-compatible metrics for monitoring

---

## SSL/TLS Configuration

### Current Setup: Self-Signed Certificate

**Why Self-Signed?**
- Quick development setup
- No domain name required
- No cost
- Works for testing and internal use

**Certificates Created**:
```bash
# Location: /home/akanlis/Desktop/facial-app/backend/
cert.pem  # Public certificate (4096-bit RSA)
key.pem   # Private key (4096-bit RSA, unencrypted)
```

**Certificate Details**:
- **Type**: X.509 self-signed
- **Algorithm**: RSA 4096-bit
- **Validity**: 365 days
- **CN (Common Name)**: localhost
- **SANs**: None (IP address 195.251.117.230 not in cert)

**Generated With**:
```bash
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365 \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Browser Security Warnings

**What Users See**:
- Chrome: "Your connection is not private" (NET::ERR_CERT_AUTHORITY_INVALID)
- Firefox: "Warning: Potential Security Risk Ahead"
- Safari: "This Connection Is Not Private"

**Why This Happens**:
1. Certificate is self-signed (not from trusted CA)
2. Certificate CN is "localhost" but accessing via IP (195.251.117.230)
3. Browser doesn't trust self-signed certificates by default

**How Users Bypass**:
1. Click "Advanced" or "Show Details"
2. Click "Proceed to 195.251.117.230 (unsafe)" or "Accept the Risk"
3. Browser adds exception for this certificate

**Mobile Browsers**:
- Android Chrome: Shows warning, requires explicit bypass
- iOS Safari: Shows warning, requires "Continue to Website"
- **Important**: Users must manually accept self-signed cert each time (or after expiry)

---

## Production SSL Recommendations

### Option 1: Let's Encrypt (Free, Automated)

**Best for**: Production use with domain name

**Requirements**:
- Domain name pointing to 195.251.117.230
- Example: `facial-app.yourdomain.com`

**Setup with Certbot**:
```bash
# Install certbot
sudo apt update
sudo apt install certbot

# Get certificate (HTTP challenge)
sudo certbot certonly --standalone \
  -d facial-app.yourdomain.com \
  --preferred-challenges http \
  --http-01-port 80

# Certificates will be in:
# /etc/letsencrypt/live/facial-app.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/facial-app.yourdomain.com/privkey.pem
```

**Update app.py**:
```python
ssl_context = (
    '/etc/letsencrypt/live/facial-app.yourdomain.com/fullchain.pem',
    '/etc/letsencrypt/live/facial-app.yourdomain.com/privkey.pem'
)
```

**Auto-renewal**:
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-adds cron job for renewal
# Check: sudo systemctl status certbot.timer
```

**Advantages**:
- Free, trusted by all browsers
- Auto-renewal (90-day certs)
- No browser warnings
- Professional appearance

**Disadvantages**:
- Requires domain name ($10-15/year)
- Requires port 80 open temporarily for validation
- Certificate tied to domain, not IP

### Option 2: Nginx Reverse Proxy with Let's Encrypt

**Best for**: Production use with advanced features

**Architecture**:
```
Internet → Nginx (port 443, SSL) → Flask (port 8000, HTTP)
```

**Install Nginx**:
```bash
sudo apt install nginx
```

**Configure Nginx** (`/etc/nginx/sites-available/facial-app`):
```nginx
server {
    listen 443 ssl http2;
    server_name facial-app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/facial-app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/facial-app.yourdomain.com/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Flask
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Increase max body size for video uploads
    client_max_body_size 100M;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name facial-app.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

**Update Flask** (remove SSL, let Nginx handle it):
```python
# app.py - run without SSL
app.run(host='127.0.0.1', port=8000, debug=False)
```

**Advantages**:
- Better performance (static file serving)
- Rate limiting and DDoS protection
- Load balancing (multiple Flask instances)
- Caching for static assets
- Better logging and monitoring

### Option 3: Cloudflare Tunnel (No Port Forwarding)

**Best for**: No static IP or can't configure router

**How it works**:
- Cloudflare tunnel connects outbound from your server
- No inbound ports need to be open
- Cloudflare handles SSL automatically

**Setup**:
```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create facial-app

# Configure
cat > ~/.cloudflared/config.yml <<EOF
tunnel: <tunnel-id>
credentials-file: /home/akanlis/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: facial-app.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run facial-app
```

**Advantages**:
- No port forwarding needed
- Free SSL from Cloudflare
- DDoS protection included
- Works from anywhere (home, mobile network, etc.)

**Disadvantages**:
- Requires Cloudflare account
- Domain must use Cloudflare DNS
- Slight latency increase

### Option 4: Commercial SSL Certificate

**Best for**: Organizations requiring purchased certificates

**Providers**:
- DigiCert ($200-300/year)
- GlobalSign ($250-400/year)
- Sectigo ($100-200/year)

**Not Recommended**: Let's Encrypt provides same security for free.

---

## Current Router Configuration

### Port Forwarding Rule

**Router Interface**: 195.251.117.230 (external IP)
**Forwarding Rule**:
```
External Port: 8000
Internal IP: [Your local machine IP]
Internal Port: 8000
Protocol: TCP
Description: Facial App HTTPS
```

**Verify Forwarding**:
```bash
# From external network (phone on cellular, remote computer)
curl -k https://195.251.117.230:8000/health

# Expected: {"status": "healthy", ...}
```

### Firewall Configuration

**UFW (Ubuntu Firewall)**:
```bash
# Allow port 8000
sudo ufw allow 8000/tcp

# Check status
sudo ufw status

# Should show:
# 8000/tcp    ALLOW    Anywhere
```

---

## Security Considerations

### Current Security Posture

✅ **Good Practices**:
- HTTPS enabled (encrypted traffic)
- Triton not exposed to internet
- CORS enabled but controlled
- Health check endpoint available

⚠️ **Development-Only**:
- Self-signed certificate (browser warnings)
- Flask debug mode enabled
- No authentication on API endpoints
- No rate limiting
- Flask development server (not production-ready)

### Production Security Checklist

Before deploying to production:

**1. SSL/TLS**
- [ ] Replace self-signed cert with Let's Encrypt
- [ ] Enable HSTS (Strict-Transport-Security header)
- [ ] Disable TLS 1.0 and 1.1
- [ ] Use strong cipher suites only

**2. Application**
- [ ] Disable Flask debug mode
- [ ] Use production WSGI server (gunicorn/uwsgi)
- [ ] Add authentication (JWT tokens, OAuth, etc.)
- [ ] Implement rate limiting (Flask-Limiter)
- [ ] Add input validation and sanitization
- [ ] Set up CSRF protection

**3. Network**
- [ ] Use Nginx reverse proxy
- [ ] Enable fail2ban for brute force protection
- [ ] Set up firewall rules (only port 443/80)
- [ ] Implement request size limits
- [ ] Add IP whitelisting (if applicable)

**4. Monitoring**
- [ ] Set up logging (syslog, CloudWatch, etc.)
- [ ] Enable Prometheus metrics
- [ ] Add alerting (PagerDuty, email, etc.)
- [ ] Monitor SSL certificate expiry

---

## Troubleshooting Guide

### Issue: "Connection Refused" from External

**Check Flask is bound to 0.0.0.0**:
```bash
# Should show 0.0.0.0:8000, NOT 127.0.0.1:8000
sudo netstat -tlnp | grep 8000
```

**Check router port forwarding**:
```bash
# Test from external network
curl -k https://195.251.117.230:8000/health
```

**Check firewall**:
```bash
sudo ufw status
# Should allow port 8000
```

### Issue: "SSL Protocol Error"

**Symptoms**: Mobile browser shows SSL protocol error

**Cause**: Browser enforcing HTTPS but server using HTTP

**Fix**: Ensure Flask is running with `ssl_context`:
```python
ssl_context = ('cert.pem', 'key.pem')
app.run(host='0.0.0.0', port=8000, ssl_context=ssl_context)
```

### Issue: Certificate Expired

**Check expiry**:
```bash
openssl x509 -in cert.pem -noout -enddate
```

**Regenerate**:
```bash
cd /home/akanlis/Desktop/facial-app/backend
rm cert.pem key.pem
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365
```

**Restart Flask**

### Issue: "Mixed Content" Warnings

**Cause**: HTTPS page loading HTTP resources

**Check**: All resources must use HTTPS or relative URLs
```html
<!-- BAD -->
<script src="http://example.com/script.js"></script>

<!-- GOOD -->
<script src="https://example.com/script.js"></script>
<script src="/static/script.js"></script>
```

### Issue: CORS Errors

**Symptoms**: Browser console shows CORS errors

**Current config** in app.py:
```python
from flask_cors import CORS
CORS(app)  # Allows all origins
```

**Production config** (restrict origins):
```python
CORS(app, origins=[
    'https://195.251.117.230:8000',
    'https://facial-app.yourdomain.com'
])
```

---

## Monitoring SSL/Web Health

### Check SSL Certificate

```bash
# View certificate details
openssl s_client -connect localhost:8000 -showcerts

# Check expiry date
echo | openssl s_client -connect localhost:8000 2>/dev/null | \
  openssl x509 -noout -enddate

# Test SSL configuration
curl -kv https://localhost:8000/health 2>&1 | grep "SSL connection"
```

### Monitor Web Service

```bash
# Check Flask is running
ps aux | grep "python.*app.py"

# Check port is listening
sudo netstat -tlnp | grep 8000

# Check recent access logs
# (Flask logs to stderr/stdout, redirect to file for monitoring)

# Test health endpoint
curl -k https://localhost:8000/health
```

### Automated Health Checks

**Create monitoring script** (`/home/akanlis/Desktop/facial-app/backend/health_check.sh`):
```bash
#!/bin/bash
# Check if Flask is responding

HEALTH_URL="https://localhost:8000/health"
RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$RESPONSE" -eq 200 ]; then
    echo "✓ Flask is healthy"
    exit 0
else
    echo "✗ Flask is down (HTTP $RESPONSE)"
    # Restart Flask or send alert
    exit 1
fi
```

**Add to crontab**:
```bash
# Check every 5 minutes
*/5 * * * * /home/akanlis/Desktop/facial-app/backend/health_check.sh
```

---

## Quick Reference Commands

### Start Services
```bash
# Start Triton
docker start facial-app-triton

# Start Flask
cd /home/akanlis/Desktop/facial-app/backend
source venv/bin/activate
python3 app.py
```

### Check Status
```bash
# Triton
curl http://localhost:8003/v2/health/ready

# Flask
curl -k https://localhost:8000/health

# External access
curl -k https://195.251.117.230:8000/health
```

### View Logs
```bash
# Triton logs
docker logs -f facial-app-triton

# Flask logs (if redirected)
tail -f /tmp/flask.log

# System logs
sudo journalctl -u flask-app -f
```

### Certificate Management
```bash
# View cert details
openssl x509 -in cert.pem -text -noout

# Check expiry
openssl x509 -in cert.pem -noout -enddate

# Regenerate cert
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365
```

---

## Migration to Production Checklist

When ready to deploy properly:

1. **Register Domain** ($10-15/year)
   - Example: facial-app.yourdomain.com
   - Point A record to 195.251.117.230

2. **Install Nginx**
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx
   ```

3. **Get Let's Encrypt Certificate**
   ```bash
   sudo certbot --nginx -d facial-app.yourdomain.com
   ```

4. **Update Flask**
   - Remove ssl_context
   - Bind to 127.0.0.1 only
   - Use gunicorn instead of Flask dev server

5. **Configure Nginx** as reverse proxy

6. **Add Security Headers**
   - HSTS
   - Content-Security-Policy
   - X-Frame-Options
   - X-Content-Type-Options

7. **Set Up Monitoring**
   - Uptime monitoring (UptimeRobot, Pingdom)
   - SSL certificate expiry alerts
   - Log aggregation (ELK, Datadog)

8. **Implement Authentication**
   - JWT tokens for API
   - Rate limiting
   - CSRF protection

---

## Summary

**Current Setup**:
- Single port (8000) with HTTPS using self-signed certificate
- Flask serves frontend + backend
- Triton internal on port 8003
- Works for development and testing

**Access**:
- Local: https://localhost:8000
- External: https://195.251.117.230:8000
- Browser warnings expected (self-signed cert)

**Next Steps for Production**:
- Get domain name
- Use Let's Encrypt for trusted certificate
- Add Nginx reverse proxy
- Implement security best practices
- Set up monitoring and alerting

**Files**:
- SSL Cert: `/home/akanlis/Desktop/facial-app/backend/cert.pem`
- SSL Key: `/home/akanlis/Desktop/facial-app/backend/key.pem`
- Flask App: `/home/akanlis/Desktop/facial-app/backend/app.py`
- Port Config: [PORT_CONFIGURATION.md](PORT_CONFIGURATION.md)
