/**
 * PM2 Configuration for Klines Recovery Daemon
 * 
 * ✅ Verifica integrità klines ogni notte alle 3:00 AM
 * ✅ Recupera dati mancanti da Binance
 * ✅ Blocca aperture nuove durante il recovery
 * 
 * Avvio manuale:
 *   pm2 start ecosystem.config.js --only klines-recovery
 *   
 * Visualizzare log:
 *   pm2 logs klines-recovery
 */

module.exports = {
    apps: [
        {
            name: 'klines-recovery',
            script: './backend/klines_recovery_daemon.js',
            interpreter: 'node',
            autorestart: false, // Esecuzione singola, non autorestart
            cron_restart: '0 3 * * *', // Ogni giorno alle 3:00 AM
            env: {
                NODE_ENV: 'production',
                DB_USER: process.env.DB_USER || 'postgres',
                DB_PASSWORD: process.env.DB_PASSWORD || '',
                DB_HOST: process.env.DB_HOST || 'localhost',
                DB_PORT: process.env.DB_PORT || 5432,
                DB_NAME: process.env.DB_NAME || 'crypto_trading'
            },
            error_file: './logs/klines-recovery-error.log',
            out_file: './logs/klines-recovery-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: false
        }
    ]
};
