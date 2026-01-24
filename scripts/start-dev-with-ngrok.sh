#!/bin/bash

# Script to start Next.js dev server on port 80 and ngrok tunnel
# Usage: ./scripts/start-dev-with-ngrok.sh

echo "🚀 Starting development server with ngrok..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed!"
    echo "Install it with: brew install ngrok/ngrok/ngrok"
    echo "Or download from: https://ngrok.com/download"
    exit 1
fi

# Check if port 80 is available
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 80 is already in use!"
    echo "Do you want to use port 3000 instead? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        PORT=3000
        echo "✅ Using port 3000"
    else
        echo "Please free up port 80 or choose port 3000"
        exit 1
    fi
else
    PORT=80
    echo "✅ Port 80 is available"
fi

# Start Next.js dev server in background
echo ""
echo "📦 Starting Next.js dev server on port $PORT..."
if [ "$PORT" -eq 80 ]; then
    sudo npm run dev:80 > /tmp/nextjs-dev.log 2>&1 &
else
    npm run dev > /tmp/nextjs-dev.log 2>&1 &
fi

DEV_PID=$!
echo "✅ Dev server started (PID: $DEV_PID)"
echo "   Logs: tail -f /tmp/nextjs-dev.log"

# Wait a moment for server to start
sleep 3

# Start ngrok
echo ""
echo "🌐 Starting ngrok tunnel..."
echo "   Webhook URL will be: https://[your-ngrok-url].ngrok-free.app/api/flutterwave/webhook"
echo ""
echo "📊 ngrok web interface: http://127.0.0.1:4040"
echo ""
echo "Press Ctrl+C to stop both server and ngrok"
echo ""

# Start ngrok (foreground so we can see output)
ngrok http $PORT

# Cleanup on exit
echo ""
echo "🛑 Stopping dev server..."
kill $DEV_PID 2>/dev/null
echo "✅ Done!"
