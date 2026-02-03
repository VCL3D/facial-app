#!/bin/bash

# Start both backend and frontend servers for Facial Data Collection

cd "$(dirname "$0")"

echo "============================================================"
echo "Facial Data Collection - Starting All Services"
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
    echo "❌ Failed to start backend server"
    echo "Check backend.log for errors"
    exit 1
fi

echo "✅ Backend server started (PID: $BACKEND_PID)"
echo ""

# Start frontend server in foreground
echo "🚀 Starting frontend server (http://localhost:8001)..."
echo ""
echo "============================================================"
echo "Services Running:"
echo "  Frontend: http://localhost:8001"
echo "  Backend:  http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all services"
echo "============================================================"
echo ""

# Trap Ctrl+C to cleanup
trap "echo ''; echo '🛑 Stopping all services...'; kill $BACKEND_PID 2>/dev/null; echo '✅ All services stopped'; exit 0" INT TERM

# Start frontend (this runs in foreground)
cd frontend
PORT=8001

if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
else
    echo "❌ Error: Python 3 not found"
    kill $BACKEND_PID
    exit 1
fi
