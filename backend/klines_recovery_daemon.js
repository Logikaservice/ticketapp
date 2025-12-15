#!/usr/bin/env node

/**
 * 🔄 KLINES RECOVERY DAEMON
 * 
 * Verifica integrità klines ogni notte (3:00 AM)
 * Se trova gap, recupera da Binance e ricostruisce il DB
 * Blocca aperture nuove durante il recovery
 * 
 * Uso: node klines_recovery_daemon.js
 * PM2: pm2 start klines_recovery_daemon.js --name klines-recovery --cron "0 3 * * *"
 */

const cryptoDb = require('./crypto_db');
const https = require('https');

// ===== CONFIGURAZIONE =====
const KLINE_INTERVAL = '15m'; // Timeframe da controllare
const LOOKBACK_DAYS = 7; // Ultimi 7 giorni
const BATCH_SIZE = 100; // Download 100 klines per volta da Binance
const REQUEST_TIMEOUT = 5000;

// ===== LOGGER =====
const log = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    warn: (msg) => console.log(`[${new Date().toISOString()}] ⚠️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
    recovery: (msg) => console.log(`[${new Date().toISOString()}] 🔄 ${msg}`)
};

// ===== SYSTEM STATUS =====
class SystemStatus {
    async init() {
        try {
            // Crea tabella se non esiste
            await cryptoDb.dbRun(`
                CREATE TABLE IF NOT EXISTS system_status (
                    id SERIAL PRIMARY KEY,
                    status_key VARCHAR(50) UNIQUE NOT NULL,
                    status_value TEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            log.success('Tabella system_status pronta');
        } catch (err) {
            log.error(`Errore creazione tabella system_status: ${err.message}`);
            throw err;
        }
    }

    async setRecoveryMode(enabled) {
        try {
            const timestamp = new Date().toISOString();
            await cryptoDb.dbRun(`
                INSERT INTO system_status (status_key, status_value, last_updated)
                VALUES ('klines_recovery_in_progress', $1, NOW())
                ON CONFLICT (status_key) 
                DO UPDATE SET status_value = $1, last_updated = NOW()
            `, [enabled ? 'true' : 'false']);
            
            const action = enabled ? 'ATTIVATO' : 'DISATTIVATO';
            log.recovery(`${action} blocco aperture nuove posizioni`);
        } catch (err) {
            log.error(`Errore nel settare recovery mode: ${err.message}`);
        }
    }

    async isRecoveryMode() {
        try {
            const result = await cryptoDb.dbGet(
                `SELECT status_value FROM system_status WHERE status_key = 'klines_recovery_in_progress'`
            );
            return result && result.status_value === 'true';
        } catch (err) {
            log.warn(`Errore lettura recovery mode: ${err.message}`);
            return false;
        }
    }
}

// ===== KLINES VERIFIER =====
class KlinesVerifier {
    constructor() {
        this.BINANCE_URL = 'https://api.binance.com/api/v3/klines';
        this.SYMBOL_MAP = {
            'bitcoin': 'BTCUSDT',
            'ethereum': 'ETHUSDT',
            'solana': 'SOLUSDT',
            'cardano': 'ADAUSDT',
            'ripple': 'XRPUSDT',
            'polkadot': 'DOTUSDT',
            'polkadot_usdt': 'DOTUSDT',
            'dogecoin': 'DOGEUSDT',
            'shiba_inu': 'SHIBUSDT',
            'binance_coin': 'BNBUSDT',
            'chainlink': 'LINKUSDT',
            'litecoin': 'LTCUSDT',
            'polygon': 'POLUSDT',
            'pol_polygon': 'POLUSDT',
            'avalanche': 'AVAXUSDT',
            'avax_usdt': 'AVAXUSDT',
            'stellar': 'XLMUSDT',
            'tron': 'TRXUSDT',
            'cosmos': 'ATOMUSDT',
            'uniswap': 'UNIUSDT',
            'optimism': 'OPUSDT',
            'the_sandbox': 'SANDUSDT',
            'sand': 'SANDUSDT',
            'decentraland': 'MANAUSDT',
            'mana': 'MANAUSDT',
            'axie_infinity': 'AXSUSDT',
            'axs': 'AXSUSDT',
            'bonk': 'BONKUSDT',
            'floki': 'FLOKIUSDT',
            'gala': 'GALAUSDT',
            'near': 'NEARUSDT',
            'render': 'RENDERUSDT'
        };
    }

