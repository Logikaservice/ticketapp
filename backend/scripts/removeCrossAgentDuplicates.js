// Script per rimuovere duplicati cross-agent
// Rimuove i dispositivi dell'agent più vecchio quando ci sono duplicati tra agent
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

function normalizeMac(mac) {
    if (!mac) return null;
    return mac.trim().toUpperCase().replace(/[:\-\s.]/g, '');
}

function normalizeIp(ip) {
    if (!ip) return null;
    return ip.trim().replace(/[{}"]/g, '');
}

async function removeCrossAgentDuplicates() {
    console.log('\n🧹 === RIMOZIONE DUPLICATI CROSS-AGENT ===\n');

    try {
        // Trova tutti i dispositivi
        const devicesResult = await pool.query(`
      SELECT nd.id, nd.agent_id, na.agent_name, nd.ip_address, nd.mac_address, 
             nd.hostname, nd.last_seen, na.created_at as agent_created_at
      FROM network_devices nd
      LEFT JOIN network_agents na ON nd.agent_id = na.id
      WHERE na.deleted_at IS NULL
      ORDER BY nd.ip_address, nd.mac_address
    `);

        console.log(`📊 Totale dispositivi: ${devicesResult.rows.length}\n`);

        // Raggruppa per IP+MAC
        const byIpMac = new Map();

        for (const device of devicesResult.rows) {
            const ip = normalizeIp(device.ip_address);
            const mac = normalizeMac(device.mac_address);

            if (ip && mac) {
                const key = `${ip}|${mac}`;
                if (!byIpMac.has(key)) {
                    byIpMac.set(key, []);
                }
                byIpMac.get(key).push(device);
            }
        }

        let totalRemoved = 0;

        console.log('🔍 === ANALISI DUPLICATI CROSS-AGENT ===\n');

        for (const [key, devices] of byIpMac.entries()) {
            if (devices.length > 1) {
                const [ip, mac] = key.split('|');

                // Verifica se sono su agent diversi
                const agentIds = [...new Set(devices.map(d => d.agent_id))];

                if (agentIds.length > 1) {
                    console.log(`\n🔄 IP: ${ip}, MAC: ${mac} - ${devices.length} dispositivi su ${agentIds.length} agent diversi`);

                    // Ordina per: 1) agent più recente, 2) last_seen più recente
                    devices.sort((a, b) => {
                        // Prima ordina per agent_created_at (agent più recente)
                        const agentDateA = a.agent_created_at ? new Date(a.agent_created_at) : new Date(0);
                        const agentDateB = b.agent_created_at ? new Date(b.agent_created_at) : new Date(0);

                        if (agentDateB.getTime() !== agentDateA.getTime()) {
                            return agentDateB - agentDateA;
                        }

                        // Poi ordina per last_seen
                        const lastSeenA = a.last_seen ? new Date(a.last_seen) : new Date(0);
                        const lastSeenB = b.last_seen ? new Date(b.last_seen) : new Date(0);
                        return lastSeenB - lastSeenA;
                    });

                    const keep = devices[0];
                    const toRemove = devices.slice(1);

                    console.log(`   ✅ Mantengo: ID=${keep.id}, Agent=${keep.agent_name} (${keep.agent_id}), Hostname=${keep.hostname || 'N/A'}`);

                    for (const dup of toRemove) {
                        console.log(`   ❌ Rimuovo: ID=${dup.id}, Agent=${dup.agent_name} (${dup.agent_id}), Hostname=${dup.hostname || 'N/A'}`);

                        // Aggiorna parent_device_id references
                        await pool.query(
                            'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                            [keep.id, dup.id]
                        );

                        // Elimina
                        await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
                        totalRemoved++;
                    }
                }
            }
        }

        console.log(`\n\n✅ === PULIZIA COMPLETATA ===`);
        console.log(`📊 Totale duplicati cross-agent rimossi: ${totalRemoved}\n`);

        // Statistiche finali
        const finalCount = await pool.query('SELECT COUNT(*) FROM network_devices');
        console.log(`📌 Dispositivi rimanenti: ${finalCount.rows[0].count}\n`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

removeCrossAgentDuplicates();
