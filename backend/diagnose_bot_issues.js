/**
 * 🔍 Script di Diagnostica Bot
 * 
 * Analizza perché il bot non apre posizioni nonostante segnali positivi
 * Verifica:
 * 1. Segnali generati
 * 2. Filtri professionali
 * 3. Risk Manager
 * 4. Hybrid Strategy
 * 5. Requisiti minimi
 */

const { dbAll, dbGet } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');
const riskManager = require('./services/RiskManager');

async function getSymbolPrice(symbol) {
    const https = require('https');
    return new Promise((resolve, reject) => {
        // ✅ FIX: Normalizza simbolo per Binance
        let pair = symbol.toLowerCase();
        
        // Rimuovi _usdt e aggiungi USDT
        if (pair.includes('_usdt')) {
            pair = pair.replace('_usdt', '') + 'usdt';
        } else if (!pair.endsWith('usdt') && !pair.endsWith('eur')) {
            pair = pair + 'usdt';
        }
        
        // Converti in uppercase per Binance
        pair = pair.toUpperCase();
        
        // Mapping speciali
        const symbolMap = {
            'ETHEREUM': 'ETHUSDT',
            'BITCOIN': 'BTCUSDT',
            'AVAX_USDT': 'AVAXUSDT',
            'SAND': 'SANDUSDT',
            'UNISWAP': 'UNIUSDT'
        };
        
        if (symbolMap[symbol.toUpperCase()]) {
            pair = symbolMap[symbol.toUpperCase()];
        }
        
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.price) {
                        resolve(parseFloat(json.price));
                    } else {
                        reject(new Error(`Prezzo non trovato per ${pair}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function diagnoseSymbol(symbol) {
    console.log(`\n🔍 DIAGNOSTICA PER ${symbol.toUpperCase()}`);
    console.log('='.repeat(60));
    
    try {
        // 1. Prezzo corrente
        const currentPrice = await getSymbolPrice(symbol);
        console.log(`✅ Prezzo corrente: $${currentPrice.toFixed(2)}`);
        
        // 2. Recupera klines
        const klines = await dbAll(
            "SELECT open_time, open_price, high_price, low_price, close_price, volume FROM klines WHERE symbol = $1 AND interval = $2 ORDER BY open_time DESC LIMIT 100",
            [symbol, '15m']
        );
        
        if (klines.length === 0) {
            console.log(`❌ Nessuna kline trovata per ${symbol}`);
            return;
        }
        
        console.log(`✅ Klines trovate: ${klines.length}`);
        
        // 3. Prepara price history
        const priceHistory = klines.reverse().map(k => {
            // ✅ FIX: Gestisci correttamente open_time (può essere BIGINT o stringa)
            let timestamp;
            try {
                const openTime = k.open_time;
                if (typeof openTime === 'number') {
                    // Se è un numero (timestamp in millisecondi o secondi)
                    timestamp = new Date(openTime > 1000000000000 ? openTime : openTime * 1000).toISOString();
                } else if (typeof openTime === 'string') {
                    // Se è una stringa, prova a parsarla
                    const parsed = parseInt(openTime);
                    if (!isNaN(parsed)) {
                        timestamp = new Date(parsed > 1000000000000 ? parsed : parsed * 1000).toISOString();
                    } else {
                        // Se è già una stringa ISO, usala direttamente
                        timestamp = openTime;
                    }
                } else {
                    // Fallback: usa timestamp corrente
                    timestamp = new Date().toISOString();
                }
            } catch (e) {
                // Se fallisce, usa timestamp corrente
                timestamp = new Date().toISOString();
            }
            
            return {
                timestamp: timestamp,
                price: parseFloat(k.close_price) || 0,
                volume: parseFloat(k.volume || 0)
            };
        });
        
        // 4. Genera segnale
        console.log(`\n📊 GENERAZIONE SEGNALE...`);
        const params = await dbGet("SELECT * FROM bot_parameters WHERE symbol = $1", [symbol]).catch(() => null);
        const finalParams = params || {};
        const signal = signalGenerator.generateSignal(priceHistory, symbol, finalParams);
        
        if (!signal || signal.direction === 'NEUTRAL') {
            console.log(`❌ Nessun segnale generato (NEUTRAL)`);
            if (signal?.longSignal) {
                console.log(`   LONG: Strength ${signal.longSignal.strength}/60, Conferme ${signal.longSignal.confirmations}/3`);
                console.log(`   Motivi: ${signal.longSignal.reasons.slice(0, 3).join(', ')}`);
            }
            if (signal?.shortSignal) {
                console.log(`   SHORT: Strength ${signal.shortSignal.strength}/70, Conferme ${signal.shortSignal.confirmations}/4`);
                console.log(`   Motivi: ${signal.shortSignal.reasons.slice(0, 3).join(', ')}`);
            }
            return;
        }
        
        console.log(`✅ Segnale generato: ${signal.direction}`);
        console.log(`   Strength: ${signal.strength}/100`);
        console.log(`   Conferme: ${signal.confirmations}`);
        console.log(`   Motivi: ${signal.reasons.slice(0, 5).join(', ')}`);
        
        // 5. Verifica filtri professionali
        if (signal.professionalAnalysis?.filters) {
            const filters = signal.professionalAnalysis.filters[signal.direction.toLowerCase()] || [];
            if (filters.length > 0) {
                console.log(`\n⚠️ FILTRI PROFESSIONALI:`);
                filters.forEach(f => console.log(`   ${f}`));
            } else {
                console.log(`✅ Nessun filtro professionale bloccante`);
            }
        }
        
        // 6. Verifica requisiti minimi
        const minStrength = signal.direction === 'LONG' ? 60 : 70;
        const minConfirmations = signal.direction === 'LONG' ? 3 : 4;
        
        if (signal.strength < minStrength) {
            console.log(`❌ Strength insufficiente: ${signal.strength}/${minStrength}`);
        } else {
            console.log(`✅ Strength OK: ${signal.strength}/${minStrength}`);
        }
        
        if (signal.confirmations < minConfirmations) {
            console.log(`❌ Conferme insufficienti: ${signal.confirmations}/${minConfirmations}`);
        } else {
            console.log(`✅ Conferme OK: ${signal.confirmations}/${minConfirmations}`);
        }
        
        // 7. Verifica Risk Manager
        console.log(`\n💰 RISK MANAGER:`);
        const riskCheck = await riskManager.canOpenPosition(100);
        if (!riskCheck.allowed) {
            console.log(`❌ Risk Manager BLOCCA: ${riskCheck.reason}`);
        } else {
            console.log(`✅ Risk Manager OK`);
            console.log(`   Exposure disponibile: $${riskCheck.availableExposure?.toFixed(2) || 0}`);
        }
        
        // 8. Verifica Hybrid Strategy
        console.log(`\n🔄 HYBRID STRATEGY:`);
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        console.log(`   Posizioni aperte: ${openPositions.length}/8`);
        
        const symbolPositions = openPositions.filter(p => p.symbol === symbol).length;
        if (symbolPositions >= 2) {
            console.log(`❌ Max posizioni per simbolo raggiunto: ${symbolPositions}/2`);
        } else {
            console.log(`✅ Posizioni per simbolo OK: ${symbolPositions}/2`);
        }
        
        // 9. Verifica volume
        const volume24h = await dbAll(
            "SELECT volume_24h FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1",
            [symbol]
        ).catch(() => []);
        
        if (volume24h.length > 0 && volume24h[0].volume_24h < 500000) {
            console.log(`❌ Volume 24h insufficiente: $${volume24h[0].volume_24h.toLocaleString()}/$500,000`);
        } else {
            console.log(`✅ Volume 24h OK`);
        }
        
        // 10. Conclusione
        console.log(`\n📋 CONCLUSIONE:`);
        const canOpen = signal.strength >= minStrength && 
                       signal.confirmations >= minConfirmations &&
                       riskCheck.allowed &&
                       symbolPositions < 2 &&
                       openPositions.length < 8;
        
        if (canOpen) {
            console.log(`✅ TUTTI I REQUISITI SONO SODDISFATTI - Il bot DOVREBBE aprire la posizione`);
        } else {
            console.log(`❌ ALCUNI REQUISITI NON SONO SODDISFATTI - Il bot NON aprirà la posizione`);
        }
        
    } catch (error) {
        console.error(`❌ Errore durante diagnostica:`, error.message);
        console.error(error.stack);
    }
}

async function main() {
    const symbols = process.argv.slice(2);
    
    if (symbols.length === 0) {
        console.log('Uso: node diagnose_bot_issues.js <symbol1> [symbol2] ...');
        console.log('Esempio: node diagnose_bot_issues.js avax_usdt sand');
        return;
    }
    
    for (const symbol of symbols) {
        await diagnoseSymbol(symbol);
    }
}

main().catch(console.error);

