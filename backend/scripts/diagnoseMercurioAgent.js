// diagnoseMercurioAgent.js
// Diagnostica agent Conad Mercurio - analizza heartbeat e disconnessioni
// Uso: node scripts/diagnoseMercurioAgent.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false
});

async function diagnose() {
    try {
        console.log('=== DIAGNOSTICA AGENT CONAD MERCURIO ===\n');

        // 1. Trova l'agent di Conad Mercurio
        const agentResult = await pool.query(`
            SELECT na.id, na.agent_name, na.status, na.last_heartbeat, na.version, 
                   na.enabled, na.created_at, u.azienda
            FROM network_agents na
            LEFT JOIN users u ON na.azienda_id = u.id
            WHERE na.agent_name ILIKE '%mercurio%' 
               OR u.azienda ILIKE '%mercurio%'
            ORDER BY na.id
        `);

        if (agentResult.rows.length === 0) {
            console.log('❌ Agent Mercurio non trovato nel database!');
            return;
        }

        for (const agent of agentResult.rows) {
            console.log(`📡 Agent trovato:`);
            console.log(`   ID: ${agent.id}`);
            console.log(`   Nome: ${agent.agent_name}`);
            console.log(`   Azienda: ${agent.azienda}`);
            console.log(`   Status attuale: ${agent.status}`);
            console.log(`   Ultimo heartbeat: ${agent.last_heartbeat}`);
            console.log(`   Versione: ${agent.version}`);
            console.log(`   Abilitato: ${agent.enabled}`);
            console.log('');

            const agentId = agent.id;

            // 2. Ultimi eventi agent (online/offline)
            console.log('--- ULTIMI 20 EVENTI AGENT (online/offline) ---');
            try {
                const events = await pool.query(`
                    SELECT event_type, created_at, details
                    FROM network_agent_events
                    WHERE agent_id = $1
                    ORDER BY created_at DESC
                    LIMIT 20
                `, [agentId]);

                if (events.rows.length === 0) {
                    console.log('   Nessun evento trovato nella tabella network_agent_events');
                } else {
                    for (const ev of events.rows) {
                        const date = new Date(ev.created_at);
                        const time = date.toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
                        const details = ev.details ? JSON.stringify(ev.details) : '';
                        console.log(`   ${ev.event_type.padEnd(15)} | ${time} | ${details}`);
                    }
                }
            } catch (e) {
                console.log(`   Tabella network_agent_events non disponibile: ${e.message}`);
            }
            console.log('');

            // 3. Analisi orari disconnessione (pattern)
            console.log('--- PATTERN DISCONNESSIONI (ultimi 14 giorni) ---');
            try {
                const offlineEvents = await pool.query(`
                    SELECT 
                        created_at,
                        TO_CHAR(created_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD') as data,
                        TO_CHAR(created_at AT TIME ZONE 'Europe/Rome', 'HH24:MI:SS') as ora,
                        details
                    FROM network_agent_events
                    WHERE agent_id = $1
                      AND event_type = 'offline'
                      AND created_at > NOW() - INTERVAL '14 days'
                    ORDER BY created_at DESC
                `, [agentId]);

                if (offlineEvents.rows.length === 0) {
                    console.log('   Nessuna disconnessione negli ultimi 14 giorni (nella tabella eventi)');
                } else {
                    console.log(`   Trovate ${offlineEvents.rows.length} disconnessioni:`);
                    for (const ev of offlineEvents.rows) {
                        console.log(`   📅 ${ev.data}  🕐 ${ev.ora}`);
                    }

                    // Analizza pattern orario
                    const hours = offlineEvents.rows.map(e => {
                        const d = new Date(e.created_at);
                        // Converti in ora locale italiana
                        return parseInt(e.ora.split(':')[0]) + parseInt(e.ora.split(':')[1]) / 60;
                    });
                    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
                    const avgH = Math.floor(avgHour);
                    const avgM = Math.round((avgHour - avgH) * 60);
                    console.log(`\n   ⏱️  Orario medio disconnessione: ${avgH.toString().padStart(2, '0')}:${avgM.toString().padStart(2, '0')}`);
                }
            } catch (e) {
                console.log(`   Errore query eventi offline: ${e.message}`);
            }
            console.log('');

            // 4. Cambio di status nel cron (network_agents) - guarda i cambiamenti recenti
            console.log('--- STORICO CAMBIO STATUS (network_changes se disponibile) ---');
            try {
                const changes = await pool.query(`
                    SELECT change_type, detected_at, details
                    FROM network_changes
                    WHERE agent_id = $1
                      AND change_type IN ('device_offline', 'device_online')
                      AND detected_at > NOW() - INTERVAL '7 days'
                    ORDER BY detected_at DESC
                    LIMIT 10
                `, [agentId]);

                if (changes.rows.length > 0) {
                    for (const ch of changes.rows) {
                        const time = new Date(ch.detected_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
                        console.log(`   ${ch.change_type.padEnd(15)} | ${time}`);
                    }
                } else {
                    console.log('   Nessun cambio di status trovato');
                }
            } catch (e) {
                console.log(`   Tabella non disponibile: ${e.message}`);
            }
            console.log('');

            // 5. Verifica se il cron job potrebbe essere la causa
            console.log('--- INFO CRON JOB (NetworkMonitorCron) ---');
            console.log(`   Soglia offline: AGENT_OFFLINE_THRESHOLD_MINUTES = 10 minuti`);
            console.log(`   Frequenza check: ogni 2 minuti`);
            console.log(`   Se l'agent non manda heartbeat per 10 min → viene segnato offline`);
            console.log(`   Heartbeat agent interval: ogni 5 minuti`);
            console.log('');

            // 6. Ultimo heartbeat e quanto tempo fa
            if (agent.last_heartbeat) {
                const lastHb = new Date(agent.last_heartbeat);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastHb) / 60000);
                const hbTime = lastHb.toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
                console.log(`--- STATO ATTUALE ---`);
                console.log(`   Ultimo heartbeat: ${hbTime} (${diffMinutes} minuti fa)`);
                if (diffMinutes > 10) {
                    console.log(`   ⚠️  AGENT ATTUALMENTE OFFLINE (>10 min senza heartbeat)`);
                } else {
                    console.log(`   ✅ AGENT ATTUALMENTE ONLINE`);
                }
            }
        }

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

diagnose();
