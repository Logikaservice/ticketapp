/**
 * PM2 Configuration for Klines Monitor Daemon (Monitoraggio Continuo)
 * 
 * ✅ Verifica gap ogni 15 minuti
 * ✅ Recupera automaticamente i dati mancanti
 * ✅ Monitoraggio continuo (non solo notturno)
 * 
 * Avvio:
 *   pm2 start ecosystem-klines-monitor.config.js --only klines-monitor
 *   
 * Visualizzare log:
 *   pm2 logs klines-monitor
 * 
 * Stop:
 *   pm2 stop klines-monitor
 */

module.exports = {
    apps: [
        {
            name: 'klines-monitor',
            script: './backend/klines_monitor_daemon.js',
            interpreter: 'node',
            autorestart: true, // Riavvia automaticamente se crasha
            max_restarts: 10,
            min_uptime: '10s',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/klines-monitor-error.log',
            out_file: './logs/klines-monitor-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: false,
            instances: 1,
            exec_mode: 'fork'
        }
    ]
};
