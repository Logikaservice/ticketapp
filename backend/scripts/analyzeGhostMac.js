// Script per analizzare il MAC "fantasma" DE:5F:88:B5:CF:E2
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function analyzeMac() {
    const targetMac = 'DE:5F:88:B5:CF:E2';

    console.log(`\n🔍 Analisi approfondita per MAC: ${targetMac}\n`);

    try {
        // 1. Cerca il dispositivo nella tabella network_devices (Normalizzando)
        console.log('--- 1. Ricerca in network_devices ---');

        // Query singola esatta (sappiamo che è DE:5F:88:B5:CF:E2)
        const res = await pool.query("SELECT * FROM network_devices WHERE mac_address = $1", [targetMac]);
        if (res.rows.length > 0) {
            res.rows.forEach(r => {
                console.log(`  - ID: ${r.id}, AgentID: ${r.agent_id}, IP: ${r.ip_address}, MAC: "${r.mac_address}", Created: ${r.first_seen}`);
            });
        } else {
            console.log("  ⚠️ Nessun dispositivo trovato in network_devices!");
        }

        // 2. Analisi Cambiamenti (network_changes) per questo MAC
        console.log('\n--- 2. Ultimi 50 Cambiamenti (network_changes) per questo MAC ---');

        // Join con network_devices per filtrare per MAC
        // NOTA: Se il dispositivo è stato cancellato e ricreato, il ChangeLog potrebbe riferirsi a un device_id che ora non esiste più!
        // Quindi dobbiamo cercare anche per device_id orfani se possibile, ma non abbiamo storico device_id cancellati facilmente
        // Cerchiamo quindi nella tabella network_events se avessimo i dettagli JSON, ma siccome usiamo JOIN, vediamo solo quelli del device CORRENTE.

        // Ma aspetta: se vedo "Nuovo", vuol dire che è stato creato un record.
        // Se vedo TANTI "Nuovo", vuol dire che sono stati creati TANTI record diversi nel tempo?
        // Se il Device ID cambia nei log, allora viene cancellato e ricreato.
        // Se il Device ID è SEMPRE LO STESSO (es. 602), allora qualcos'altro non va.

        const changesRes = await pool.query(`
        SELECT nc.detected_at, nc.change_type, nc.device_id, nc.id as change_id, na.agent_name
        FROM network_changes nc
        LEFT JOIN network_devices nd ON nc.device_id = nd.id
        LEFT JOIN network_agents na ON nc.agent_id = na.id
        WHERE REPLACE(UPPER(nd.mac_address), ':', '') = REPLACE(UPPER($1), ':', '')
        ORDER BY nc.detected_at DESC 
        LIMIT 50
    `, [targetMac]);

        changesRes.rows.forEach(e => {
            // Formato compatto: Data | Tipo | DevID | ChangeID
            console.log(`${e.detected_at.toISOString().substr(0, 19)} | ${e.change_type.padEnd(12)} | DevID:${e.device_id} | CID:${e.change_id} | Agt:${e.agent_name}`);
        });


    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

analyzeMac();
