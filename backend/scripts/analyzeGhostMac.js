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
        console.log('--- 1. Ricerca in network_devices (con varie normalizzazioni) ---');

        const queries = [
            "SELECT * FROM network_devices WHERE mac_address = $1", // Esatto
            "SELECT * FROM network_devices WHERE UPPER(mac_address) = UPPER($1)", // Case insensitive
            "SELECT * FROM network_devices WHERE REPLACE(UPPER(mac_address), ':', '') = REPLACE(UPPER($1), ':', '')" // Senza separatori
        ];

        for (const q of queries) {
            const res = await pool.query(q, [targetMac]);
            if (res.rows.length > 0) {
                console.log(`\nRisultati per query: "${q}"`);
                res.rows.forEach(r => {
                    console.log(`  - ID: ${r.id}, AgentID: ${r.agent_id}, IP: ${r.ip_address}, MAC: "${r.mac_address}", FirstSeen: ${r.first_seen}, LastSeen: ${r.last_seen}, Status: ${r.status}`);
                });
            }
        }

        // 2. Verifica gli Agent coinvolti
        console.log('\n--- 2. Info sugli Agent che hanno rilevato questo MAC ---');
        const agentsRes = await pool.query(`
        SELECT DISTINCT na.id, na.agent_name, u.azienda, na.last_heartbeat, na.version
        FROM network_agents na
        JOIN network_devices nd ON nd.agent_id = na.id
        JOIN users u ON na.azienda_id = u.id
        WHERE REPLACE(UPPER(nd.mac_address), ':', '') = REPLACE(UPPER($1), ':', '')
    `, [targetMac]);

        agentsRes.rows.forEach(a => {
            console.log(`  - Agent ID: ${a.id}, Nome: "${a.agent_name}", Azienda: "${a.azienda}", LastHB: ${a.last_heartbeat}`);
        });

        if (agentsRes.rows.length === 0) {
            console.log("  ⚠️ Nessun agent trovato associato a questo MAC (forse il dispositivo non esiste più nel DB?)");

            // Cerchiamo TUTTI gli agent di "Conad La Torre"
            console.log('\n  -- Controllo Agent azienda "Conad La Torre" --');
            const companyAgents = await pool.query(`
            SELECT na.id, na.agent_name, u.azienda, na.last_heartbeat 
            FROM network_agents na
            JOIN users u ON na.azienda_id = u.id
            WHERE u.azienda ILIKE '%Conad La Torre%'
        `);
            companyAgents.rows.forEach(a => {
                console.log(`    -> Agent ID: ${a.id}, Nome: "${a.agent_name}", HB: ${a.last_heartbeat}`);
            });
        }

        // 3. Analisi Eventi recenti per questo MAC
        console.log('\n--- 3. Ultimi 20 Eventi per questo MAC/IP ---');
        // Cerchiamo eventi legati a questo MAC o IP
        const eventsRes = await pool.query(`
        SELECT * FROM network_events 
        WHERE (event_data::text ILIKE '%' || $1 || '%' OR event_data::text ILIKE '%192.168.1.128%')
        ORDER BY created_at DESC 
        LIMIT 20
    `, [targetMac]);

        eventsRes.rows.forEach(e => {
            let details = e.event_data;
            try {
                const json = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
                details = `MAC: ${json.mac_address}, IP: ${json.ip_address}`;
            } catch (err) { }
            console.log(`  - [${e.created_at.toISOString()}] Tipo: ${e.event_type}, AgentID: ${e.agent_id} -> ${details}`);
        });

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

analyzeMac();
