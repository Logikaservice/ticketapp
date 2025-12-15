/**
 * 📥 Script per scaricare 2000 klines complete per TUTTI i simboli
 * Garantisce che ogni simbolo abbia dati sufficienti per il bot
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const { Pool } = require('pg');

// ✅ Pool database isolato per questo script
let pool;
function initDatabase() {
    if (pool) return pool;
    
    const dbUrl = process.env.DATABASE_URL_CRYPTO || process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('DATABASE_URL_CRYPTO o DATABASE_URL non configurato');
    }
    
    pool = new Pool({
        connectionString: dbUrl,
        max: 5, // Limita connessioni
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
    
    return pool;
}

// Wrapper per query
async function dbGet(query, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result.rows[0];
    } finally {
        client.release();
    }
}

async function dbRun(query, params) {
    const client = await pool.connect();
    try {
        await client.query(query, params);
    } finally {
        client.release();
    }
}

// ✅ Estrae simboli unici dal mapping (evita duplicati)
function getUniqueSymbols() {
    const fullMapping = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};
    
    // Crea mappa inversa: trading pair -> primo simbolo trovato
    const pairToSymbol = {};
    const uniqueSymbols = {};
    
    for (const [symbol, pair] of Object.entries(fullMapping)) {
        // Usa solo simboli che finiscono con _usdt, _eur o sono nomi base (senza underscore)
        const isMainSymbol = symbol.includes('_usdt') || symbol.includes('_eur') || 
                            (!symbol.includes('_') && !symbol.includes('usdt') && !symbol.includes('eur'));
        
        if (isMainSymbol && !pairToSymbol[pair]) {
            pairToSymbol[pair] = symbol;
            uniqueSymbols[symbol] = pair;
        }
    }
    
    return uniqueSymbols;
}

const SYMBOL_TO_PAIR = getUniqueSymbols();

const KLINE_INTERVAL = '15m';
const TARGET_KLINES = 2000; // Klines da scaricare per simbolo
const BATCH_SIZE = 1000; // Max per richiesta Binance
const REQUEST_DELAY = 200; // Delay tra richieste (ms) per evitare rate limit

function httpsGet(url, timeout = 20000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errorData.substring(0, 200)}`)));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error(`Request timeout after ${timeout}ms`)); });
        req.end();
    });
}

async function downloadKlinesForSymbol(symbol, tradingPair) {
    console.log(`\n📥 ${symbol} (${tradingPair}):`);
    
    try {
        // Calcola tempo necessario per 2000 klines
        // 2000 klines × 15 minuti = 30000 minuti = 500 ore = ~20.8 giorni
        const endTime = Date.now();
        const startTime = endTime - (TARGET_KLINES * 15 * 60 * 1000);
        
        let allKlines = [];
        let currentStartTime = startTime;
        let batchNum = 0;
        let totalDownloaded = 0;
        
        console.log(`   Periodo: ${new Date(startTime).toISOString()} → ${new Date(endTime).toISOString()}`);
        console.log(`   Target: ${TARGET_KLINES} klines`);
        
        while (allKlines.length < TARGET_KLINES && currentStartTime < endTime) {
            batchNum++;
            const limit = Math.min(BATCH_SIZE, TARGET_KLINES - allKlines.length);
            const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${KLINE_INTERVAL}&startTime=${currentStartTime}&limit=${limit}`;
            
            try {
                const klines = await httpsGet(url, 30000);
                
                if (!Array.isArray(klines) || klines.length === 0) {
                    console.log(`   ✅ Nessun altro dato disponibile`);
                    break;
                }
                
                // Valida e filtra klines
                const validKlines = klines.filter(k => {
                    const open = parseFloat(k[1]);
                    const high = parseFloat(k[2]);
                    const low = parseFloat(k[3]);
                    const close = parseFloat(k[4]);
                    
                    // Valida range prezzi
                    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return false;
                    if (open > 1000000 || high > 1000000 || low > 1000000 || close > 1000000) return false;
                    
                    // Valida logica OHLC
                    if (high < low || close > high || close < low) return false;
                    
                    return true;
                });
                
                allKlines.push(...validKlines);
                totalDownloaded += validKlines.length;
                
                const progress = ((allKlines.length / TARGET_KLINES) * 100).toFixed(1);
                process.stdout.write(`\r   Batch ${batchNum}: ${allKlines.length}/${TARGET_KLINES} klines (${progress}%)`);
                
                // Prossimo batch
                if (klines.length > 0) {
                    currentStartTime = parseInt(klines[klines.length - 1][0]) + 1;
                } else {
                    break;
                }
                
                // Evita rate limit
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
                
            } catch (error) {
                console.log(`\n   ⚠️  Errore batch ${batchNum}: ${error.message}`);
                if (allKlines.length > 0) {
                    console.log(`   ℹ️  Continuo con ${allKlines.length} klines già scaricate`);
                    break;
                } else {
                    throw error;
                }
            }
        }
        
        console.log(`\n   ✅ Scaricate ${allKlines.length} klines`);
        
        if (allKlines.length === 0) {
            throw new Error('Nessuna kline scaricata');
        }
        
        // ✅ OTTIMIZZAZIONE: Salva in batch per performance
        console.log(`   💾 Salvataggio nel database (batch insert)...`);
        
        const BATCH_INSERT_SIZE = 100; // Inserisci 100 klines alla volta
        let saved = 0;
        let updated = 0;
        let errors = 0;
        
        const client = await pool.connect();
        try {
            for (let i = 0; i < allKlines.length; i += BATCH_INSERT_SIZE) {
                const batch = allKlines.slice(i, i + BATCH_INSERT_SIZE);
                
                try {
                    // Prepara valori per batch insert
                    const values = [];
                    const placeholders = [];
                    let paramIndex = 1;
                    
                    for (const kline of batch) {
                        const ph = [];
                        for (let j = 0; j < 9; j++) {
                            ph.push(`$${paramIndex++}`);
                        }
                        placeholders.push(`(${ph.join(', ')})`);
                        
                        values.push(
                            symbol,
                            KLINE_INTERVAL,
                            parseInt(kline[0]),
                            parseFloat(kline[1]),
                            parseFloat(kline[2]),
                            parseFloat(kline[3]),
                            parseFloat(kline[4]),
                            parseFloat(kline[5]),
                            parseInt(kline[6])
                        );
                    }
                    
                    // Batch insert con ON CONFLICT
                    const query = `
                        INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                        VALUES ${placeholders.join(', ')}
                        ON CONFLICT (symbol, interval, open_time) 
                        DO UPDATE SET 
                            open_price = EXCLUDED.open_price,
                            high_price = EXCLUDED.high_price,
                            low_price = EXCLUDED.low_price,
                            close_price = EXCLUDED.close_price,
                            volume = EXCLUDED.volume,
                            close_time = EXCLUDED.close_time
                    `;
                    
                    await client.query(query, values);
                    saved += batch.length;
                    
                    // Progress
                    const progress = Math.min(i + BATCH_INSERT_SIZE, allKlines.length);
                    process.stdout.write(`\r   Salvataggio: ${progress}/${allKlines.length} (${((progress / allKlines.length) * 100).toFixed(1)}%)`);
                    
                } catch (error) {
                    // Fallback: inserisci una per una se batch fallisce
                    for (const kline of batch) {
                        try {
                            await client.query(
                                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                 ON CONFLICT (symbol, interval, open_time) 
                                 DO UPDATE SET 
                                     open_price = EXCLUDED.open_price,
                                     high_price = EXCLUDED.high_price,
                                     low_price = EXCLUDED.low_price,
                                     close_price = EXCLUDED.close_price,
                                     volume = EXCLUDED.volume,
                                     close_time = EXCLUDED.close_time`,
                                [
                                    symbol, KLINE_INTERVAL,
                                    parseInt(kline[0]), parseFloat(kline[1]), parseFloat(kline[2]),
                                    parseFloat(kline[3]), parseFloat(kline[4]), parseFloat(kline[5]),
                                    parseInt(kline[6])
                                ]
                            );
                            saved++;
                        } catch (e) {
                            errors++;
                        }
                    }
                }
            }
        } finally {
            client.release();
        }
        
        console.log(`\n   ✅ Salvate: ${saved} klines, ${errors} errori`);
        
        // Verifica finale
        const finalCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
            [symbol, KLINE_INTERVAL]
        );
        const finalKlines = parseInt(finalCount?.count || 0);
        
        console.log(`   📊 Totale klines nel database: ${finalKlines}`);
        
        return {
            success: true,
            downloaded: allKlines.length,
            saved,
            updated,
            errors,
            totalInDb: finalKlines
        };
        
    } catch (error) {
        console.error(`\n   ❌ ERRORE: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log('📥 DOWNLOAD 2000 KLINES PER TUTTI I SIMBOLI\n');
    console.log('='.repeat(80));
    
    // ✅ Inizializza database isolato
    console.log('\n🔌 Connessione al database...');
    initDatabase();
    console.log('✅ Database connesso\n');
    
    const symbols = Object.keys(SYMBOL_TO_PAIR);
    console.log(`\n📊 Simboli da processare: ${symbols.length}`);
    console.log(`🎯 Target: ${TARGET_KLINES} klines per simbolo`);
    console.log(`⏱️  Tempo stimato: ~${Math.ceil(symbols.length * 2)} minuti\n`);
    
    const results = {
        success: [],
        failed: [],
        totalDownloaded: 0,
        totalSaved: 0
    };
    
    const startTime = Date.now();
    
    for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const tradingPair = SYMBOL_TO_PAIR[symbol];
        
        console.log(`\n[${i + 1}/${symbols.length}] ${symbol.toUpperCase()}`);
        console.log('-'.repeat(80));
        
        const result = await downloadKlinesForSymbol(symbol, tradingPair);
        
        if (result.success) {
            results.success.push({
                symbol,
                downloaded: result.downloaded,
                saved: result.saved,
                totalInDb: result.totalInDb
            });
            results.totalDownloaded += result.downloaded;
            results.totalSaved += result.saved;
        } else {
            results.failed.push({
                symbol,
                error: result.error
            });
        }
        
        // Pausa tra simboli per evitare rate limit
        if (i < symbols.length - 1) {
            console.log(`\n   ⏳ Pausa 2 secondi prima del prossimo simbolo...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    // Riepilogo finale
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO FINALE\n');
    console.log('-'.repeat(80));
    
    console.log(`\n✅ Simboli completati: ${results.success.length}/${symbols.length}`);
    console.log(`❌ Simboli falliti: ${results.failed.length}/${symbols.length}`);
    console.log(`📥 Totale klines scaricate: ${results.totalDownloaded.toLocaleString()}`);
    console.log(`💾 Totale klines salvate (nuove): ${results.totalSaved.toLocaleString()}`);
    console.log(`⏱️  Tempo totale: ${minutes}m ${seconds}s`);
    
    if (results.success.length > 0) {
        console.log(`\n✅ SIMBOLI COMPLETATI:`);
        results.success.forEach(r => {
            console.log(`   • ${r.symbol}: ${r.downloaded} scaricate, ${r.totalInDb} totali nel DB`);
        });
    }
    
    if (results.failed.length > 0) {
        console.log(`\n❌ SIMBOLI FALLITI:`);
        results.failed.forEach(r => {
            console.log(`   • ${r.symbol}: ${r.error}`);
        });
    }
    
    // Verifica finale per simboli con < 2000 klines
    console.log(`\n🔍 Verifica simboli con < ${TARGET_KLINES} klines:`);
    const symbolsWithIssues = [];
    
    for (const symbol of symbols) {
        try {
            const count = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                [symbol, KLINE_INTERVAL]
            );
            const klinesCount = parseInt(count?.count || 0);
            
            if (klinesCount < TARGET_KLINES) {
                symbolsWithIssues.push({
                    symbol,
                    count: klinesCount,
                    missing: TARGET_KLINES - klinesCount
                });
            }
        } catch (error) {
            // Ignora errori
        }
    }
    
    if (symbolsWithIssues.length > 0) {
        console.log(`\n⚠️  ${symbolsWithIssues.length} simboli con < ${TARGET_KLINES} klines:`);
        symbolsWithIssues.forEach(s => {
            console.log(`   • ${s.symbol}: ${s.count} klines (mancano ${s.missing})`);
        });
    } else {
        console.log(`\n✅ Tutti i simboli hanno almeno ${TARGET_KLINES} klines!`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Download completato\n');
    
    // Chiudi connessioni
    try {
        if (pool && pool.end) {
            await pool.end();
            console.log('✅ Connessioni database chiuse');
        }
    } catch (e) {
        // Ignora
    }
    
    process.exit(0);
}

// Esegui
main().catch(error => {
    console.error('\n❌ ERRORE FATALE:', error);
    console.error(error.stack);
    process.exit(1);
});
