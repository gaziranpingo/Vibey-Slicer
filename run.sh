#!/usr/bin/env bash
set -e

# Change directory to the script's own directory
cd "$(dirname "$0")"

echo "============================================="
echo "       Vibey Slicer - One-Click Host          "
echo "============================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed on your system."
    echo "Please download and install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✔ Node.js detected: $(node -v)"

# Always check and install/update dependencies
echo "📦 Checking and installing required dependencies..."
if command -v bun &> /dev/null; then
    bun install
elif command -v npm &> /dev/null; then
    npm install
else
    echo "❌ No package manager found (npm or bun required)."
    exit 1
fi

echo "🚀 Starting Vibey Slicer local server..."
echo "👉 Open your browser at:"
echo "   - Local: http://localhost:3000"
echo "   - LAN/WAN: http://<your-ip-address>:3000"
echo "ℹ️ Terminal will remain open showing all background logs. Press Ctrl+C to stop."
echo "============================================="

# Start dev server bound to 0.0.0.0:3000 and keep terminal open
if command -v bun &> /dev/null; then
    bun run dev
else
    npm run dev
fi

# Keep terminal window open on exit if run directly
read -p "Server stopped. Press Enter to close window..."
