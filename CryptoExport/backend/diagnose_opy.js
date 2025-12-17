const https = require('https');

function fetchSymbolData(symbol) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ticket.logikaservice.it',
            path: `/api/crypto/bot-analysis?symbol=${symbol}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Node.js Analysis Script'
            }
        };

        https.get(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function analyzeOPY() {
    console.log('🔍 ANALISI DETTAGLIATA OPYUSDT\n');
    console.log('━'.repeat(100));
    
    // Prova diversi formati del nome simbolo
    const possibleNames = ['opyusdt', 'opy', 'op', 'optimism'];
    
    let data = null;
    let usedName = null;
    
    for (const name of possibleNames) {
        try {
            console.log(`Tentativo con: ${name}...`);
            data = await fetchSymbolData(name);
            if (data && data.signal) {
                usedName = name;
                console.log(`✅ Trovato con nome: ${name}\n`);
                break;
            }
        } catch (e) {
            // Continua con il prossimo nome
        }
    }
    
    if (!data || !data.signal) {
        console.log('❌ Nessun dato disponibile per OPYUSDT con nessuna variante');
        console.log('   Provato: ' + possibleNames.join(', '));
        return;
    }
    
    try {

        const { signal, requirements, risk, mtf, currentPrice, rsi } = data;
        
        console.log('\n📊 SITUAZIONE ATTUALE:');
        console.log(`   Prezzo: $${currentPrice}`);
        console.log(`   RSI: ${rsi?.toFixed(2) || 'N/A'}`);
        console.log('');
        
        console.log('🎯 SEGNALE:');
        console.log(`   Direzione: ${signal.direction}`);
        console.log(`   Original Strength: ${signal.strength}/100`);
        console.log(`   Confirmations: ${requirements?.confirmations || 0}/${requirements?.needsConfirmations || 3}`);
        console.log('');
        
        if (mtf) {
            console.log('⏰ MULTI-TIMEFRAME ANALYSIS:');
            console.log(`   Trend 1h: ${mtf.trend1h}`);
            console.log(`   Trend 4h: ${mtf.trend4h}`);
            console.log(`   MTF Bonus: ${mtf.bonus > 0 ? '+' : ''}${mtf.bonus}`);
            console.log(`   Adjusted Strength: ${signal.strength} + ${mtf.bonus} = ${mtf.adjustedStrength}`);
            console.log(`   Reason: ${mtf.reason || 'N/A'}`);
            console.log('');
        }
        
        console.log('💪 CONTRIBUTO INDICATORI (Original Strength):');
        if (signal.contributions && signal.contributions.length > 0) {
            signal.contributions.forEach(c => {
                const sign = c.points > 0 ? '+' : '';
                console.log(`   ${c.name.padEnd(25)} ${sign}${c.points.toFixed(1).padStart(6)} punti | ${c.reason}`);
            });
            const total = signal.contributions.reduce((sum, c) => sum + c.points, 0);
            console.log(`   ${''.padEnd(25)} --------`);
            console.log(`   ${'TOTALE'.padEnd(25)} ${total.toFixed(1).padStart(6)} punti`);
        } else {
            console.log('   Nessun dettaglio disponibile');
        }
        console.log('');
        
        console.log('✅ CONFERME OTTENUTE:');
        if (signal.confirmations_details && signal.confirmations_details.length > 0) {
            signal.confirmations_details.forEach(c => {
                console.log(`   ✓ ${c}`);
            });
        } else {
            console.log(`   ${requirements?.confirmations || 0} conferme generiche`);
        }
        console.log('');
        
        console.log('🎯 REQUISITI PER APERTURA:');
        console.log(`   Min Signal Strength: ${requirements?.minSignalStrength || 65}`);
        console.log(`   Adjusted Strength: ${mtf?.adjustedStrength || signal.strength}`);
        console.log(`   Status: ${requirements?.signalStrength || 'unknown'}`);
        
        const missing = (requirements?.minSignalStrength || 65) - (mtf?.adjustedStrength || signal.strength);
        if (missing > 0) {
            console.log(`   ⚠️  Mancano: ${missing.toFixed(1)} punti`);
        } else {
            console.log(`   ✅ Strength sufficiente!`);
        }
        console.log('');
        
        console.log('🛡️ RISK MANAGEMENT:');
        console.log(`   Status: ${risk?.status || 'unknown'}`);
        if (risk?.reason) {
            console.log(`   Reason: ${risk.reason}`);
        }
        console.log('');
        
        console.log('━'.repeat(100));
        console.log('\n💡 DIAGNOSI:');
        
        // Analisi del problema
        if (signal.strength < 30) {
            console.log('   🔴 PROBLEMA: Original Strength molto bassa (<30)');
            console.log('   📌 CAUSA: Gli indicatori tecnici non mostrano un segnale chiaro');
            console.log('');
            console.log('   Possibili motivi:');
            console.log('   - RSI in zona neutra (30-70) senza oversold/overbought');
            console.log('   - MACD senza crossover o divergenza chiara');
            console.log('   - EMA senza allineamento bullish/bearish');
            console.log('   - Volume insufficiente');
            console.log('   - Prezzo laterale senza trend definito');
        }
        
        if (mtf && mtf.bonus < 0) {
            console.log(`   ⚠️  MTF PENALTY: ${mtf.bonus} punti`);
            console.log(`   📌 CAUSA: Trend di timeframe superiori contrari al segnale`);
            console.log(`   - Trend 1h: ${mtf.trend1h}`);
            console.log(`   - Trend 4h: ${mtf.trend4h}`);
            console.log('');
            console.log('   Questo è un SISTEMA DI PROTEZIONE per evitare trade contro-trend rischiosi');
        }
        
        if (mtf && mtf.adjustedStrength < 0) {
            console.log('');
            console.log('   🚨 STRENGTH NEGATIVA = SEGNALE MOLTO DEBOLE + TREND CONTRARIO');
            console.log('   Il bot sta PROTEGGENDO il capitale da un trade ad alto rischio!');
        }
        
        console.log('');
        console.log('━'.repeat(100));
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

analyzeOPY();
