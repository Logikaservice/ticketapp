const cron = require('node-cron');
const telegramService = require('./TelegramService');

class NetworkMonitorCron {
    constructor(pool) {
        this.pool = pool;
        this.jobs = [];
        this.AGENT_OFFLINE_THRESHOLD_MINUTES = 10; // Soglia per considerare agent offline
    }

    async ensureNetworkChangesArchiveTable() {
        await this.pool.query(`ALTER TABLE network_changes ADD COLUMN IF NOT EXISTS notification_ip VARCHAR(45);`);
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS network_changes_archive (
              id SERIAL PRIMARY KEY,
              source_change_id INTEGER,
              agent_id INTEGER NOT NULL REFERENCES network_agents(id) ON DELETE CASCADE,
              change_type VARCHAR(50) NOT NULL,
              old_value TEXT,
              new_value TEXT,
              detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              notified BOOLEAN DEFAULT false,
              notification_ip VARCHAR(45),
              device_id_snapshot INTEGER,
              ip_address VARCHAR(45),
              mac_address VARCHAR(17),
              hostname TEXT,
              vendor TEXT,
              device_type VARCHAR(100),
              device_path TEXT,
              device_username TEXT,
              is_static BOOLEAN DEFAULT false,
              has_ping_failures BOOLEAN DEFAULT false,
              archived_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_network_changes_archive_detected_at ON network_changes_archive(detected_at DESC);`);
        await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_network_changes_archive_agent_id ON network_changes_archive(agent_id);`);
    }

    /**
     * Elimina dispositivi offline da > N giorni (default 7), dopo aver copiato gli eventi in network_changes_archive
     * così restano visibili in Eventi di rete. Dispositivi is_static esclusi.
     */
    async purgeStaleOfflineDevices() {
        const enabled = String(process.env.NETWORK_OFFLINE_PURGE_ENABLED || 'true').toLowerCase() !== 'false';
        if (!enabled) return;

        const days = Math.max(1, parseInt(process.env.NETWORK_OFFLINE_PURGE_DAYS || '7', 10) || 7);

        try {
            await this.ensureNetworkChangesArchiveTable();

            const sel = await this.pool.query(
                `
                SELECT id FROM network_devices
                WHERE status = 'offline'
                  AND COALESCE(is_static, false) = false
                  AND COALESCE(offline_since, last_seen) < NOW() - ($1::int * INTERVAL '1 day')
                `,
                [days]
            );

            const ids = sel.rows.map((r) => r.id);
            if (ids.length === 0) return;

            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');

                await client.query(
                    `
                    INSERT INTO network_changes_archive (
                      source_change_id, agent_id, change_type, old_value, new_value,
                      detected_at, notified, notification_ip,
                      device_id_snapshot, ip_address, mac_address, hostname, vendor, device_type,
                      device_path, device_username, is_static, has_ping_failures
                    )
                    SELECT
                      nc.id, nc.agent_id, nc.change_type, nc.old_value, nc.new_value,
                      nc.detected_at, nc.notified, nc.notification_ip,
                      nd.id, nd.ip_address, nd.mac_address, nd.hostname, nd.vendor, nd.device_type,
                      nd.device_path, nd.device_username, COALESCE(nd.is_static, false), COALESCE(nd.has_ping_failures, false)
                    FROM network_changes nc
                    INNER JOIN network_devices nd ON nc.device_id = nd.id
                    WHERE nd.id = ANY($1::int[])
                    `,
                    [ids]
                );

                const del = await client.query('DELETE FROM network_devices WHERE id = ANY($1::int[])', [ids]);
                await client.query('COMMIT');

                console.log(
                    `🧹 NetworkMonitorCron: purge offline > ${days}g — eliminati ${del.rowCount} dispositivi, ` +
                        `eventi archiviati per ${ids.length} device`
                );
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('❌ NetworkMonitorCron: Errore purgeStaleOfflineDevices:', err.message);
        }
    }

    // Avvia i cron jobs
    start() {
        console.log('🕒 NetworkMonitorCron: Avvio cron jobs...');

        // 1. Monitoraggio Agent Offline (Ogni 2 minuti)
        this.jobs.push(cron.schedule('*/2 * * * *', async () => {
            await this.checkAgentsOffline();
        }));

        // 2. Monitoraggio Conflitti IP (Ogni 5 minuti)
        this.jobs.push(cron.schedule('*/5 * * * *', async () => {
            await this.checkIPConflicts();
        }));

        // 3. Purge dispositivi offline vecchi (settimanale, domenica 03:15 — storico eventi in network_changes_archive)
        this.jobs.push(
            cron.schedule(
                '15 3 * * 0',
                async () => {
                    await this.purgeStaleOfflineDevices();
                },
                { timezone: process.env.TZ || 'Europe/Rome' }
            )
        );

        console.log('✅ NetworkMonitorCron: Cron jobs avviati');
    }

