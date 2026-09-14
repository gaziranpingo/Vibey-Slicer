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

# Check if node_modules exists, skip install if it does
echo "🔍 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "✔ Dependencies already installed, skipping install."
else
    echo "📦 Dependencies missing. Installing:"
    # List actual dependencies and devDependencies from package.json using node formatted in columns
    node -e "const p = require('./package.json'); const deps = [...Object.keys(p.dependencies || {}), ...Object.keys(p.devDependencies || {})]; const cols = 4; const width = 25; deps.forEach((d, i) => { process.stdout.write(d.padEnd(width)); if ((i + 1) % cols === 0) console.log(); }); console.log();"
    
    if command -v bun &> /dev/null; then
        bun install
    elif command -v npm &> /dev/null; then
        npm install --quiet --no-audit --no-fund --silent
    else
        echo "❌ No package manager found (npm or bun required)."
        exit 1
    fi
fi

echo "🚀 Starting Vibey Slicer local server..."

# Start dev server bound to 0.0.0.0:3000 and keep terminal open
if command -v bun &> /dev/null; then
    bun run dev
else
    npm run dev
fi

# Keep terminal window open on exit if run directly
read -p "Server stopped. Press Enter to close window..."
