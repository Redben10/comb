# Infinite Craft SSE Server

A Server-Sent Events (SSE) server for managing Infinite Craft combinations with persistent storage and AI generation.

## Features

- **Persistent Storage**: All combinations are stored in JSON format
- **AI Generation**: New combinations are generated using AI when not found in database
- **First Discovery Tracking**: Tracks when a player discovers an item for the first time
- **SSE Support**: Real-time communication using Server-Sent Events
- **REST API**: Full REST API for managing combinations
- **Discovery Statistics**: Track discovery progress and statistics

## Setup

### 1. Install Python

**Python 3.8 or higher is required.** Download from [python.org](https://www.python.org/downloads/)

⚠️ **Important**: During installation, make sure to check **"Add Python to PATH"**

### 2. Start the Server

Choose one of these methods:

**Option A: Automatic (Batch file)**
```batch
start_server.bat
```

**Option B: PowerShell Script**
```powershell
# You may need to allow script execution first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Then run:
.\start_server.ps1
```

**Option C: Manual**
```bash
pip install -r requirements.txt
python server.py
```

### 3. Update Your Game

Replace the API interceptor in your Infinite Craft game:

1. Copy `api-interceptor-sse.js` to your infinite craft folder
2. In your `index.html`, replace:
   ```html
   <script src="./api-interceptor.js"></script>
   ```
   with:
   ```html
   <script src="./api-interceptor-sse.js"></script>
   ```

### 4. Test the Server

Open `test.html` in your browser to test the server functionality.

## Server Endpoints

### Health & Status
- `GET /health` - Server health check and statistics

### Crafting
- `GET /api/infinite-craft/pair?first=Fire&second=Water` - Craft two items
- `GET /sse/craft?first=Fire&second=Water` - SSE crafting endpoint

### Data Management
- `GET /api/combinations` - List all combinations
- `GET /api/discoveries` - Get discovery statistics
- `POST /api/add-combination` - Manually add a combination
- `POST /api/reset` - Reset database (keeps basic combinations)

## First Discovery System

The server now properly tracks first discoveries:

- **No Random Chance**: Discovery is based on whether the item has been crafted before
- **Persistent Tracking**: First discoveries are saved and persist across sessions
- **Real-time Feedback**: `isNew: true` is returned for first discoveries
- **Statistics**: Track total discoveries and first discovery count

## API Response Format

```json
{
  "result": "Steam",
  "emoji": "💨",
  "isNew": false,
  "created_at": "2025-01-21T12:00:00"
}
```

For first discoveries, `isNew` will be `true`.

## Data Storage

All data is stored in `combinations.json`:

```json
{
  "combinations": {
    "Fire+Water": {
      "result": "Steam",
      "emoji": "💨",
      "isNew": false,
      "created_at": "2025-01-21T12:00:00"
    }
  },
  "discovered_items": ["Fire", "Water", "Steam"],
  "first_discoveries": ["Steam"],
  "last_updated": "2025-01-21T12:00:00"
}
```

## Client-Side Usage

The SSE interceptor provides these console commands:

```javascript
// Get server statistics
window.getServerStats()

// List all combinations
window.getAllCombinations()

// Show discovery statistics
window.getDiscoveries()

// Add combination manually
window.addCombinationToServer("Fire", "Water", "Steam", "💨", false)

// Reset server database
window.resetServerDatabase()

// Check if last craft was a first discovery
window.isFirstDiscovery()
```

## Configuration

Edit the interceptor file to change settings:

```javascript
const SERVER_URL = 'http://localhost:5000';  // Server URL
const USE_SSE = true;  // Enable/disable SSE mode
```

## Troubleshooting

1. **Server won't start**: Check Python installation and dependencies
2. **Game can't connect**: Ensure server is running on port 5000
3. **CORS errors**: The server includes CORS headers for local development
4. **AI generation fails**: Server will fallback to "Nothing" result

## Development

The server is built with Flask and supports:
- Async AI generation
- SSE streaming
- Persistent JSON storage
- CORS for local development
- Comprehensive logging

## Basic Combinations Included

The server initializes with basic combinations:
- Fire + Water = Steam
- Earth + Fire = Lava  
- Earth + Water = Plant
- Fire + Wind = Smoke
- Water + Wind = Wave
- Earth + Wind = Dust
- And more...

## License

This project is for educational and personal use.