    // Ferma i cron jobs
    stop() {
        console.log('🛑 NetworkMonitorCron: Arresto cron jobs...');
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        console.log('✅ NetworkMonitorCron: Cron jobs arrestati');
    }

    // --- JOB 1: CHECK AGENTI OFFLINE ---
    async checkAgentsOffline() {
        try {
            // Trova agenti che non inviano heartbeat da > THRESHOLD
            const offlineAgents = await this.pool.query(`
        SELECT na.id, na.agent_name, na.last_heartbeat, na.azienda_id, na.status, u.azienda as azienda_name
        FROM network_agents na
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE na.last_heartbeat < NOW() - INTERVAL '${this.AGENT_OFFLINE_THRESHOLD_MINUTES} minutes'
          AND na.status = 'online'
          AND na.enabled = true
          AND na.deleted_at IS NULL
      `);

            if (offlineAgents.rows.length > 0) {
                console.log(`⚠️ NetworkMonitorCron: Rilevati ${offlineAgents.rows.length} agent offline`);

                for (const agent of offlineAgents.rows) {
                    // 1. Aggiorna stato nel DB
                    await this.pool.query(
                        "UPDATE network_agents SET status = 'offline' WHERE id = $1",
                        [agent.id]
                    );

                    // 2. Invia notifica Telegram
                    try {
                        const message = telegramService.formatAgentOfflineMessage(
                            agent.agent_name,
                            agent.last_heartbeat,
                            agent.azienda_name
                        );

                        await telegramService.sendMessage(message);
                        console.log(`TELEGRAM ALERT SENT: Agent ${agent.agent_name} offline`);
                    } catch (tErr) {
                        console.error(`Errore invio Telegram per agent ${agent.id}:`, tErr.message);
                    }
                }
            }
        } catch (err) {
            console.error('❌ NetworkMonitorCron: Errore checkAgentsOffline:', err.message);
        }
    }

    // --- JOB 2: CHECK CONFLITTI IP (Idea B) ---
    async checkIPConflicts() {
        try {
            // Cerca IP doppi nello stesso Agent (stesso IP, MAC diverso, entrambi online/recenti)
            const conflicts = await this.pool.query(`
        SELECT 
            d1.id as device_id,
            d1.agent_id, 
            d1.ip_address, 
            d1.mac_address as mac1, 
            d2.mac_address as mac2,
            na.agent_name,
            u.azienda as azienda_name
        FROM network_devices d1
        JOIN network_devices d2 ON d1.agent_id = d2.agent_id AND d1.ip_address = d2.ip_address
        JOIN network_agents na ON d1.agent_id = na.id
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE d1.id < d2.id
          AND d1.mac_address != d2.mac_address
          AND d1.status = 'online' AND d2.status = 'online'
          AND d1.last_seen > NOW() - INTERVAL '15 minutes'
          AND d2.last_seen > NOW() - INTERVAL '15 minutes'
      `);

            if (conflicts.rows.length > 0) {
                console.log(`⚠️ NetworkMonitorCron: Rilevati ${conflicts.rows.length} conflitti IP`);

                for (const conflict of conflicts.rows) {
                    const message = `⚠️ <b>CONFLITTO IP RILEVATO</b>
          
<b>Azienda:</b> ${conflict.azienda_name}
<b>Agent:</b> ${conflict.agent_name}
<b>IP Conteso:</b> ${conflict.ip_address}
<b>MAC 1:</b> ${conflict.mac1}
<b>MAC 2:</b> ${conflict.mac2}

Due dispositivi stanno usando lo stesso IP contemporaneamente!`;

                    await telegramService.sendMessage(message);

                    // Inserisci in network_changes così compare in Eventi di Rete
                    try {
                        await this.pool.query(`
                            INSERT INTO network_changes (device_id, agent_id, change_type, old_value, new_value)
                            VALUES ($1, $2, 'ip_conflict', $3, $4)
                        `, [
                            conflict.device_id,
                            conflict.agent_id,
                            conflict.mac1 || '',
                            conflict.mac2 || ''
                        ]);
                    } catch (insErr) {
                        console.error('NetworkMonitorCron: Errore inserimento evento ip_conflict:', insErr.message);
                    }
                }
            }

        } catch (err) {
            console.error('❌ NetworkMonitorCron: Errore checkIPConflicts:', err.message);
        }
    }
}

module.exports = NetworkMonitorCron;
