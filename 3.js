const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for now - you can restrict this later
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    credentials: false
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Path to combinations JSON file
const combinationsPath = path.join(__dirname, 'data', 'combinations.json');
const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Load or initialize combinations data
let combinations = {};

function loadCombinations() {
    try {
        if (fs.existsSync(combinationsPath)) {
            const data = fs.readFileSync(combinationsPath, 'utf8');
            combinations = JSON.parse(data);
            console.log(`📁 Loaded ${Object.keys(combinations).length} combinations from file`);
        } else {
            // Initialize with basic combinations
            combinations = {
                'Earth+Fire': { result: 'Lava', emoji: '🌋', isNew: false, timestamp: new Date().toISOString(), firstDiscovery: false },
                'Fire+Water': { result: 'Steam', emoji: '💨', isNew: false, timestamp: new Date().toISOString(), firstDiscovery: false },
                'Earth+Water': { result: 'Plant', emoji: '🌱', isNew: false, timestamp: new Date().toISOString(), firstDiscovery: false },
                'Wind+Fire': { result: 'Smoke', emoji: '💨', isNew: false, timestamp: new Date().toISOString(), firstDiscovery: false },
                'Water+Wind': { result: 'Wave', emoji: '🌊', isNew: false, timestamp: new Date().toISOString(), firstDiscovery: false },
                'Earth+Wind': { result: 'Dust', emoji: '🌪️', isNew: false, timestamp: new Date().toISOString(), firstDiscovery: false }
            };
            saveCombinations();
        }
    } catch (error) {
        console.error('❌ Error loading combinations:', error);
        combinations = {};
    }
}

function saveCombinations() {
    try {
        fs.writeFileSync(combinationsPath, JSON.stringify(combinations, null, 2), 'utf8');
        console.log('💾 Combinations saved to file');
        // Broadcast update to SSE clients
        broadcastUpdate('combinations_updated', { count: Object.keys(combinations).length });
    } catch (error) {
        console.error('❌ Error saving combinations:', error);
    }
}

function getCombinationKey(first, second) {
    const sorted = [first, second].sort();
    return sorted[0] + '+' + sorted[1];
}

// Generate AI combination using Hack Club API
async function generateAICombination(first, second) {
    try {
        console.log(`🤖 Generating AI combination for: ${first} + ${second}`);
        
        const prompt = `You are an AI assistant for the game "Infinite Craft". I need you to combine two items.

Return ONLY valid JSON in this exact format:
{"result": "Item Name", "emoji": "🎯"}

Examples:
Fire + Water → {"result": "Steam", "emoji": "💨"}
Earth + Water → {"result": "Plant", "emoji": "🌱"}  

You are Infinite Craft, but with logic.
When I give you two items, combine them like in the game Infinite Craft — funny, creative, or unexpected — but also use internal logic or reasoning behind the combination.
Think metaphorically, culturally, scientifically, or linguistically, but keep it fun and concise.
Only return one new item name, no explanation.

Combine "${first}" + "${second}":`;

        const response = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (response.ok) {
            const aiData = await response.json();
            let aiResponse = aiData.choices[0].message.content.trim();
            
            console.log('🤖 Raw AI response:', aiResponse);
            
            // Try to extract JSON from the response
            try {
                const jsonMatch = aiResponse.match(/\{[^}]*"result"[^}]*\}/);
                if (jsonMatch) {
                    aiResponse = jsonMatch[0];
                }
                
                const parsed = JSON.parse(aiResponse);
                if (parsed.result && parsed.emoji) {
                    console.log('✅ AI generated combination:', parsed);
                    return {
                        result: parsed.result,
                        emoji: parsed.emoji,
                        isNew: true, // Always true for AI-generated combinations (first discovery)
                        timestamp: new Date().toISOString(),
                        generated: true,
                        firstDiscovery: true // Mark as first discovery
                    };
                }
            } catch (parseError) {
                console.log('❌ AI response parsing failed:', parseError);
            }
        }
    } catch (error) {
        console.log('❌ AI generation failed:', error.message);
    }
    
    // Fallback combination
    return {
        result: 'Nothing',
        emoji: '❌',
        isNew: false,
        timestamp: new Date().toISOString(),
        generated: false,
        firstDiscovery: false
    };
}

// SSE clients storage
let sseClients = [];

