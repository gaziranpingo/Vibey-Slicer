@echo off
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

:: Always check and install/update dependencies if package.json or node_modules changes
echo [INFO] Checking and installing required dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Starting Vibey Slicer local server...
echo [INFO] Open your browser at:
echo    - Local: http://localhost:3000
echo    - LAN/WAN: http://<your-ip-address>:3000
echo [INFO] Keeping terminal open. All background logs and activity will appear below:
echo =============================================

:: Start dev server and keep terminal alive
call npm run dev -- --host 0.0.0.0 --port 3000
pause