    /**
     * Ottieni solo i simboli attivi dal DB
     */
    async getActiveSymbols() {
        try {
            const result = await cryptoDb.dbAll(`
                SELECT DISTINCT symbol FROM bot_settings 
                WHERE is_active = 1 
                ORDER BY symbol
            `);
            return result.map(r => r.symbol);
        } catch (err) {
            log.error(`Errore recupero simboli attivi: ${err.message}`);
            return [];
        }
    }

    /**
     * Verifica gap nelle klines di un simbolo
     */
    async checkGapsForSymbol(symbol) {
        try {
            const sevenDaysAgo = Date.now() - (LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
            
            // Recupera klines dal DB negli ultimi 7 giorni
            const result = await cryptoDb.dbAll(`
                SELECT open_time, close_time
                FROM klines
                WHERE symbol = $1 AND interval = $2 AND open_time >= $3
                ORDER BY open_time ASC
            `, [symbol, KLINE_INTERVAL, sevenDaysAgo]);

            const klines = result;
            if (klines.length === 0) {
                return { symbol, gaps: [], totalKlines: 0 };
            }

            // Calcola gap tra candele consecutive
            const gaps = [];
            for (let i = 1; i < klines.length; i++) {
                const prevCloseTime = klines[i - 1].close_time;
                const currentOpenTime = klines[i].open_time;
                
                // Intervallo atteso tra due candele 15m: 15 * 60 * 1000 = 900000 ms
                const expectedGap = 15 * 60 * 1000;
                const actualGap = currentOpenTime - prevCloseTime;

                if (actualGap > expectedGap * 1.5) { // Tolleranza del 50%
                    gaps.push({
                        startTime: new Date(prevCloseTime),
                        endTime: new Date(currentOpenTime),
                        missingKlines: Math.floor(actualGap / expectedGap) - 1
                    });
                }
            }

            return { symbol, gaps, totalKlines: klines.length };
        } catch (err) {
            log.error(`Errore verifica gap per ${symbol}: ${err.message}`);
            return { symbol, gaps: [], totalKlines: 0 };
        }
    }

    /**
     * Download klines da Binance
     */
    async downloadKlinesFromBinance(symbol, startTime, endTime) {
        return new Promise((resolve) => {
            const binanceSymbol = this.SYMBOL_MAP[symbol] || symbol.toUpperCase();
            const url = `${this.BINANCE_URL}?symbol=${binanceSymbol}&interval=${KLINE_INTERVAL}&startTime=${startTime}&endTime=${endTime}&limit=${BATCH_SIZE}`;

            const timeoutHandle = setTimeout(() => {
                log.warn(`Timeout download ${symbol} da Binance`);
                resolve([]);
            }, REQUEST_TIMEOUT);

            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timeoutHandle);
                    try {
                        const klines = JSON.parse(data);
                        if (Array.isArray(klines)) {
                            resolve(klines);
                        } else {
                            log.warn(`Risposta Binance non valida per ${symbol}`);
                            resolve([]);
                        }
                    } catch (err) {
                        log.warn(`Errore parsing JSON da Binance per ${symbol}: ${err.message}`);
                        resolve([]);
                    }
                });
            }).on('error', (err) => {
                clearTimeout(timeoutHandle);
                log.warn(`Errore download Binance per ${symbol}: ${err.message}`);
                resolve([]);
            });
        });
    }

    /**
     * Salva klines nel DB
     */
    async saveKlines(symbol, klines) {
        if (klines.length === 0) return 0;

        try {
            let savedCount = 0;
            
            for (const k of klines) {
                const openTime = parseInt(k[0]);
                const open = parseFloat(k[1]);
                const high = parseFloat(k[2]);
                const low = parseFloat(k[3]);
                const close = parseFloat(k[4]);
                const volume = parseFloat(k[5]);
                const closeTime = parseInt(k[6]);

                try {
                    await cryptoDb.dbRun(`
                        INSERT INTO klines 
                        (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (symbol, interval, open_time) 
                        DO UPDATE SET 
                            open_price = EXCLUDED.open_price,
                            high_price = EXCLUDED.high_price,
                            low_price = EXCLUDED.low_price,
                            close_price = EXCLUDED.close_price,
                            volume = EXCLUDED.volume,
                            close_time = EXCLUDED.close_time
                    `, [symbol, KLINE_INTERVAL, openTime, open, high, low, close, volume, closeTime]);
                    
                    savedCount++;
                } catch (err) {
                    log.warn(`Errore salvataggio kline ${symbol} @${new Date(openTime).toISOString()}: ${err.message}`);
                }
            }

            return savedCount;
        } catch (err) {
            log.error(`Errore batch save klines per ${symbol}: ${err.message}`);
            return 0;
        }
    }

    /**
     * Recupera gap per un simbolo da Binance
     */
    async recoverSymbolGaps(symbol) {
        const gapCheck = await this.checkGapsForSymbol(symbol);
        
        if (gapCheck.gaps.length === 0) {
            log.success(`${symbol}: OK (${gapCheck.totalKlines} klines trovate)`);
            return { symbol, recovered: 0, totalKlines: gapCheck.totalKlines };
        }

        log.recovery(`${symbol}: Trovati ${gapCheck.gaps.length} gap! Inizio recovery...`);
        let totalRecovered = 0;

        for (const gap of gapCheck.gaps) {
            const startTime = gap.startTime.getTime();
            const endTime = gap.endTime.getTime();

            log.recovery(`  Recuperando ${gap.missingKlines} klines da ${gap.startTime.toISOString()}`);
            
            // Download da Binance in batch
            let currentTime = startTime;
            while (currentTime < endTime) {
                const batchEnd = Math.min(currentTime + (BATCH_SIZE * 15 * 60 * 1000), endTime);
                const klines = await this.downloadKlinesFromBinance(symbol, currentTime, batchEnd);
                
                if (klines.length === 0) {
                    log.warn(`    Nessun dato da Binance per ${symbol} @ ${new Date(currentTime).toISOString()}`);
                    break;
                }

                const saved = await this.saveKlines(symbol, klines);
                totalRecovered += saved;
                log.recovery(`    ↳ Salvate ${saved} klines`);

                currentTime = batchEnd;
                
                // Rate limiting: Binance ha limiti di frequenza
                await new Promise(r => setTimeout(r, 200));
            }
        }

        log.success(`${symbol}: Recuperate ${totalRecovered} klines`);
        return { symbol, recovered: totalRecovered, totalKlines: gapCheck.totalKlines + totalRecovered };
    }
}

