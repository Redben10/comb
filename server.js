const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const COMBINATIONS_FILE = path.join(__dirname, 'combinations.json');

// Middleware
app.use(cors());
app.use(express.json());

// Store active SSE connections
const sseClients = new Set();

// Load combinations from JSON file
async function loadCombinations() {
    try {
        const data = await fs.readFile(COMBINATIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading combinations:', error);
        return {};
    }
}

// Save combinations to JSON file
async function saveCombinations(combinations) {
    try {
        await fs.writeFile(COMBINATIONS_FILE, JSON.stringify(combinations, null, 2));
        console.log('✅ Combinations saved successfully');
        
        // Notify all SSE clients of the update
        const message = JSON.stringify({
            type: 'combination_added',
            timestamp: new Date().toISOString(),
            totalCombinations: Object.keys(combinations).length
        });
        
        sseClients.forEach(client => {
            client.write(`data: ${message}\n\n`);
        });
        
    } catch (error) {
        console.error('❌ Error saving combinations:', error);
        throw error;
    }
}

// Generate combination key (sorted)
function getCombinationKey(first, second) {
    const sorted = [first, second].sort();
    return sorted[0] + '+' + sorted[1];
}

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Add client to active connections
    sseClients.add(res);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to Infinite Craft combinations server',
        timestamp: new Date().toISOString()
    })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
        sseClients.delete(res);
        console.log('SSE client disconnected');
    });

    console.log('New SSE client connected');
});

// Get a specific combination
app.get('/api/combination/:first/:second', async (req, res) => {
    try {
        const { first, second } = req.params;
        const key = getCombinationKey(first, second);
        const combinations = await loadCombinations();
        
        if (combinations[key]) {
            console.log(`🔍 Found combination: ${key} = ${combinations[key].result}`);
            res.json(combinations[key]);
        } else {
            console.log(`❓ Combination not found: ${key}`);
            res.status(404).json({ error: 'Combination not found' });
        }
    } catch (error) {
        console.error('Error fetching combination:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add a new combination
app.post('/api/combination', async (req, res) => {
    try {
        const { first, second, result, emoji, isNew } = req.body;
        
        if (!first || !second || !result || !emoji) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const key = getCombinationKey(first, second);
        const combinations = await loadCombinations();
        
        // Don't overwrite existing combinations
        if (combinations[key]) {
            console.log(`⚠️ Combination already exists: ${key}`);
            return res.json(combinations[key]);
        }
        
        const newCombination = { result, emoji, isNew: isNew || false };
        combinations[key] = newCombination;
        
        await saveCombinations(combinations);
        
        console.log(`✨ New combination added: ${key} = ${result} ${emoji}`);
        res.json(newCombination);
        
    } catch (error) {
        console.error('Error adding combination:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all combinations
app.get('/api/combinations', async (req, res) => {
    try {
        const combinations = await loadCombinations();
        res.json(combinations);
    } catch (error) {
        console.error('Error fetching all combinations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get server stats
app.get('/api/stats', async (req, res) => {
    try {
        const combinations = await loadCombinations();
        res.json({
            totalCombinations: Object.keys(combinations).length,
            activeConnections: sseClients.size,
            serverStartTime: serverStartTime,
            uptime: Date.now() - serverStartTime
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const serverStartTime = Date.now();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Infinite Craft Combinations Server running on port ${PORT}`);
    console.log(`📊 SSE Events: http://localhost:${PORT}/events`);
    console.log(`🔗 API Endpoint: http://localhost:${PORT}/api/combination/:first/:second`);
    console.log(`📋 All Combinations: http://localhost:${PORT}/api/combinations`);
    console.log(`📈 Stats: http://localhost:${PORT}/api/stats`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    
    // Close all SSE connections
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({
            type: 'server_shutdown',
            message: 'Server is shutting down',
            timestamp: new Date().toISOString()
        })}\n\n`);
        client.end();
    });
    
    process.exit(0);
});
