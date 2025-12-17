const http = require('http');

// Lista simboli da analizzare (primi 20 più importanti)
const SYMBOLS = [
    'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'cardano',
    'solana', 'polkadot', 'dogecoin', 'avalanche', 'polygon',
    'chainlink', 'litecoin', 'stellar', 'monero', 'tron',
    'cosmos', 'algorand', 'vechain', 'filecoin', 'tezos',
    'near', 'sand', 'mana', 'axs', 'gala',
    'ape', 'xlm', 'atom', 'ftm', 'uni'
];

const API_BASE = 'http://localhost:3001';

async function analyzeSymbol(symbol) {
    try {
        const url = `${API_BASE}/api/crypto/bot-analysis?symbol=${symbol}`;
        
        const data = await new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
        
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
            reason: requirements?.reason || signal.reason || 'N/A'
        };
    } catch (error) {
        console.error(`❌ Errore analisi ${symbol}:`, error.message);
        return null;
    }
}

async function analyzeAll() {
    console.log('🔍 ANALISI MASSIVA SIMBOLI\n');
    console.log('━'.repeat(120));
    
    const results = [];
    
    // Analizza tutti i simboli
    for (const symbol of SYMBOLS) {
        process.stdout.write(`Analizzando ${symbol}...`);
        const result = await analyzeSymbol(symbol);
        if (result) {
            results.push(result);
            console.log(' ✓');
        } else {
            console.log(' ✗ (no data)');
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
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
            console.log(`   ${r.symbol.toUpperCase()}: ${r.direction} | Strength: ${r.adjustedStrength}/${r.minRequired} | Conferme: ${r.confirmations}/${r.needsConfirmations} | Risk: ${r.riskStatus}`);
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
            console.log(`   ${r.symbol.toUpperCase()}: ${r.direction} | Strength: ${r.adjustedStrength}/${r.minRequired} | Mancano: ${missing.toFixed(1)} | MTF: 1h=${r.trend1h}, 4h=${r.trend4h}`);
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
            console.log(`   ${r.symbol.toUpperCase()}: ${r.direction} | Original: ${r.originalStrength} | MTF Bonus: ${r.mtfBonus} | Adjusted: ${r.adjustedStrength}`);
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
            console.log(`   ${r.symbol.toUpperCase()}: ${r.direction} | Strength: ${r.adjustedStrength}/${r.minRequired} ✓ | Conferme: ${r.confirmations}/${r.needsConfirmations} ✗`);
        });
        console.log('');
    }

    // 6. STATISTICHE GENERALI
    console.log('📈 STATISTICHE GENERALI:');
    console.log(`   Simboli analizzati: ${results.length}`);
    console.log(`   Segnali LONG: ${results.filter(r => r.direction === 'LONG').length}`);
    console.log(`   Segnali SHORT: ${results.filter(r => r.direction === 'SHORT').length}`);
    console.log(`   Segnali NEUTRAL: ${results.filter(r => r.direction === 'NEUTRAL').length}`);
    console.log(`   Media Strength: ${(results.reduce((sum, r) => sum + r.adjustedStrength, 0) / results.length).toFixed(1)}`);
    console.log(`   Trend 1h Bullish: ${results.filter(r => r.trend1h === 'bullish').length}`);
    console.log(`   Trend 1h Bearish: ${results.filter(r => r.trend1h === 'bearish').length}`);
    console.log('');

    // 7. TOP 10 PER STRENGTH
    const topByStrength = [...results]
        .filter(r => r.direction !== 'NEUTRAL')
        .sort((a, b) => b.adjustedStrength - a.adjustedStrength)
        .slice(0, 10);

    console.log('🏆 TOP 10 PER ADJUSTED STRENGTH:');
    topByStrength.forEach((r, i) => {
        const status = r.adjustedStrength >= r.minRequired ? '✓' : '✗';
        console.log(`   ${i + 1}. ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength.toFixed(1).padStart(5)}/${r.minRequired} ${status} | Conferme: ${r.confirmations}/${r.needsConfirmations}`);
    });
    console.log('');

    // 8. DISTRIBUZIONE MTF BONUS
    const avgMtfBonus = results.reduce((sum, r) => sum + r.mtfBonus, 0) / results.length;
    const positiveMtf = results.filter(r => r.mtfBonus > 0).length;
    const negativeMtf = results.filter(r => r.mtfBonus < 0).length;
    const neutralMtf = results.filter(r => r.mtfBonus === 0).length;

    console.log('📊 DISTRIBUZIONE MTF BONUS:');
    console.log(`   Media: ${avgMtfBonus.toFixed(2)}`);
    console.log(`   Positivi (+bonus): ${positiveMtf} simboli`);
    console.log(`   Negativi (-penalty): ${negativeMtf} simboli`);
    console.log(`   Neutri (0): ${neutralMtf} simboli`);
    console.log('');

    console.log('━'.repeat(120));
}

// Esegui analisi
analyzeAll().catch(console.error);
