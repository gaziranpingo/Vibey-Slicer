@echo off
if not "%~1"=="maximized" (
    start /max "" "%~f0" maximized
    exit /b
)
TITLE Vibey Slicer - One-Click Host
echo =============================================
echo        Vibey Slicer - One-Click Host         
echo =============================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Node.js detected: %NODE_VERSION%

:: Always check and install/update dependencies
:: Check if node_modules exists, skip install if it does
echo [INFO] Checking dependencies...
if exist "node_modules" (
    echo [INFO] Dependencies already installed, skipping install.
) else (
    echo [INFO] Dependencies missing. Installing:
    echo Dependencies:
    node -e "const p = require('./package.json'); const deps = [...Object.keys(p.dependencies || {}), ...Object.keys(p.devDependencies || {})]; const cols = 4; const width = 25; deps.forEach((d, i) => { process.stdout.write(d.padEnd(width)); if ((i + 1) %% cols === 0) console.log(); }); console.log();"
    echo.
    call npm install --quiet --no-audit --no-fund --silent
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo.
echo [SUCCESS] Starting Vibey Slicer local server...

:: Start dev server using npx to ensure local tsx is used
call npx tsx watch --ignore data/** server.ts
if %errorlevel% neq 0 (
    echo [ERROR] Server failed to start. Please ensure dependencies are installed correctly.
    pause
    exit /b 1
)
pause