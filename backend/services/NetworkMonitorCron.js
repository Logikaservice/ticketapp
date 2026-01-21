const cron = require('node-cron');
const telegramService = require('./TelegramService');

class NetworkMonitorCron {
    constructor(pool) {
        this.pool = pool;
        this.jobs = [];
        this.AGENT_OFFLINE_THRESHOLD_MINUTES = 10; // Soglia per considerare agent offline
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
          -- Evita falsi positivi da vecchi dati
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
                }
            }

        } catch (err) {
            console.error('❌ NetworkMonitorCron: Errore checkIPConflicts:', err.message);
        }
    }
}

module.exports = NetworkMonitorCron;
