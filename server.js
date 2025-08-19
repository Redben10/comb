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
        const combinations = JSON.parse(data);
        
        // Migration: Add sessionId to existing combinations that don't have it
        let hasChanges = false;
        for (const [key, combo] of Object.entries(combinations)) {
            if (!combo.sessionId) {
                combo.sessionId = 'default';
                hasChanges = true;
            }
        }
        
        // Save back if we made changes
        if (hasChanges) {
            console.log('🔄 Migrating existing combinations to include sessionId');
            await fs.writeFile(COMBINATIONS_FILE, JSON.stringify(combinations, null, 2));
        }
        
        return combinations;
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
// This checks globally across all sessions - once discovered anywhere, never a first discovery again
function isFirstDiscovery(result, existingCombinations, sessionId = null) {
    // Always check globally for first discoveries - once something is discovered by anyone, 
    // it's never a "first discovery" again, regardless of session
    for (const combination of Object.values(existingCombinations)) {
        if (combination.result.toLowerCase() === result.toLowerCase()) {
            return false; // Result already exists globally, not a first discovery
        }
    }
    return true; // This is a true first discovery globally!
}

// Check if a combination already exists in a specific session
function combinationExistsInSession(first, second, sessionId, existingCombinations) {
    const key = getCombinationKey(first, second);
    const sessionKey = sessionId === 'default' ? key : `${sessionId}:${key}`;
    
    // Check session-specific key first
    if (existingCombinations[sessionKey]) {
        return existingCombinations[sessionKey];
    }
    
    // Fall back to default key if session-specific not found
    if (existingCombinations[key] && existingCombinations[key].sessionId === sessionId) {
        return existingCombinations[key];
    }
    
    return null;
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
        const sessionId = req.query.sessionId || req.headers['x-session-id'] || 'default';
        const combinations = await loadCombinations();
        
        // Look for combination in this specific session
        const foundCombination = combinationExistsInSession(first, second, sessionId, combinations);
        
        if (foundCombination) {
            const key = getCombinationKey(first, second);
            console.log(`🔍 Found combination in session ${sessionId}: ${key} = ${foundCombination.result}`);
            res.json({
                result: foundCombination.result,
                emoji: foundCombination.emoji,
                isNew: false, // Never show as new when retrieving existing combinations
                sessionId: foundCombination.sessionId || sessionId
            });
        } else {
            const key = getCombinationKey(first, second);
            console.log(`❓ Combination not found: ${key} for session ${sessionId}`);
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
        const sessionId = req.body.sessionId || req.query.sessionId || req.headers['x-session-id'] || 'default';
        
        if (!first || !second || !result || !emoji) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const combinations = await loadCombinations();
        
        // Check if this combination already exists in this session
        const existingCombination = combinationExistsInSession(first, second, sessionId, combinations);
        
        if (existingCombination) {
            const key = getCombinationKey(first, second);
            console.log(`⚠️ Combination already exists for session ${sessionId}: ${key}`);
            return res.json({
                result: existingCombination.result,
                emoji: existingCombination.emoji,
                isNew: false,
                sessionId: existingCombination.sessionId || sessionId
            });
        }
        
        // Check if this result is a GLOBAL first discovery (not session-specific)
        const isFirstTime = isFirstDiscovery(result, combinations);
        
        // Save to JSON file with metadata about first discovery and session
        const newCombination = { 
            result, 
            emoji, 
            sessionId: sessionId,
            wasFirstDiscovery: isFirstTime, // Track if it was ever a GLOBAL first discovery
            discoveredAt: new Date().toISOString() // When it was first discovered
        };
        
        // Use a composite key that includes sessionId for storage
        const key = getCombinationKey(first, second);
        const storageKey = sessionId === 'default' ? key : `${sessionId}:${key}`;
        combinations[storageKey] = newCombination;
        
        await saveCombinations(combinations);
        
        if (isFirstTime) {
            console.log(`🌟 GLOBAL FIRST DISCOVERY (Session: ${sessionId}): ${key} = ${result} ${emoji}`);
            
            // Send special notification for first discoveries
            const firstDiscoveryMessage = JSON.stringify({
                type: 'first_discovery',
                combination: key,
                result,
                emoji,
                sessionId,
                timestamp: new Date().toISOString()
            });
            
            sseClients.forEach(client => {
                client.write(`data: ${firstDiscoveryMessage}\n\n`);
            });
        } else {
            console.log(`✨ New combination added (Session: ${sessionId}): ${key} = ${result} ${emoji} [Already discovered globally]`);
        }
        
        // Return the combination with isNew set correctly for THIS request
        res.json({
            result,
            emoji,
            isNew: isFirstTime, // Only true if this is actually a GLOBAL first discovery
            sessionId: sessionId
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
        const sessionId = req.query.sessionId || req.headers['x-session-id'] || 'default';
        const combinations = await loadCombinations();
        
        // Always check globally - first discoveries are global, not per-session
        const isFirst = isFirstDiscovery(result, combinations);
        
        res.json({
            result,
            sessionId,
            isFirstDiscovery: isFirst,
            message: isFirst ? 
                `This would be a GLOBAL first discovery!` : 
                `This result already exists globally (discovered by someone before)`
        });
    } catch (error) {
        console.error('Error checking first discovery:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all first discoveries (items marked as wasFirstDiscovery: true)
app.get('/api/first-discoveries', async (req, res) => {
    try {
        const sessionId = req.query.sessionId || req.headers['x-session-id']; // No default - show all if not specified
        const combinations = await loadCombinations();
        const firstDiscoveries = {};
        
        for (const [key, combo] of Object.entries(combinations)) {
            if (combo.wasFirstDiscovery === true) {
                // If sessionId is specified, only include discoveries from that session
                if (!sessionId || combo.sessionId === sessionId) {
                    // Clean up the key for display (remove session prefix if present)
                    const displayKey = key.includes(':') ? key.split(':')[1] : key;
                    firstDiscoveries[displayKey] = {
                        result: combo.result,
                        emoji: combo.emoji,
                        sessionId: combo.sessionId || 'default',
                        discoveredAt: combo.discoveredAt,
                        wasFirstDiscovery: true
                    };
                }
            }
        }
        
        res.json({
            sessionId: sessionId || 'all',
            firstDiscoveries,
            count: Object.keys(firstDiscoveries).length
        });
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
