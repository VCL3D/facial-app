#!/bin/bash

echo "============================================================"
echo "Facial Data Collection - HTTPS Server Startup"
echo "============================================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "⚠️  Creating Python virtual environment..."
    python3 -m venv backend/venv
    echo "⚠️  Installing backend dependencies..."
    backend/venv/bin/pip install -r backend/requirements.txt
fi

# Start backend server in background
echo "🚀 Starting backend server (http://localhost:5001)..."
cd backend
venv/bin/python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2> /dev/null; then
    echo "❌ Backend failed to start. Check backend.log for details."
    exit 1
fi

echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Start HTTPS frontend server in foreground
echo "🚀 Starting HTTPS frontend server..."
echo ""
echo "============================================================"
echo "Services Running:"
echo "  Frontend: https://localhost:8001 (HTTPS)"
echo "  Frontend: https://195.251.117.230:8001 (HTTPS)"
echo "  Backend:  http://localhost:5001"
echo ""
echo "⚠️  Self-signed certificate warning:"
echo "    Your browser will show a security warning."
echo "    Click 'Advanced' → 'Proceed to site' to continue."
echo ""
echo "Press Ctrl+C to stop all services"
echo "============================================================"
echo ""

# Trap Ctrl+C to cleanup
trap "echo ''; echo '🛑 Stopping all services...'; kill $BACKEND_PID 2>/dev/null; echo '✅ All services stopped'; exit 0" INT TERM

# Start HTTPS server
python3 start-https-server.py
