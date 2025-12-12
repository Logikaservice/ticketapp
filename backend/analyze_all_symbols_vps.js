const https = require('https');

// Lista simboli da analizzare
const SYMBOLS = [
    'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'cardano',
    'solana', 'polkadot', 'dogecoin', 'avalanche', 'polygon',
    'chainlink', 'litecoin', 'stellar', 'monero', 'tron',
    'cosmos', 'algorand', 'vechain', 'filecoin', 'tezos',
    'near', 'sand', 'mana', 'axs', 'gala',
    'ape', 'xlm', 'atom', 'ftm', 'uni'
];

const API_BASE = 'ticket.logikaservice.it';

function fetchSymbolData(symbol) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE,
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
                    reject(new Error(`Parse error for ${symbol}: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function analyzeSymbol(symbol) {
    try {
        const data = await fetchSymbolData(symbol);
        
        if (!data || !data.signal) {
            return null;
        }

        const { signal, requirements, risk, mtf } = data;
        
        // Calcola adjusted strength manualmente per verificare
        let calculatedAdjustedStrength = signal.strength;
        if (mtf && mtf.bonus !== undefined) {
            calculatedAdjustedStrength += mtf.bonus;
        }

        // Verifica consistenza calcoli
        const hasCalculationError = mtf && mtf.adjustedStrength !== undefined && 
                                    Math.abs(mtf.adjustedStrength - calculatedAdjustedStrength) > 0.1;

        return {
            symbol,
            direction: signal.direction,
            originalStrength: signal.strength,
            mtfBonus: mtf?.bonus || 0,
            adjustedStrength: mtf?.adjustedStrength || signal.strength,
            calculatedAdjusted: calculatedAdjustedStrength,
            hasError: hasCalculationError,
            trend1h: mtf?.trend1h || 'N/A',
            trend4h: mtf?.trend4h || 'N/A',
            minRequired: requirements?.minSignalStrength || 65,
            isReady: requirements?.signalStrength === 'ready',
            riskStatus: risk?.status || 'unknown',
            confirmations: requirements?.confirmations || 0,
            needsConfirmations: requirements?.needsConfirmations || 3,
            reason: requirements?.reason || signal.reason || 'N/A',
            riskReason: risk?.reason || ''
        };
    } catch (error) {
        console.error(`❌ Errore analisi ${symbol}:`, error.message);
        return null;
    }
}

async function analyzeAll() {
    console.log('🔍 ANALISI MASSIVA SIMBOLI (VPS)\n');
    console.log('━'.repeat(120));
    
    const results = [];
    
    // Analizza tutti i simboli
    for (const symbol of SYMBOLS) {
        process.stdout.write(`Analizzando ${symbol.padEnd(15)}...`);
        const result = await analyzeSymbol(symbol);
        if (result) {
            results.push(result);
            console.log(' ✓');
        } else {
            console.log(' ✗ (no data)');
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
    }

    console.log('\n━'.repeat(120));
    console.log('\n📊 RISULTATI ANALISI\n');

    // 1. SIMBOLI CON ERRORI DI CALCOLO
    const withErrors = results.filter(r => r.hasError);
    if (withErrors.length > 0) {
        console.log('🚨 ERRORI DI CALCOLO TROVATI:');
        withErrors.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase()}: Adjusted=${r.adjustedStrength}, Calcolato=${r.calculatedAdjusted} (diff: ${Math.abs(r.adjustedStrength - r.calculatedAdjusted).toFixed(2)})`);
        });
        console.log('');
    } else {
        console.log('✅ Nessun errore di calcolo trovato\n');
    }

    // 2. SIMBOLI PRONTI AD APRIRE (strength >= 65, risk OK)
    const readyToOpen = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired && 
        r.confirmations >= r.needsConfirmations &&
        r.riskStatus !== 'blocked'
    );

    if (readyToOpen.length > 0) {
        console.log('🚀 SIMBOLI PRONTI AD APRIRE:');
        readyToOpen.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength}/${r.minRequired} | Conferme: ${r.confirmations}/${r.needsConfirmations} | Risk: ${r.riskStatus}`);
        });
        console.log('');
    } else {
        console.log('⏳ Nessun simbolo pronto ad aprire al momento\n');
    }

    // 3. SIMBOLI QUASI PRONTI (strength 55-64, mancano 1-10 punti)
    const almostReady = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired - 10 && 
        r.adjustedStrength < r.minRequired
    );

    if (almostReady.length > 0) {
        console.log('⚡ SIMBOLI QUASI PRONTI (mancano <10 punti):');
        almostReady.forEach(r => {
            const missing = r.minRequired - r.adjustedStrength;
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength.toFixed(1)}/${r.minRequired} | Mancano: ${missing.toFixed(1)} | MTF: 1h=${r.trend1h}, 4h=${r.trend4h}`);
        });
        console.log('');
    }

    // 4. SIMBOLI CON SEGNALE FORTE MA BLOCCATI DA MTF
    const blockedByMTF = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.originalStrength >= 50 && 
        r.mtfBonus < -10
    );

    if (blockedByMTF.length > 0) {
        console.log('⚠️  SIMBOLI BLOCCATI DA MTF (segnale forte ma trend contrario):');
        blockedByMTF.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Original: ${r.originalStrength} → Adjusted: ${r.adjustedStrength} (MTF: ${r.mtfBonus})`);
            console.log(`      Trend: 1h=${r.trend1h}, 4h=${r.trend4h}`);
        });
        console.log('');
    }

    // 5. SIMBOLI CON CONFERME MANCANTI
    const needsConfirmations = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired && 
        r.confirmations < r.needsConfirmations
    );

    if (needsConfirmations.length > 0) {
        console.log('🎯 SIMBOLI CON STRENGTH OK MA MANCANO CONFERME:');
        needsConfirmations.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength}/${r.minRequired} ✓ | Conferme: ${r.confirmations}/${r.needsConfirmations} ✗`);
        });
        console.log('');
    }

    // 6. SIMBOLI BLOCCATI DA RISK
    const blockedByRisk = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired && 
        r.riskStatus === 'blocked'
    );

    if (blockedByRisk.length > 0) {
        console.log('🚫 SIMBOLI BLOCCATI DA RISK MANAGEMENT:');
        blockedByRisk.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength}/${r.minRequired} ✓ | Risk: BLOCKED`);
            console.log(`      Motivo: ${r.riskReason}`);
        });
        console.log('');
    }

    // 7. STATISTICHE GENERALI
    console.log('📈 STATISTICHE GENERALI:');
    console.log(`   Simboli analizzati: ${results.length}`);
    console.log(`   Segnali LONG: ${results.filter(r => r.direction === 'LONG').length}`);
    console.log(`   Segnali SHORT: ${results.filter(r => r.direction === 'SHORT').length}`);
    console.log(`   Segnali NEUTRAL: ${results.filter(r => r.direction === 'NEUTRAL').length}`);
    console.log(`   Media Strength: ${(results.reduce((sum, r) => sum + r.adjustedStrength, 0) / results.length).toFixed(1)}`);
    console.log(`   Trend 1h Bullish: ${results.filter(r => r.trend1h === 'bullish').length}`);
    console.log(`   Trend 1h Bearish: ${results.filter(r => r.trend1h === 'bearish').length}`);
    console.log('');

    // 8. TOP 10 PER STRENGTH
    const topByStrength = [...results]
        .sort((a, b) => b.adjustedStrength - a.adjustedStrength)
        .slice(0, 15);

    console.log('🏆 TOP 15 PER ADJUSTED STRENGTH (inclusi NEUTRAL):');
    topByStrength.forEach((r, i) => {
        const status = r.adjustedStrength >= r.minRequired ? '✓' : '✗';
        console.log(`   ${(i + 1).toString().padStart(2)}. ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(8)} | Strength: ${r.adjustedStrength.toFixed(1).padStart(5)}/${r.minRequired} ${status} | Trend 1h: ${r.trend1h.padEnd(8)}`);
    });
    console.log('');

    // 9. DISTRIBUZIONE MTF BONUS
    const avgMtfBonus = results.reduce((sum, r) => sum + r.mtfBonus, 0) / results.length;
    const positiveMtf = results.filter(r => r.mtfBonus > 0).length;
    const negativeMtf = results.filter(r => r.mtfBonus < 0).length;
    const neutralMtf = results.filter(r => r.mtfBonus === 0).length;

    console.log('📊 DISTRIBUZIONE MTF BONUS:');
    console.log(`   Media: ${avgMtfBonus.toFixed(2)}`);
    console.log(`   Positivi (+15 bonus): ${positiveMtf} simboli`);
    console.log(`   Negativi (-15 penalty): ${negativeMtf} simboli`);
    console.log(`   Neutri (0): ${neutralMtf} simboli`);
    console.log('');

    console.log('━'.repeat(120));
}

// Esegui analisi
analyzeAll().catch(console.error);
