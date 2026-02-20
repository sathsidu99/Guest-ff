const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PythonShell } = require('python-shell');

// Store generator state
let generatorProcess = null;
let logs = [];
let stats = {
    generated: 0,
    target: 0,
    rare: 0,
    couples: 0,
    activated: 0,
    failed: 0,
    speed: 0,
    is_running: false
};

// PythonShell options
const getPythonOptions = (config) => ({
    mode: 'text',
    pythonPath: 'python3',
    pythonOptions: ['-u'], // unbuffered output
    scriptPath: __dirname,
    args: [JSON.stringify(config)],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
});

exports.handler = async (event, context) => {
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // GET requests (polling)
    if (event.httpMethod === 'GET') {
        const { action } = event.queryStringParameters || {};
        
        switch(action) {
            case 'stats':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(stats)
                };
                
            case 'logs':
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(logs.slice(-50)) // Last 50 logs
                };
                
            case 'accounts':
                const { tab } = event.queryStringParameters;
                let accounts = [];
                
                // Read accounts from files
                try {
                    const basePath = path.join(__dirname, '..', '..', 'KNX');
                    
                    if (fs.existsSync(basePath)) {
                        const folderMap = {
                            'all': 'ACCOUNTS',
                            'rare': 'RARE_ACCOUNTS',
                            'couples': 'COUPLES_ACCOUNTS',
                            'activated': 'ACTIVATED'
                        };
                        
                        const folder = folderMap[tab];
                        if (folder) {
                            const folderPath = path.join(basePath, folder);
                            if (fs.existsSync(folderPath)) {
                                const files = fs.readdirSync(folderPath);
                                for (const file of files) {
                                    if (file.endsWith('.json')) {
                                        const data = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf8'));
                                        accounts = accounts.concat(data.slice(0, 50));
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error reading accounts:', error);
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(accounts.slice(0, 100))
                };
                
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }
    }

    // POST requests (control)
    if (event.httpMethod === 'POST') {
        const { action, config } = JSON.parse(event.body);

        if (action === 'start') {
            if (generatorProcess) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Generator already running' })
                };
            }

            stats.target = config.account_count;
            stats.is_running = true;
            
            // Start Python process
            const options = getPythonOptions(config);
            
            generatorProcess = new PythonShell('V7ACC.py', options);
            
            generatorProcess.on('message', (message) => {
                // Parse message and update stats
                logs.push({
                    message,
                    timestamp: new Date().toISOString(),
                    type: getLogType(message)
                });
                
                // Update stats from log messages
                updateStatsFromLog(message);
            });
            
            generatorProcess.on('stderr', (stderr) => {
                logs.push({
                    message: stderr,
                    timestamp: new Date().toISOString(),
                    type: 'error'
                });
            });
            
            generatorProcess.on('close', () => {
                generatorProcess = null;
                stats.is_running = false;
                logs.push({
                    message: 'Generator process finished',
                    timestamp: new Date().toISOString(),
                    type: 'info'
                });
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ status: 'success', message: 'Generator started' })
            };
        }

        if (action === 'stop') {
            if (generatorProcess) {
                generatorProcess.kill();
                generatorProcess = null;
                stats.is_running = false;
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ status: 'success', message: 'Generator stopped' })
            };
        }
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

// Helper function to determine log type
function getLogType(message) {
    if (message.includes('✅') || message.includes('success')) return 'success';
    if (message.includes('❌') || message.includes('error')) return 'error';
    if (message.includes('⚠️') || message.includes('warning')) return 'warning';
    if (message.includes('💎') || message.includes('rare')) return 'rare';
    if (message.includes('💑') || message.includes('couple')) return 'couple';
    if (message.includes('🔥') || message.includes('activate')) return 'activation';
    return 'info';
}

// Helper function to update stats from logs
function updateStatsFromLog(message) {
    // Update generated count
    const genMatch = message.match(/Registration (\d+)\/(\d+)/);
    if (genMatch) {
        stats.generated = parseInt(genMatch[1]);
        stats.target = parseInt(genMatch[2]);
    }
    
    // Update rare count
    if (message.includes('RARE ACCOUNT FOUND')) {
        stats.rare++;
    }
    
    // Update couples count
    if (message.includes('COUPLES ACCOUNT FOUND')) {
        stats.couples++;
    }
    
    // Update activated count
    const actMatch = message.match(/Activated! Total: (\d+)/);
    if (actMatch) {
        stats.activated = parseInt(actMatch[1]);
    }
    
    // Update failed count
    const failMatch = message.match(/Failed! Total failed: (\d+)/);
    if (failMatch) {
        stats.failed = parseInt(failMatch[1]);
    }
    
    // Limit logs size
    if (logs.length > 1000) {
        logs = logs.slice(-500);
    }
}
