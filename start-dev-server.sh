#!/bin/bash

# Development server launcher for Facial Data Collection app
# Tries multiple methods to start a local HTTP server

PORT=8001

echo "🚀 Starting development server for Facial Data Collection..."
echo ""

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use. Trying to find the process..."
    lsof -i :$PORT
    echo ""
    read -p "Kill existing process and restart? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti :$PORT | xargs kill -9
        echo "✓ Killed existing process"
    else
        echo "❌ Exiting..."
        exit 1
    fi
fi

cd "$(dirname "$0")/frontend"

# Try Python 3
if command -v python3 &> /dev/null; then
    echo "✓ Using Python 3"
    echo "📡 Server running at: http://localhost:$PORT"
    echo "🔗 Open in browser: http://localhost:$PORT"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server $PORT

# Try Python 2
elif command -v python &> /dev/null; then
    echo "✓ Using Python 2"
    echo "📡 Server running at: http://localhost:$PORT"
    echo "🔗 Open in browser: http://localhost:$PORT"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python -m SimpleHTTPServer $PORT

# Try Node.js (http-server)
elif command -v npx &> /dev/null; then
    echo "✓ Using Node.js (http-server)"
    echo "📡 Server running at: http://localhost:$PORT"
    echo ""
    npx http-server -p $PORT

# Try PHP
elif command -v php &> /dev/null; then
    echo "✓ Using PHP"
    echo "📡 Server running at: http://localhost:$PORT"
    echo "🔗 Open in browser: http://localhost:$PORT"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    php -S localhost:$PORT

else
    echo "❌ Error: No suitable HTTP server found"
    echo ""
    echo "Please install one of these:"
    echo "  - Python 3: sudo apt install python3"
    echo "  - Node.js: sudo apt install nodejs npm"
    echo "  - PHP: sudo apt install php"
    exit 1
fi
