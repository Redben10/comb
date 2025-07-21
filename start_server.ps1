# Infinite Craft SSE Server Startup Script (PowerShell)

Write-Host "Starting Infinite Craft SSE Server..." -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Check for Python installation
$pythonCmd = $null
$pythonCommands = @("python", "py", "python3")

foreach ($cmd in $pythonCommands) {
    if (Test-Command $cmd) {
        try {
            $version = & $cmd --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                $pythonCmd = $cmd
                Write-Host "Found Python: $cmd" -ForegroundColor Green
                Write-Host "Version: $version" -ForegroundColor Gray
                break
            }
        } catch {
            continue
        }
    }
}

if (-not $pythonCmd) {
    Write-Host "Error: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python 3.8 or higher from:" -ForegroundColor Yellow
    Write-Host "https://www.python.org/downloads/" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pip is available
try {
    & $pythonCmd -m pip --version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "pip not available"
    }
} catch {
    Write-Host "Error: pip is not available" -ForegroundColor Red
    Write-Host "Please ensure pip is installed with Python" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing/updating dependencies..." -ForegroundColor Yellow
try {
    & $pythonCmd -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install dependencies"
    }
} catch {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    Write-Host "Make sure you have internet connection and requirements.txt exists" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Start the server
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

try {
    & $pythonCmd server.py
} catch {
    Write-Host "Error: Failed to start server" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "Server stopped." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
}
