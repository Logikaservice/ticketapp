const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

// Parsing DATABASE_URL
let poolConfig = {};
if (process.env.DATABASE_URL) {
    const match = process.env.DATABASE_URL.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (match) {
        poolConfig.user = decodeURIComponent(match[1]);
        poolConfig.password = decodeURIComponent(match[2]);
        poolConfig.host = match[3];
        poolConfig.port = parseInt(match[4]);
        poolConfig.database = match[5];

        if (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1') {
            poolConfig.ssl = false;
        } else {
            poolConfig.ssl = { rejectUnauthorized: false };
        }
    }
}

const pool = new Pool(poolConfig);

async function checkConadMercurio() {
    const client = await pool.connect();

    try {
        // Trova l'azienda Conad Mercurio
        const companyResult = await client.query(
            `SELECT id, name FROM companies WHERE name ILIKE '%Conad Mercurio%' LIMIT 1`
        );

        if (companyResult.rows.length === 0) {
            console.log('Azienda Conad Mercurio non trovata');
            return;
        }

        const company = companyResult.rows[0];
        console.log('=== CONAD MERCURIO - CONFRONTO DATI ===\n');
        console.log(`Azienda: ${company.name}\n`);

        // Dati KeePass
        const keepassResult = await client.query(
            `SELECT title, ip, mac_address, path FROM keepass_entries WHERE company_id = $1 ORDER BY title`,
            [company.id]
        );

        console.log('--- DATI KEEPASS ---');
        if (keepassResult.rows.length > 0) {
            keepassResult.rows.forEach((entry, idx) => {
                console.log(`${idx + 1}. ${entry.title || 'N/A'}`);
                console.log(`   IP: ${entry.ip || 'N/A'}`);
                console.log(`   MAC: ${entry.mac_address || 'N/A'}`);
                console.log(`   Path: ${entry.path || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('Nessun dato KeePass trovato\n');
        }

        // Dati rilevati dal portale
        const devicesResult = await client.query(
            `SELECT hostname, ip, mac_address, device_type, last_seen 
       FROM network_devices 
       WHERE company_id = $1 
       ORDER BY ip`,
            [company.id]
        );

        console.log('--- DATI RILEVATI DAL PORTALE ---');
        if (devicesResult.rows.length > 0) {
            devicesResult.rows.forEach((device, idx) => {
                console.log(`${idx + 1}. ${device.hostname || 'N/A'}`);
                console.log(`   IP: ${device.ip || 'N/A'}`);
                console.log(`   MAC: ${device.mac_address || 'N/A'}`);
                console.log(`   Tipo: ${device.device_type || 'N/A'}`);
                console.log(`   Ultimo rilevamento: ${device.last_seen || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('Nessun dispositivo rilevato\n');
        }

        // Confronto
        console.log('--- CONFRONTO E DIFFERENZE ---\n');

        const normalizeMAC = (mac) => mac ? mac.toLowerCase().replace(/[:-]/g, '') : '';

        const keepassIPs = new Set(keepassResult.rows.map(e => e.ip?.toLowerCase()).filter(Boolean));
        const keepassMACs = new Set(keepassResult.rows.map(e => normalizeMAC(e.mac_address)).filter(Boolean));

        const detectedIPs = new Set(devicesResult.rows.map(d => d.ip?.toLowerCase()).filter(Boolean));
        const detectedMACs = new Set(devicesResult.rows.map(d => normalizeMAC(d.mac_address)).filter(Boolean));

        // IP presenti in KeePass ma non rilevati
        const missingIPs = [...keepassIPs].filter(ip => !detectedIPs.has(ip));
        if (missingIPs.length > 0) {
            console.log('IP in KeePass ma NON rilevati:');
            missingIPs.forEach(ip => console.log(`  - ${ip}`));
            console.log('');
        }

        // IP rilevati ma non in KeePass
        const extraIPs = [...detectedIPs].filter(ip => !keepassIPs.has(ip));
        if (extraIPs.length > 0) {
            console.log('IP rilevati ma NON in KeePass:');
            extraIPs.forEach(ip => console.log(`  - ${ip}`));
            console.log('');
        }

        // MAC presenti in KeePass ma non rilevati
        const missingMACs = [...keepassMACs].filter(mac => !detectedMACs.has(mac));
        if (missingMACs.length > 0) {
            console.log('MAC in KeePass ma NON rilevati:');
            missingMACs.forEach(mac => console.log(`  - ${mac}`));
            console.log('');
        }

        // MAC rilevati ma non in KeePass
        const extraMACs = [...detectedMACs].filter(mac => !keepassMACs.has(mac));
        if (extraMACs.length > 0) {
            console.log('MAC rilevati ma NON in KeePass:');
            extraMACs.forEach(mac => console.log(`  - ${mac}`));
            console.log('');
        }

        // Corrispondenze
        const matchingIPs = [...keepassIPs].filter(ip => detectedIPs.has(ip));
        if (matchingIPs.length > 0) {
            console.log(`IP corrispondenti: ${matchingIPs.length}`);
            matchingIPs.forEach(ip => console.log(`  ✓ ${ip}`));
            console.log('');
        }

        const matchingMACs = [...keepassMACs].filter(mac => detectedMACs.has(mac));
        if (matchingMACs.length > 0) {
            console.log(`MAC corrispondenti: ${matchingMACs.length}`);
            matchingMACs.forEach(mac => console.log(`  ✓ ${mac}`));
            console.log('');
        }

        console.log('=== FINE CONFRONTO ===');

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkConadMercurio();
