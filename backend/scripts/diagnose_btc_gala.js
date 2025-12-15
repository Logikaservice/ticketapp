/**
 * 🔍 Script di diagnostica BTC vs GALA
 * Verifica perché GALA apre posizioni mentre BTC no
 */

const DataIntegrityService = require('../services/DataIntegrityService');
const { dbGet, dbAll } = require('../crypto_db');

const SYMBOL_TO_PAIR = {
    'bitcoin_usdt': 'BTCUSDT',
    'gala': 'GALAUSDT'
};

async function diagnose() {
    console.log('🔍 DIAGNOSTICA BTC vs GALA\n');
    console.log('=' .repeat(80));
    
    for (const symbol of ['bitcoin_usdt', 'gala']) {
        console.log(`\n\n📊 Analisi: ${symbol.toUpperCase()} (${SYMBOL_TO_PAIR[symbol]})`);
        console.log('-'.repeat(80));
        
        try {
            // 1. Verifica esistenza simbolo
            const symbolExists = await dbGet(
                `SELECT symbol, active FROM crypto_symbols WHERE symbol = $1`,
                [symbol]
            );
            
            if (!symbolExists) {
                console.log(`❌ PROBLEMA: Simbolo ${symbol} NON ESISTE nel database crypto_symbols!`);
                continue;
            }
            
            console.log(`✅ Simbolo esiste nel database`);
            console.log(`   Active: ${symbolExists.active}`);
            
            // 2. Conta klines
            const klinesCount = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'`,
                [symbol]
            );
            const kCount = parseInt(klinesCount?.count || 0);
            console.log(`\n📈 Klines (15m):`);
            console.log(`   Totale: ${kCount}`);
            console.log(`   Richieste: 50`);
            console.log(`   Status: ${kCount >= 50 ? '✅ SUFFICIENTE' : '❌ INSUFFICIENTE'}`);
            
            if (kCount > 0) {
                // Ultimo timestamp
                const lastKline = await dbGet(
                    `SELECT MAX(close_time) as last_time FROM klines WHERE symbol = $1 AND interval = '15m'`,
                    [symbol]
                );
                if (lastKline?.last_time) {
                    const lastTime = new Date(parseInt(lastKline.last_time));
                    const now = new Date();
                    const ageMinutes = Math.floor((now - lastTime) / 1000 / 60);
                    console.log(`   Ultimo aggiornamento: ${lastTime.toISOString()} (${ageMinutes} minuti fa)`);
                    if (ageMinutes > 30) {
                        console.log(`   ⚠️  Dati vecchi di ${ageMinutes} minuti!`);
                    }
                }
                
                // Verifica gap
                const gaps = await findGaps(symbol);
                if (gaps.length > 0) {
                    console.log(`   ⚠️  Gap trovati: ${gaps.length}`);
                    gaps.slice(0, 3).forEach(gap => {
                        console.log(`      - ${new Date(gap.from).toISOString()} -> ${new Date(gap.to).toISOString()} (${gap.missing} klines mancanti)`);
                    });
                } else {
                    console.log(`   ✅ Nessun gap temporale`);
                }
            }
            
            // 3. Conta price_history
            const priceCount = await dbGet(
                `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
                [symbol]
            );
            const pCount = parseInt(priceCount?.count || 0);
            console.log(`\n💰 Price History:`);
            console.log(`   Totale: ${pCount}`);
            console.log(`   Richieste: 50`);
            console.log(`   Status: ${pCount >= 50 ? '✅ SUFFICIENTE' : '❌ INSUFFICIENTE'}`);
            
            // 4. Test DataIntegrityService
            console.log(`\n🔍 Test DataIntegrityService:`);
            const dataIntegrity = new DataIntegrityService();
            const result = await dataIntegrity.verifyAndRegenerate(symbol);
            
            console.log(`   Valid: ${result.valid ? '✅ SI' : '❌ NO'}`);
            console.log(`   Klines count: ${result.klinesCount}`);
            console.log(`   Price history count: ${result.priceHistoryCount}`);
            console.log(`   Gaps: ${result.gaps}`);
            console.log(`   Regenerated: ${result.regenerated ? '🔄 SI' : 'NO'}`);
            
            if (result.issues && result.issues.length > 0) {
                console.log(`   ⚠️  Issues trovati:`);
                result.issues.forEach(issue => {
                    console.log(`      - ${issue}`);
                });
            }
            
            // 5. Test download Binance
            console.log(`\n🌐 Test connessione Binance:`);
            try {
                const https = require('https');
                const tradingPair = SYMBOL_TO_PAIR[symbol];
                const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=15m&limit=1`;
                
                const testResult = await new Promise((resolve, reject) => {
                    const req = https.get(url, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            if (res.statusCode === 200) {
                                try {
                                    const parsed = JSON.parse(data);
                                    resolve({ success: true, data: parsed });
                                } catch (e) {
                                    reject(new Error(`Parse error: ${e.message}`));
                                }
                            } else {
                                reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                            }
                        });
                    });
                    req.on('error', err => reject(err));
                    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
                    req.end();
                });
                
                if (testResult.success && testResult.data.length > 0) {
                    const kline = testResult.data[0];
                    const price = parseFloat(kline[4]);
                    console.log(`   ✅ Binance API OK`);
                    console.log(`   Prezzo attuale: $${price.toFixed(price < 1 ? 6 : 2)}`);
                } else {
                    console.log(`   ⚠️  Nessun dato ricevuto da Binance`);
                }
            } catch (error) {
                console.log(`   ❌ ERRORE Binance API: ${error.message}`);
            }
            
            // 6. Conclusione
            console.log(`\n📋 CONCLUSIONE:`);
            if (result.valid) {
                console.log(`   ✅ ${symbol.toUpperCase()} può essere tradato`);
            } else {
                console.log(`   ❌ ${symbol.toUpperCase()} BLOCCATO dal trading`);
                console.log(`   Motivo: Dati storici insufficienti o invalidi`);
                
                if (kCount < 50) {
                    console.log(`   🔧 SOLUZIONE: Scaricare almeno ${50 - kCount} klines da Binance`);
                }
                if (pCount < 50) {
                    console.log(`   🔧 SOLUZIONE: Sincronizzare price_history da klines`);
                }
            }
            
        } catch (error) {
            console.error(`❌ ERRORE durante analisi ${symbol}:`, error.message);
            console.error(error.stack);
        }
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ Diagnostica completata\n');
    process.exit(0);
}

async function findGaps(symbol) {
    const KLINE_INTERVAL_MS = 15 * 60 * 1000;
    
    const klines = await dbAll(
        `SELECT open_time FROM klines 
         WHERE symbol = $1 AND interval = '15m' 
         ORDER BY open_time ASC`,
        [symbol]
    );
    
    if (klines.length < 2) return [];
    
    const gaps = [];
    for (let i = 1; i < klines.length; i++) {
        const prevTime = parseInt(klines[i - 1].open_time);
        const currTime = parseInt(klines[i].open_time);
        const expectedTime = prevTime + KLINE_INTERVAL_MS;
        
        if (currTime - expectedTime > KLINE_INTERVAL_MS * 1.5) {
            gaps.push({
                from: prevTime,
                to: currTime,
                missing: Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS)
            });
        }
    }
    
    return gaps;
}

diagnose();
