@echo off
title Infinite Craft SSE Server
echo 🚀 Starting Infinite Craft SSE Server...
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist package.json (
    echo ❌ package.json not found
    echo Please run this from the server directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the server
echo ✅ Node.js found, starting SSE server...
echo.
echo 📡 SSE Server will be available at: http://localhost:3001
echo 🎮 Make sure to start the game server as well
echo.
npm start

echo.
echo 🛑 SSE Server stopped
pause
