// Verifica dispositivi con parent_device_id (AP collegati a Cloud Key)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkAPParent() {
    try {
        // Trova il Cloud Key (Ubiquiti)
        const cloudKey = await pool.query(`
            SELECT id, ip_address, mac_address, hostname
            FROM network_devices
            WHERE router_model LIKE '%Ubiquiti%' OR router_model LIKE '%UCK%'
            ORDER BY id
            LIMIT 5
        `);

        console.log('\n📡 === CLOUD KEY / CONTROLLER UBIQUITI ===\n');
        if (cloudKey.rows.length === 0) {
            console.log('❌ Nessun Cloud Key trovato');
            process.exit(0);
        }

        cloudKey.rows.forEach(ck => {
            console.log(`✅ ID: ${ck.id} | IP: ${ck.ip_address} | MAC: ${ck.mac_address} | Nome: ${ck.hostname || 'N/A'}`);
        });

        // Per ogni Cloud Key, mostra gli AP collegati
        for (const ck of cloudKey.rows) {
            const aps = await pool.query(`
                SELECT id, ip_address, mac_address, hostname, status, parent_device_id
                FROM network_devices
                WHERE parent_device_id = $1
                ORDER BY ip_address
            `, [ck.id]);

            console.log(`\n📶 === AP COLLEGATI AL CLOUD KEY ${ck.id} (${ck.ip_address}) ===\n`);
            if (aps.rows.length === 0) {
                console.log(`❌ Nessun AP trovato con parent_device_id=${ck.id}`);
                console.log(`   Possibili cause:`);
                console.log(`   1. L'analisi "Carica AP" non è stata completata`);
                console.log(`   2. I dispositivi esistono ma non hanno parent_device_id impostato`);
                console.log(`   3. L'agent ha trovato 0 dispositivi (credenziali errate, controller offline)`);
            } else {
                console.log(`✅ Trovati ${aps.rows.length} AP:\n`);
                aps.rows.forEach(ap => {
                    console.log(`   - ID: ${ap.id} | IP: ${ap.ip_address} | MAC: ${ap.mac_address} | Status: ${ap.status} | Nome: ${ap.hostname || 'N/A'}`);
                });
            }
        }

        console.log('\n');
        process.exit(0);
    } catch (err) {
        console.error('❌ Errore:', err);
        process.exit(1);
    }
}

checkAPParent();
