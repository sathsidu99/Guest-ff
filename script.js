// API Configuration
const API_BASE = '/.netlify/functions/generator';

// State
let isGenerating = false;
let currentTab = 'all';
let stats = {
    generated: 0,
    target: 100,
    rare: 0,
    couples: 0,
    activated: 0,
    failed: 0,
    speed: 0
};
let accounts = {
    all: [],
    rare: [],
    couples: [],
    activated: []
};
let pollingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    loadInitialData();
    startPolling();
    loadAccounts();
});

// Create particle background
function createParticles() {
    const particles = document.querySelector('.particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3}px;
            height: ${Math.random() * 3}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.3});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: float ${5 + Math.random() * 10}s linear infinite;
            pointer-events: none;
        `;
        particles.appendChild(particle);
    }
}

// Animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% { transform: translateY(0) translateX(0); }
        100% { transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px); }
    }
`;
document.head.appendChild(style);

// Load initial data
function loadInitialData() {
    addLog('KNX Generator v7.1 Netlify Edition', 'info');
    addLog('Configure settings and click "Start Generation" to begin', 'info');
    updateStats();
}

// Start generation
async function startGeneration() {
    const config = {
        region: document.getElementById('region').value,
        name_prefix: document.getElementById('name-prefix').value || 'KNX',
        password_prefix: document.getElementById('password-prefix').value || 'KNX',
        account_count: parseInt(document.getElementById('account-count').value) || 100,
        thread_count: parseInt(document.getElementById('thread-count').value) || 5,
        rarity_threshold: parseInt(document.getElementById('rarity-threshold').value) || 4,
        auto_activation: document.getElementById('auto-activation').checked,
        turbo_mode: document.getElementById('turbo-mode').checked
    };

    // Update target
    stats.target = config.account_count;
    updateStats();

    // Disable start button, enable stop button
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    isGenerating = true;

    addLog(`🚀 Starting generation...`, 'info');
    addLog(`📍 Region: ${config.region}`, 'info');
    addLog(`🎯 Target: ${config.account_count} accounts`, 'info');
    addLog(`⚡ Threads: ${config.thread_count}`, 'info');
    addLog(`🔥 Auto-activation: ${config.auto_activation ? 'ON' : 'OFF'}`, 'info');

    try {
        const response = await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start', config })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            addLog('✅ Generator started successfully', 'success');
            startPolling();
        } else {
            addLog('❌ Failed to start generator', 'error');
        }
    } catch (error) {
        addLog(`❌ Error: ${error.message}`, 'error');
        stopGeneration();
    }
}

// Stop generation
async function stopGeneration() {
    try {
        await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' })
        });
    } catch (error) {
        console.error('Stop error:', error);
    }

    isGenerating = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    addLog('⏹️ Generation stopped', 'warning');
}

// Start polling for updates
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        await fetchStats();
        await fetchLogs();
    }, 2000);
}

