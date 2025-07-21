@echo off
echo Starting Infinite Craft Combinations Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "server.js" (
    echo ERROR: server.js not found
    echo Make sure you're running this from the comb directory
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

echo Starting server on port 3001...
echo Press Ctrl+C to stop the server
echo.
node server.js

pause