// Function to broadcast updates to all SSE clients
function broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    sseClients.forEach(client => {
        try {
            client.write(`data: ${message}\n\n`);
        } catch (error) {
            console.log('❌ Error sending SSE message to client:', error);
        }
    });
}

// SSE endpoint
app.get('/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
        'Access-Control-Allow-Credentials': 'false'
    });

    // Add client to SSE clients list
    sseClients.push(res);
    console.log(`📡 SSE client connected. Total clients: ${sseClients.length}`);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        data: { message: 'Connected to SSE server' },
        timestamp: new Date().toISOString()
    })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
        console.log(`📡 SSE client disconnected. Total clients: ${sseClients.length}`);
    });
});

// API Routes

// Check if combination exists
app.get('/api/check-combination', (req, res) => {
    const { first, second } = req.query;
    
    if (!first || !second) {
        return res.status(400).json({ error: 'Missing first or second parameter' });
    }
    
    const key = getCombinationKey(first, second);
    const combination = combinations[key];
    
    console.log(`🔍 Checking combination: ${key}`);
    
    if (combination) {
        console.log(`✅ Found existing combination: ${key} = ${combination.result}`);
        res.json({ 
            exists: true, 
            combination: combination,
            key: key
        });
    } else {
        console.log(`❌ Combination not found: ${key}`);
        res.json({ 
            exists: false,
            key: key
        });
    }
});

// Generate new combination
app.post('/api/generate-combination', async (req, res) => {
    const { first, second } = req.body;
    
    if (!first || !second) {
        return res.status(400).json({ error: 'Missing first or second parameter' });
    }
    
    const key = getCombinationKey(first, second);
    
    console.log(`🎨 Generating combination for: ${key}`);
    
    try {
        // Generate using AI
        const newCombination = await generateAICombination(first, second);
        
        // Save the new combination
        combinations[key] = newCombination;
        saveCombinations();
        
        console.log(`✅ Generated and saved: ${key} = ${newCombination.result}`);
        
        // Broadcast the new combination to SSE clients
        broadcastUpdate('new_combination', {
            key: key,
            first: first,
            second: second,
            combination: newCombination,
            isFirstDiscovery: newCombination.firstDiscovery || false
        });
        
        res.json({
            success: true,
            key: key,
            combination: newCombination
        });
        
    } catch (error) {
        console.error('❌ Error generating combination:', error);
        res.status(500).json({ error: 'Failed to generate combination' });
    }
});

// Get all combinations
app.get('/api/combinations', (req, res) => {
    res.json({
        combinations: combinations,
        count: Object.keys(combinations).length
    });
});

// Add combination manually
app.post('/api/combinations', (req, res) => {
    const { first, second, result, emoji, isNew } = req.body;
    
    if (!first || !second || !result || !emoji) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const key = getCombinationKey(first, second);
    
    combinations[key] = {
        result: result,
        emoji: emoji,
        isNew: isNew || false,
        timestamp: new Date().toISOString(),
        generated: false,
        firstDiscovery: false // Manual additions are not first discoveries
    };
    
    saveCombinations();
    
    console.log(`✅ Manually added combination: ${key} = ${result}`);
    
    broadcastUpdate('combination_added', {
        key: key,
        first: first,
        second: second,
        combination: combinations[key]
    });
    
    res.json({
        success: true,
        key: key,
        combination: combinations[key]
    });
});

// Delete combination
app.delete('/api/combinations/:key', (req, res) => {
    const key = decodeURIComponent(req.params.key);
    
    if (combinations[key]) {
        delete combinations[key];
        saveCombinations();
        
        console.log(`🗑️ Deleted combination: ${key}`);
        
        broadcastUpdate('combination_deleted', { key: key });
        
        res.json({ success: true, message: 'Combination deleted' });
    } else {
        res.status(404).json({ error: 'Combination not found' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        combinations_count: Object.keys(combinations).length,
        sse_clients: sseClients.length
    });
});

// Add OPTIONS handler for preflight requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    res.sendStatus(200);
});

// Load combinations on startup
loadCombinations();

app.listen(PORT, () => {
    console.log(`🚀 SSE Server running on http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/events`);
    console.log(`🔍 Check combinations: http://localhost:${PORT}/api/check-combination?first=Fire&second=Water`);
    console.log(`🎨 Generate combinations: POST http://localhost:${PORT}/api/generate-combination`);
    console.log(`📊 View combinations: http://localhost:${PORT}/api/combinations`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
});
