const https = require('https');

// Configurazione
const API_URL = 'https://ticket.logikaservice.it/api';
const EMAIL = 'admin@logikaservice.it'; // Modifica con le tue credenziali
const PASSWORD = 'admin'; // Modifica con la tua password

async function makeRequest(path, method = 'GET', token = null, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function checkConadMercurio() {
    try {
        // 1. Login
        console.log('🔐 Login in corso...');
        const loginResponse = await makeRequest('/login', 'POST', null, {
            email: EMAIL,
            password: PASSWORD
        });

        if (!loginResponse.token) {
            console.error('❌ Login fallito:', loginResponse);
            return;
        }

        const token = loginResponse.token;
        console.log('✅ Login effettuato con successo\n');

        // 2. Ottieni lista aziende
        console.log('📋 Recupero lista aziende...');
        const companies = await makeRequest('/companies', 'GET', token);

        const conadMercurio = companies.find(c => c.name && c.name.toLowerCase().includes('conad mercurio'));

        if (!conadMercurio) {
            console.log('❌ Azienda Conad Mercurio non trovata');
            console.log('Aziende disponibili:', companies.map(c => c.name).join(', '));
            return;
        }

        console.log(`✅ Trovata azienda: ${conadMercurio.name} (ID: ${conadMercurio.id})\n`);

        // 3. Ottieni dati KeePass
        console.log('🔑 Recupero dati KeePass...');
        const keepassData = await makeRequest(`/network-monitoring/keepass/${conadMercurio.id}`, 'GET', token);

        // 4. Ottieni dispositivi rilevati
        console.log('📡 Recupero dispositivi rilevati...');
        const devicesData = await makeRequest(`/network-monitoring/devices/${conadMercurio.id}`, 'GET', token);

        console.log('\n=== CONAD MERCURIO - CONFRONTO DATI ===\n');
        console.log(`Azienda: ${conadMercurio.name}\n`);

        // Dati KeePass
        console.log('--- DATI KEEPASS ---');
        if (keepassData && keepassData.length > 0) {
            keepassData.forEach((entry, idx) => {
                console.log(`${idx + 1}. ${entry.title || 'N/A'}`);
                console.log(`   IP: ${entry.ip || 'N/A'}`);
                console.log(`   MAC: ${entry.macAddress || entry.mac_address || 'N/A'}`);
                console.log(`   Path: ${entry.path || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('Nessun dato KeePass trovato\n');
        }

        // Dati rilevati
        console.log('--- DATI RILEVATI DAL PORTALE ---');
        if (devicesData && devicesData.length > 0) {
            devicesData.forEach((device, idx) => {
                console.log(`${idx + 1}. ${device.hostname || 'N/A'}`);
                console.log(`   IP: ${device.ip || 'N/A'}`);
                console.log(`   MAC: ${device.macAddress || device.mac_address || 'N/A'}`);
                console.log(`   Tipo: ${device.deviceType || device.device_type || 'N/A'}`);
                console.log(`   Ultimo rilevamento: ${device.lastSeen || device.last_seen || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('Nessun dispositivo rilevato\n');
        }

        // Confronto
        console.log('--- CONFRONTO E DIFFERENZE ---\n');

        const normalizeMAC = (mac) => mac ? mac.toLowerCase().replace(/[:-]/g, '') : '';

        const keepassIPs = new Set((keepassData || []).map(e => e.ip?.toLowerCase()).filter(Boolean));
        const keepassMACs = new Set((keepassData || []).map(e => normalizeMAC(e.macAddress || e.mac_address)).filter(Boolean));

        const detectedIPs = new Set((devicesData || []).map(d => d.ip?.toLowerCase()).filter(Boolean));
        const detectedMACs = new Set((devicesData || []).map(d => normalizeMAC(d.macAddress || d.mac_address)).filter(Boolean));

        // IP presenti in KeePass ma non rilevati
        const missingIPs = [...keepassIPs].filter(ip => !detectedIPs.has(ip));
        if (missingIPs.length > 0) {
            console.log('⚠️  IP in KeePass ma NON rilevati:');
            missingIPs.forEach(ip => console.log(`  - ${ip}`));
            console.log('');
        }

        // IP rilevati ma non in KeePass
        const extraIPs = [...detectedIPs].filter(ip => !keepassIPs.has(ip));
        if (extraIPs.length > 0) {
            console.log('⚠️  IP rilevati ma NON in KeePass:');
            extraIPs.forEach(ip => console.log(`  - ${ip}`));
            console.log('');
        }

        // MAC presenti in KeePass ma non rilevati
        const missingMACs = [...keepassMACs].filter(mac => !detectedMACs.has(mac));
        if (missingMACs.length > 0) {
            console.log('⚠️  MAC in KeePass ma NON rilevati:');
            missingMACs.forEach(mac => console.log(`  - ${mac}`));
            console.log('');
        }

        // MAC rilevati ma non in KeePass
        const extraMACs = [...detectedMACs].filter(mac => !keepassMACs.has(mac));
        if (extraMACs.length > 0) {
            console.log('⚠️  MAC rilevati ma NON in KeePass:');
            extraMACs.forEach(mac => console.log(`  - ${mac}`));
            console.log('');
        }

        // Corrispondenze
        const matchingIPs = [...keepassIPs].filter(ip => detectedIPs.has(ip));
        if (matchingIPs.length > 0) {
            console.log(`✅ IP corrispondenti: ${matchingIPs.length}`);
            matchingIPs.forEach(ip => console.log(`  ✓ ${ip}`));
            console.log('');
        }

        const matchingMACs = [...keepassMACs].filter(mac => detectedMACs.has(mac));
        if (matchingMACs.length > 0) {
            console.log(`✅ MAC corrispondenti: ${matchingMACs.length}`);
            matchingMACs.forEach(mac => console.log(`  ✓ ${mac}`));
            console.log('');
        }

        // Riepilogo
        console.log('=== RIEPILOGO ===');
        console.log(`Totale IP in KeePass: ${keepassIPs.size}`);
        console.log(`Totale IP rilevati: ${detectedIPs.size}`);
        console.log(`IP corrispondenti: ${matchingIPs.length}`);
        console.log(`IP mancanti: ${missingIPs.length}`);
        console.log(`IP extra: ${extraIPs.length}`);
        console.log('');
        console.log(`Totale MAC in KeePass: ${keepassMACs.size}`);
        console.log(`Totale MAC rilevati: ${detectedMACs.size}`);
        console.log(`MAC corrispondenti: ${matchingMACs.length}`);
        console.log(`MAC mancanti: ${missingMACs.length}`);
        console.log(`MAC extra: ${extraMACs.length}`);
        console.log('\n=== FINE CONFRONTO ===');

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error);
    }
}

checkConadMercurio();