// ===== MAIN =====
async function main() {
    const status = new SystemStatus();
    const verifier = new KlinesVerifier();

    try {
        log.info('🌙 INIZIO VERIFICA NOTTURNA KLINES (3:00 AM)');
        
        // Init sistema
        await status.init();
        await status.setRecoveryMode(true);

        // Recupera simboli attivi
        const activeSymbols = await verifier.getActiveSymbols();
        if (activeSymbols.length === 0) {
            log.warn('Nessun simbolo attivo trovato');
            await status.setRecoveryMode(false);
            process.exit(0);
        }

        log.info(`Verificando ${activeSymbols.length} simboli attivi...`);
        
        // Verifica e recupera gap per ogni simbolo
        const results = [];
        for (const symbol of activeSymbols) {
            const result = await verifier.recoverSymbolGaps(symbol);
            results.push(result);
        }

        // Riassunto
        const totalRecovered = results.reduce((sum, r) => sum + r.recovered, 0);
        const totalKlines = results.reduce((sum, r) => sum + r.totalKlines, 0);

        log.success(`\n📊 RECOVERY COMPLETATO:`);
        log.success(`  • Simboli controllati: ${activeSymbols.length}`);
        log.success(`  • Klines recuperate: ${totalRecovered}`);
        log.success(`  • Total klines nel DB: ${totalKlines}`);

        // Disattiva blocco
        await status.setRecoveryMode(false);
        log.success('✅ Recovery completo - Bot tornato operativo');

    } catch (err) {
        log.error(`Errore fatale: ${err.message}`);
        log.error(err.stack);
        const status = new SystemStatus();
        await status.setRecoveryMode(false);
        process.exit(1);
    }
}

// Avvia se eseguito direttamente
if (require.main === module) {
    main().then(() => process.exit(0)).catch(err => {
        log.error(`Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { KlinesVerifier, SystemStatus };
