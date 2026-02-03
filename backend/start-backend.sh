#!/bin/bash

# Start Flask backend for Facial Data Collection

cd "$(dirname "$0")"

echo "============================================================"
echo "Facial Data Collection - Backend Server"
echo "============================================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Creating Python virtual environment..."
    python3 -m venv venv
    echo "⚠️  Installing dependencies..."
    venv/bin/pip install -r requirements.txt
fi

echo "✅ Starting backend server..."
echo ""

venv/bin/python app.py