// Fetch stats
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}?action=stats`);
        const newStats = await response.json();
        
        stats = { ...stats, ...newStats };
        updateStats();
        
        // Update progress bar
        const progress = stats.target > 0 ? (stats.generated / stats.target) * 100 : 0;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;
        document.getElementById('progressCount').textContent = `${stats.generated}/${stats.target}`;
        
        // Update badges
        document.getElementById('rare-badge').textContent = stats.rare;
        document.getElementById('couples-badge').textContent = stats.couples;
        document.getElementById('activated-badge').textContent = stats.activated;
        
    } catch (error) {
        console.error('Stats fetch error:', error);
    }
}

// Fetch logs
async function fetchLogs() {
    try {
        const response = await fetch(`${API_BASE}?action=logs`);
        const logs = await response.json();
        
        logs.forEach(log => {
            if (log.message && log.message.trim()) {
                addLog(log.message, log.type || 'info');
            }
        });
    } catch (error) {
        console.error('Logs fetch error:', error);
    }
}

// Load accounts
async function loadAccounts() {
    try {
        const response = await fetch(`${API_BASE}?action=accounts&tab=${currentTab}`);
        accounts[currentTab] = await response.json();
        displayAccounts();
    } catch (error) {
        console.error('Accounts fetch error:', error);
    }
}

// Display accounts
function displayAccounts() {
    const grid = document.getElementById('accountsGrid');
    const accountList = accounts[currentTab] || [];
    
    if (accountList.length === 0) {
        grid.innerHTML = `<div class="no-accounts">No ${currentTab} accounts found</div>`;
        return;
    }
    
    grid.innerHTML = accountList.map(acc => `
        <div class="account-card ${acc.type || currentTab}">
            <div class="account-uid">${acc.uid || 'N/A'}</div>
            <div class="account-details">
                <div><i class="fas fa-user"></i> ${acc.name || 'N/A'}</div>
                <div><i class="fas fa-id-card"></i> ${acc.account_id || 'N/A'}</div>
                <div><i class="fas fa-key"></i> ${acc.password || 'N/A'}</div>
                <div><i class="fas fa-globe"></i> ${acc.region || 'N/A'}</div>
            </div>
            <div class="account-actions">
                <button class="copy-btn" onclick="copyAccount('${JSON.stringify(acc).replace(/'/g, "\\'")}')">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button class="view-btn" onclick="viewAccount('${acc.uid}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        </div>
    `).join('');
}

// Update stats display
function updateStats() {
    document.getElementById('stat-generated').textContent = stats.generated;
    document.getElementById('stat-target').textContent = `Target: ${stats.target}`;
    document.getElementById('stat-rare').text-content = stats.rare;
    document.getElementById('stat-couples').textContent = stats.couples;
    document.getElementById('stat-activated').textContent = stats.activated;
    document.getElementById('stat-failed').textContent = stats.failed;
    document.getElementById('stat-speed').textContent = `${stats.speed}/s`;
}

// Add log entry
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 100 logs
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Clear logs
function clearLogs() {
    document.getElementById('logContainer').innerHTML = `
        <div class="log-entry info">
            <span class="log-time">[SYSTEM]</span>
            <span class="log-message">Logs cleared</span>
        </div>
    `;
}

// Download logs
function downloadLogs() {
    const logs = [];
    document.querySelectorAll('#logContainer .log-entry').forEach(entry => {
        const time = entry.querySelector('.log-time')?.textContent || '';
        const message = entry.querySelector('.log-message')?.textContent || '';
        logs.push(`${time} ${message}`);
    });
    
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knx_logs_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
    a.click();
}

// Switch tab
function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadAccounts();
}

// Refresh accounts
function refreshAccounts() {
    loadAccounts();
    addLog('🔄 Accounts refreshed', 'info');
}

// Download current tab
function downloadCurrentTab() {
    const data = accounts[currentTab] || [];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knx_${currentTab}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
    a.click();
}

// Search accounts
function searchAccounts() {
    const searchTerm = document.getElementById('searchAccounts').value.toLowerCase();
    const filtered = accounts[currentTab].filter(acc => 
        JSON.stringify(acc).toLowerCase().includes(searchTerm)
    );
    
    displayFilteredAccounts(filtered);
}

// Display filtered accounts
function displayFilteredAccounts(filtered) {
    const grid = document.getElementById('accountsGrid');
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="no-accounts">No matching accounts</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(acc => `
        <div class="account-card ${acc.type || currentTab}">
            <div class="account-uid">${acc.uid || 'N/A'}</div>
            <div class="account-details">
                <div><i class="fas fa-user"></i> ${acc.name || 'N/A'}</div>
                <div><i class="fas fa-id-card"></i> ${acc.account_id || 'N/A'}</div>
                <div><i class="fas fa-key"></i> ${acc.password || 'N/A'}</div>
                <div><i class="fas fa-globe"></i> ${acc.region || 'N/A'}</div>
            </div>
            <div class="account-actions">
                <button class="copy-btn" onclick="copyAccount('${JSON.stringify(acc).replace(/'/g, "\\'")}')">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button class="view-btn" onclick="viewAccount('${acc.uid}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        </div>
    `).join('');
}

// Copy account
function copyAccount(accountJson) {
    const account = JSON.parse(accountJson);
    const text = `
UID: ${account.uid}
Password: ${account.password}
Account ID: ${account.account_id || 'N/A'}
Name: ${account.name}
Region: ${account.region}
    `.trim();
    
    navigator.clipboard.writeText(text).then(() => {
        addLog('✅ Account copied to clipboard', 'success');
    }).catch(() => {
        addLog('❌ Failed to copy', 'error');
    });
}

// View account
function viewAccount(uid) {
    const account = accounts[currentTab].find(a => a.uid === uid);
    if (account) {
        alert(JSON.stringify(account, null, 2));
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
});
