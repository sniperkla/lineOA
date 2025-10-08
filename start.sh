#!/bin/bash

# Line OA Backend - Quick Start Script

echo "🚀 Line OA Backend - Quick Start"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "✅ .env created! Please edit it with your credentials:"
    echo "   - MONGODB_URI"
    echo "   - LINE_CHANNEL_SECRET"
    echo "   - LINE_CHANNEL_ACCESS_TOKEN"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "✅ Environment configured"
echo ""

# Check if MongoDB is running (local)
if command -v mongod &> /dev/null; then
    if pgrep -x mongod > /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running (if using local MongoDB)"
        echo "   Start it with: mongod"
    fi
else
    echo "ℹ️  MongoDB not found locally (using remote MongoDB?)"
fi

echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Make sure MongoDB is accessible"
echo "2. Get your Line OA credentials from: https://developers.line.biz/console/"
echo "3. Update .env with your credentials"
echo ""
echo "4. Start the server:"
echo "   npm run dev          # Development with auto-reload"
echo "   npm start            # Production"
echo ""
echo "5. Expose to internet (for Line webhook):"
echo "   ngrok http 4000      # Get HTTPS URL for webhook"
echo ""
echo "6. Set webhook URL in Line Console:"
echo "   https://your-ngrok-url.ngrok.io/webhook"
echo ""
echo "7. Test by adding your Line OA as friend and send a message!"
echo ""

read -p "Start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run dev
fi
