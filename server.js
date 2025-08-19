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

// Check if a result has ever been created before (first discovery check)
function isFirstDiscovery(result, existingCombinations) {
    // Check if this result has ever appeared in any combination
    for (const [key, combination] of Object.entries(existingCombinations)) {
        if (combination.result.toLowerCase() === result.toLowerCase()) {
            // If we found this result in existing combinations, it's not a first discovery
            // regardless of whether it's a different combination method
            return false;
        }
    }
    
    // If we get here, this result has never been created before through any combination
    return true; // This is a first discovery of this result!
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
            // Always return isNew: false for existing combinations
            res.json({
                result: combinations[key].result,
                emoji: combinations[key].emoji,
                isNew: false // Never show as new when retrieving existing combinations
            });
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
            // Always return isNew: false for existing combinations
            return res.json({
                result: combinations[key].result,
                emoji: combinations[key].emoji,
                isNew: false
            });
        }
        
        // Check if this result is a first discovery
        const isFirstTime = isFirstDiscovery(result, combinations);
        
        // Save to JSON file with metadata about first discovery
        const newCombination = { 
            result, 
            emoji, 
            wasFirstDiscovery: isFirstTime, // Track if it was ever a first discovery
            discoveredAt: new Date().toISOString() // When it was first discovered
        };
        combinations[key] = newCombination;
        
        await saveCombinations(combinations);
        
        if (isFirstTime) {
            console.log(`🌟 FIRST DISCOVERY: ${key} = ${result} ${emoji}`);
            
            // Send special notification for first discoveries
            const firstDiscoveryMessage = JSON.stringify({
                type: 'first_discovery',
                combination: key,
                result,
                emoji,
                timestamp: new Date().toISOString()
            });
            
            sseClients.forEach(client => {
                client.write(`data: ${firstDiscoveryMessage}\n\n`);
            });
        } else {
            console.log(`✨ New combination added: ${key} = ${result} ${emoji}`);
        }
        
        // Return the combination with isNew set correctly for THIS request
        res.json({
            result,
            emoji,
            isNew: isFirstTime // Only true if this is actually a first discovery right now
        });
        
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

// Check if a result would be a first discovery
app.get('/api/check-first-discovery/:result', async (req, res) => {
    try {
        const { result } = req.params;
        const combinations = await loadCombinations();
        
        const isFirst = isFirstDiscovery(result, combinations);
        
        res.json({
            result,
            isFirstDiscovery: isFirst,
            message: isFirst ? 'This would be a first discovery!' : 'This result already exists'
        });
    } catch (error) {
        console.error('Error checking first discovery:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all first discoveries (items marked as wasFirstDiscovery: true)
app.get('/api/first-discoveries', async (req, res) => {
    try {
        const combinations = await loadCombinations();
        const firstDiscoveries = {};
        
        for (const [key, combo] of Object.entries(combinations)) {
            if (combo.wasFirstDiscovery === true) {
                firstDiscoveries[key] = {
                    result: combo.result,
                    emoji: combo.emoji,
                    discoveredAt: combo.discoveredAt,
                    wasFirstDiscovery: true
                };
            }
        }
        
        res.json(firstDiscoveries);
    } catch (error) {
        console.error('Error fetching first discoveries:', error);
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

// Periodic auto-save every 5 minutes to prevent data loss
const AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
let autoSaveTimer;

async function performAutoSave() {
    try {
        console.log('🔄 Performing auto-save...');
        const combinations = await loadCombinations();
        await fs.writeFile(COMBINATIONS_FILE, JSON.stringify(combinations, null, 2));
        console.log('✅ Auto-save completed');
    } catch (error) {
        console.error('❌ Auto-save failed:', error);
    }
}

// Start auto-save timer
autoSaveTimer = setInterval(performAutoSave, AUTO_SAVE_INTERVAL);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Infinite Craft Combinations Server running on port ${PORT}`);
    console.log(`📊 SSE Events: http://localhost:${PORT}/events`);
    console.log(`🔗 API Endpoint: http://localhost:${PORT}/api/combination/:first/:second`);
    console.log(`📋 All Combinations: http://localhost:${PORT}/api/combinations`);
    console.log(`📈 Stats: http://localhost:${PORT}/api/stats`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
    console.log(`💾 Auto-save enabled: every ${AUTO_SAVE_INTERVAL / 1000 / 60} minutes`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    
    // Clear auto-save timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        console.log('⏹️ Auto-save timer stopped');
    }
    
    try {
        // Load current combinations and ensure they're saved
        console.log('💾 Ensuring all data is saved to JSON file...');
        const combinations = await loadCombinations();
        await saveCombinations(combinations);
        console.log('✅ Data successfully saved');
    } catch (error) {
        console.error('❌ Error saving data during shutdown:', error);
    }
    
    // Close all SSE connections
    console.log('🔌 Closing SSE connections...');
    sseClients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify({
                type: 'server_shutdown',
                message: 'Server is shutting down - all data has been saved',
                timestamp: new Date().toISOString()
            })}\n\n`);
            client.end();
        } catch (error) {
            // Ignore errors when closing connections
        }
    });
    
    console.log('👋 Server shutdown complete');
    process.exit(0);
});

// Handle other shutdown signals
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    
    // Clear auto-save timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    
    try {
        const combinations = await loadCombinations();
        await saveCombinations(combinations);
        console.log('✅ Data saved on SIGTERM');
    } catch (error) {
        console.error('❌ Error saving data on SIGTERM:', error);
    }
    
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    
    // Clear auto-save timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    
    try {
        console.log('💾 Emergency data save...');
        const combinations = await loadCombinations();
        await saveCombinations(combinations);
        console.log('✅ Emergency save completed');
    } catch (saveError) {
        console.error('❌ Emergency save failed:', saveError);
    }
    
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
    console.error('🚫 Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Clear auto-save timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    
    try {
        console.log('💾 Emergency data save...');
        const combinations = await loadCombinations();
        await saveCombinations(combinations);
        console.log('✅ Emergency save completed');
    } catch (saveError) {
        console.error('❌ Emergency save failed:', saveError);
    }
    
    process.exit(1);
});
