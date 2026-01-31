// Script per analizzare e rimuovere duplicati Theorica in dettaglio
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const THEORICA_AGENT_ID = 11;

function normalizeMac(mac) {
    if (!mac) return null;
    return mac.trim().toUpperCase().replace(/[:\-\s.]/g, '');
}

function normalizeIp(ip) {
    if (!ip) return null;
    return ip.trim().replace(/[{}"]/g, '');
}

async function analyzeAndClean() {
    console.log(`\n🔍 === ANALISI DETTAGLIATA THEORICA (Agent ID ${THEORICA_AGENT_ID}) ===\n`);

    try {
        // Trova tutti i dispositivi
        const devicesResult = await pool.query(`
      SELECT id, ip_address, mac_address, hostname, status, last_seen
      FROM network_devices 
      WHERE agent_id = $1
      ORDER BY ip_address, mac_address
    `, [THEORICA_AGENT_ID]);

        console.log(`📊 Totale dispositivi: ${devicesResult.rows.length}\n`);

        // Analizza duplicati per IP+MAC
        const byIpMac = new Map();
        const byMac = new Map();
        const byIp = new Map();

        for (const device of devicesResult.rows) {
            const ip = normalizeIp(device.ip_address);
            const mac = normalizeMac(device.mac_address);

            // Raggruppa per IP+MAC
            if (ip && mac) {
                const key = `${ip}|${mac}`;
                if (!byIpMac.has(key)) {
                    byIpMac.set(key, []);
                }
                byIpMac.get(key).push(device);
            }

            // Raggruppa per MAC
            if (mac) {
                if (!byMac.has(mac)) {
                    byMac.set(mac, []);
                }
                byMac.get(mac).push(device);
            }

            // Raggruppa per IP
            if (ip) {
                if (!byIp.has(ip)) {
                    byIp.set(ip, []);
                }
                byIp.get(ip).push(device);
            }
        }

        // Mostra duplicati IP+MAC (stessi identici)
        console.log('🔴 === DUPLICATI ESATTI (stesso IP e MAC) ===\n');
        let exactDuplicates = 0;
        for (const [key, devices] of byIpMac.entries()) {
            if (devices.length > 1) {
                const [ip, mac] = key.split('|');
                console.log(`IP: ${ip}, MAC: ${mac} - ${devices.length} duplicati`);
                devices.forEach((d, i) => {
                    console.log(`  ${i === 0 ? '✅ Mantieni' : '❌ Elimina'}: ID=${d.id}, Hostname=${d.hostname || 'N/A'}, Status=${d.status}, LastSeen=${d.last_seen}`);
                });
                exactDuplicates += devices.length - 1;
                console.log('');
            }
        }
        console.log(`Totale duplicati esatti da rimuovere: ${exactDuplicates}\n`);

        // Mostra duplicati MAC (stesso MAC, IP diverso - multihoming)
        console.log('🟡 === STESSO MAC, IP DIVERSO (Multihoming) ===\n');
        let multihomingCount = 0;
        for (const [mac, devices] of byMac.entries()) {
            if (devices.length > 1) {
                const ips = [...new Set(devices.map(d => normalizeIp(d.ip_address)))];
                if (ips.length > 1) {
                    console.log(`MAC: ${mac} - ${devices.length} dispositivi con ${ips.length} IP diversi`);
                    devices.forEach(d => {
                        console.log(`  - IP: ${d.ip_address}, ID=${d.id}, Hostname=${d.hostname || 'N/A'}`);
                    });
                    multihomingCount++;
                    console.log('');
                }
            }
        }
        console.log(`Totale casi multihoming: ${multihomingCount}\n`);

        // Mostra duplicati IP (stesso IP, MAC diverso - anomalia)
        console.log('🟠 === STESSO IP, MAC DIVERSO (Anomalia) ===\n');
        let ipDuplicatesCount = 0;
        for (const [ip, devices] of byIp.entries()) {
            if (devices.length > 1) {
                const macs = [...new Set(devices.map(d => normalizeMac(d.mac_address)).filter(m => m))];
                if (macs.length > 1) {
                    console.log(`IP: ${ip} - ${devices.length} dispositivi con ${macs.length} MAC diversi`);
                    devices.forEach(d => {
                        console.log(`  - MAC: ${d.mac_address || 'N/A'}, ID=${d.id}, Hostname=${d.hostname || 'N/A'}`);
                    });
                    ipDuplicatesCount++;
                    console.log('');
                }
            }
        }
        console.log(`Totale anomalie IP: ${ipDuplicatesCount}\n`);

        // PULIZIA: Rimuovi solo duplicati esatti
        if (exactDuplicates > 0) {
            console.log('🧹 === INIZIO PULIZIA DUPLICATI ESATTI ===\n');

            let removed = 0;
            for (const [key, devices] of byIpMac.entries()) {
                if (devices.length > 1) {
                    // Ordina per last_seen DESC (mantieni il più recente)
                    devices.sort((a, b) => {
                        const dateA = a.last_seen ? new Date(a.last_seen) : new Date(0);
                        const dateB = b.last_seen ? new Date(b.last_seen) : new Date(0);
                        return dateB - dateA;
                    });

                    const keep = devices[0];
                    const toRemove = devices.slice(1);

                    console.log(`Mantengo ID=${keep.id}, rimuovo ${toRemove.length} duplicati`);

                    for (const dup of toRemove) {
                        // Aggiorna parent_device_id references
                        await pool.query(
                            'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                            [keep.id, dup.id]
                        );

                        // Elimina
                        await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
                        removed++;
                        console.log(`  ❌ Rimosso ID=${dup.id}`);
                    }
                }
            }

            console.log(`\n✅ Rimossi ${removed} duplicati esatti\n`);
        }

        // Statistiche finali
        const finalCount = await pool.query(
            'SELECT COUNT(*) FROM network_devices WHERE agent_id = $1',
            [THEORICA_AGENT_ID]
        );

        console.log(`📌 Dispositivi rimanenti: ${finalCount.rows[0].count}\n`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

analyzeAndClean();
