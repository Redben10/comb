# Infinite Craft Combinations Server

This is a Server-Sent Events (SSE) server that manages combinations for Infinite Craft. It stores combinations in a JSON file and provides real-time updates with **session-based first discovery tracking**.

## Features

- 🔄 Server-Sent Events for real-time updates
- 💾 JSON file storage for combinations
- 🔍 RESTful API for querying combinations
- ✨ Automatic logging of new AI-generated combinations
- 🌟 **Session-based first discovery detection** - tracks first discoveries per game save/session
- 📊 Server statistics and health monitoring
- 🎉 Real-time notifications for first discoveries
- 🎮 **Multi-session support** - each game save tracks its own first discoveries

## Session-Based First Discoveries

The server now supports **session-based first discovery tracking**. This means:

- Each game save/session has its own first discovery tracking
- When you start a new game or load a different save, you can discover items as "first discoveries" again
- The `wasFirstDiscovery` flag is tracked per session, not globally
- This matches how the original game works - each save file has its own progression

### Session ID Detection

The system automatically detects sessions based on:
1. Game save data in localStorage (if available)
2. Browser session storage
3. Falls back to a default session

You can also manually specify a session ID in API calls.

## Installation

1. Navigate to this directory:
```bash
cd comb
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

## API Endpoints

### SSE Events
- `GET /events` - Subscribe to real-time combination updates

### Combinations
- `GET /api/combination/:first/:second` - Get a specific combination
  - Query parameters: `sessionId` (optional) - specify the game session
  - Headers: `X-Session-ID` (optional) - alternative way to specify session
- `POST /api/combination` - Add a new combination (auto-detects first discoveries per session)
  - Body should include: `first`, `second`, `result`, `emoji`, `sessionId` (optional)
- `GET /api/combinations` - Get all combinations

### First Discoveries (Session-Aware)
- `GET /api/check-first-discovery/:result` - Check if a result would be a first discovery
  - Query parameters: `sessionId` (optional) - check for specific session
- `GET /api/first-discoveries` - Get all combinations marked as first discoveries
  - Query parameters: `sessionId` (optional) - filter by session, omit for all sessions

### Monitoring
- `GET /api/stats` - Get server statistics
- `GET /health` - Health check

## Usage

The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable.

Example requests:

```bash
# Get a combination for a specific session
curl "http://localhost:3001/api/combination/Fire/Water?sessionId=my-save-game-1"

# Add a combination for a specific session
curl -X POST http://localhost:3001/api/combination \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: my-save-game-1" \
  -d '{"first":"Fire","second":"Ice","result":"Steam","emoji":"💨","sessionId":"my-save-game-1"}'

# Check if a result would be a first discovery for a specific session
curl "http://localhost:3001/api/check-first-discovery/Dragon?sessionId=my-save-game-1"

# Get all first discoveries for a specific session
curl "http://localhost:3001/api/first-discoveries?sessionId=my-save-game-1"

# Get first discoveries from all sessions
curl "http://localhost:3001/api/first-discoveries"

# Subscribe to events (in browser or with curl)
curl http://localhost:3001/events
```

### Browser Console Commands (New Session Features)

When the game is running, you can use these console commands:

```javascript
// Session management
window.getCurrentSession()                    // Show current session ID
window.startNewSession()                      // Start a new game session
window.getSessionFirstDiscoveries()          // Get first discoveries for current session
window.getAllSessionsFirstDiscoveries()      // Get first discoveries from all sessions

// Existing commands (now session-aware)
window.checkFirstDiscovery("Dragon")         // Check if Dragon would be first discovery in current session
window.getFirstDiscoveries()                 // Get first discoveries for current session
window.addCombination("A", "B", "C", "🎯")   // Add combination to current session
```

## Integration

The Infinite Craft client should be configured to connect to this server for:
1. Checking if combinations already exist
2. Adding new AI-generated combinations
3. Receiving real-time updates

Server URL should be configured in the client as: `http://your-server-host:3001`
