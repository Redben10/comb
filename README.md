# Infinite Craft SSE Server

This is a Server-Sent Events (SSE) server that manages combination data for Infinite Craft. It provides real-time updates, caching, and AI-powered combination generation.

## Features

- 📡 **Server-Sent Events (SSE)** for real-time updates
- 🧠 **AI-powered combination generation** using Hack Club API
- 💾 **Persistent JSON storage** for combinations
- 🔍 **Check existing combinations** before generating new ones
- 📊 **REST API** for managing combinations
- ⚡ **Real-time broadcasting** of new combinations to all connected clients

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

3. The server will run on `http://localhost:3001`

## API Endpoints

### SSE Endpoint
- `GET /events` - Connect to Server-Sent Events stream

### REST API
- `GET /api/check-combination?first=Fire&second=Water` - Check if combination exists
- `POST /api/generate-combination` - Generate new combination with AI
- `GET /api/combinations` - Get all combinations
- `POST /api/combinations` - Add combination manually
- `DELETE /api/combinations/:key` - Delete a combination
- `GET /health` - Health check

## Usage Examples

### Check if combination exists
```javascript
const response = await fetch('http://localhost:3001/api/check-combination?first=Fire&second=Water');
const data = await response.json();
console.log(data); // { exists: true, combination: { result: "Steam", emoji: "💨", ... } }
```

### Generate new combination
```javascript
const response = await fetch('http://localhost:3001/api/generate-combination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ first: 'Fire', second: 'Ice' })
});
const data = await response.json();
console.log(data); // { success: true, combination: { result: "Water", emoji: "💧", ... } }
```

### Connect to SSE stream
```javascript
const eventSource = new EventSource('http://localhost:3001/events');

eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('SSE Update:', data);
    
    switch(data.type) {
        case 'new_combination':
            console.log('New combination generated:', data.data);
            break;
        case 'combinations_updated':
            console.log('Combinations file updated');
            break;
    }
};
```

## Data Structure

Combinations are stored in JSON format:
```json
{
  "Fire+Water": {
    "result": "Steam",
    "emoji": "💨",
    "isNew": false,
    "timestamp": "2025-01-21T10:30:00.000Z",
    "generated": true
  }
}
```

## Environment Variables

- `PORT` - Server port (default: 3001)

## Project Structure

```
server/
├── package.json          # Dependencies and scripts
├── server.js             # Main server file
├── data/                 # Data directory
│   └── combinations.json # Combinations storage
└── README.md            # This file
```

## SSE Events

The server broadcasts these event types:

- `connected` - Client successfully connected
- `new_combination` - New combination was generated
- `combination_added` - Combination was manually added
- `combination_deleted` - Combination was deleted
- `combinations_updated` - Combinations file was saved

## Integration with Infinite Craft

To integrate with your existing Infinite Craft setup, modify the `api-interceptor.js` to:

1. First check the SSE server for existing combinations
2. If not found, generate using the SSE server
3. Listen to SSE updates for real-time sync

Example integration:
```javascript
// Check SSE server first
async function checkSSECombination(first, second) {
    try {
        const response = await fetch(`http://localhost:3001/api/check-combination?first=${first}&second=${second}`);
        const data = await response.json();
        
        if (data.exists) {
            return data.combination;
        }
        
        // Generate new combination
        const generateResponse = await fetch('http://localhost:3001/api/generate-combination', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first, second })
        });
        
        const generateData = await generateResponse.json();
        return generateData.combination;
    } catch (error) {
        console.error('SSE server error:', error);
        return null; // Fall back to local generation
    }
}
```
