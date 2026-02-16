// diagnoseMercurioAPI.js
// Diagnostica agent Conad Mercurio via API
// Uso: node scripts/diagnoseMercurioAPI.js

const https = require('https');
const http = require('http');

const BASE_URL = 'https://ticket.logikaservice.it';

// Credenziali tecnico per autenticazione
const EMAIL = 'info@logikaservice.it';
const PASSWORD = 'Logika000.';

function makeRequest(url, method = 'GET', token = null, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function diagnose() {
    try {
        console.log('=== DIAGNOSTICA AGENT CONAD MERCURIO (via API) ===\n');

        // 1. Login
        console.log('🔐 Login...');
        const loginResult = await makeRequest(`${BASE_URL}/api/login`, 'POST', null, {
            email: EMAIL,
            password: PASSWORD
        });

        if (!loginResult.token && !loginResult.success) {
            console.log('❌ Login fallito:', JSON.stringify(loginResult));
            return;
        }
        const token = loginResult.token;
        console.log('✅ Login riuscito\n');

        // 2. Lista agent network monitoring
        console.log('📡 Recupero lista agenti network...');
        const agents = await makeRequest(`${BASE_URL}/api/network-monitoring/agents`, 'GET', token);

        if (!Array.isArray(agents)) {
            console.log('Risposta agents:', JSON.stringify(agents).substring(0, 500));
            return;
        }

        const mercurio = agents.find(a =>
            (a.agent_name && a.agent_name.toLowerCase().includes('mercurio')) ||
            (a.azienda && a.azienda.toLowerCase().includes('mercurio'))
        );

        if (!mercurio) {
            console.log('❌ Agent Mercurio non trovato! Agenti disponibili:');
            agents.forEach(a => console.log(`   - ${a.agent_name} (${a.azienda || 'N/A'}) - Status: ${a.status}`));
            return;
        }

        console.log(`\n📡 AGENT MERCURIO TROVATO:`);
        console.log(`   ID: ${mercurio.id}`);
        console.log(`   Nome: ${mercurio.agent_name}`);
        console.log(`   Azienda: ${mercurio.azienda || 'N/A'}`);
        console.log(`   Status: ${mercurio.status}`);
        console.log(`   Ultimo heartbeat: ${mercurio.last_heartbeat}`);
        console.log(`   Versione: ${mercurio.version}`);
        console.log(`   Enabled: ${mercurio.enabled}`);

        if (mercurio.last_heartbeat) {
            const lastHb = new Date(mercurio.last_heartbeat);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastHb) / 60000);
            console.log(`   ⏱️  Ultimo heartbeat: ${diffMinutes} minuti fa`);
            if (diffMinutes > 10) {
                console.log(`   ⚠️  AGENT ATTUALMENTE OFFLINE (>10 min senza heartbeat)`);
            } else {
                console.log(`   ✅ AGENT ATTUALMENTE ONLINE`);
            }
        }
        console.log('');

        // 3. Prova a recuperare eventi agent
        console.log('--- EVENTI AGENT (se disponibili) ---');
        try {
            const events = await makeRequest(
                `${BASE_URL}/api/network-monitoring/agent-events/${mercurio.id}?limit=30`,
                'GET', token
            );

            if (Array.isArray(events) && events.length > 0) {
                console.log(`   Trovati ${events.length} eventi:`);
                for (const ev of events) {
                    const date = new Date(ev.created_at);
                    const time = date.toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
                    const details = ev.details ? (typeof ev.details === 'string' ? ev.details : JSON.stringify(ev.details)) : '';
                    console.log(`   ${(ev.event_type || '?').padEnd(15)} | ${time} | ${details.substring(0, 80)}`);
                }
            } else if (events && events.error) {
                console.log(`   Endpoint non disponibile: ${events.error}`);
            } else {
                console.log('   Nessun evento trovato');
            }
        } catch (e) {
            console.log(`   Errore recupero eventi: ${e.message}`);
        }
        console.log('');

        // 4. Mostra tutti gli agent per confronto
        console.log('--- TUTTI GLI AGENT (per confronto) ---');
        for (const a of agents) {
            const lastHb = a.last_heartbeat ? new Date(a.last_heartbeat) : null;
            const hbStr = lastHb ? lastHb.toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'N/A';
            const diffMin = lastHb ? Math.floor((new Date() - lastHb) / 60000) : '?';
            const icon = a.status === 'online' ? '🟢' : '🔴';
            console.log(`   ${icon} ${(a.agent_name || 'N/A').padEnd(25)} | ${a.status.padEnd(8)} | HB: ${hbStr} (${diffMin} min fa) | v${a.version || '?'}`);
        }

    } catch (err) {
        console.error('❌ Errore:', err.message);
    }
}

diagnose();
