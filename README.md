# Infinite Craft Combinations Server

This is a Server-Sent Events (SSE) server that manages combinations for Infinite Craft. It stores combinations in a JSON file and provides real-time updates.

## Features

- 🔄 Server-Sent Events for real-time updates
- 💾 JSON file storage for combinations
- 🔍 RESTful API for querying combinations
- ✨ Automatic logging of new AI-generated combinations
- 🌟 **First discovery detection** - automatically detects when a result is created for the first time
- 📊 Server statistics and health monitoring
- 🎉 Real-time notifications for first discoveries

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
- `POST /api/combination` - Add a new combination (auto-detects first discoveries)
- `GET /api/combinations` - Get all combinations

### First Discoveries
- `GET /api/check-first-discovery/:result` - Check if a result would be a first discovery
- `GET /api/first-discoveries` - Get all combinations marked as first discoveries

### Monitoring
- `GET /api/stats` - Get server statistics
- `GET /health` - Health check

## Usage

The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable.

Example requests:

```bash
# Get a combination
curl http://localhost:3001/api/combination/Fire/Water

# Add a combination (server will auto-detect if it's a first discovery)
curl -X POST http://localhost:3001/api/combination \
  -H "Content-Type: application/json" \
  -d '{"first":"Fire","second":"Ice","result":"Steam","emoji":"💨"}'

# Check if a result would be a first discovery
curl http://localhost:3001/api/check-first-discovery/Dragon

# Get all first discoveries
curl http://localhost:3001/api/first-discoveries

# Subscribe to events (in browser or with curl)
curl http://localhost:3001/events
```

## Integration

The Infinite Craft client should be configured to connect to this server for:
1. Checking if combinations already exist
2. Adding new AI-generated combinations
3. Receiving real-time updates

Server URL should be configured in the client as: `http://your-server-host:3001`
