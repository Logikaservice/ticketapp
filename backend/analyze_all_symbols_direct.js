const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Import delle funzioni di analisi
const { generateSignal } = require('./signal_generator');
const { calculateRisk } = require('./risk_manager');

const DB_PATH = path.join(__dirname, 'crypto_trading.db');

// Lista simboli da analizzare
const SYMBOLS = [
    'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'cardano',
    'solana', 'polkadot', 'dogecoin', 'avalanche', 'polygon',
    'chainlink', 'litecoin', 'stellar', 'monero', 'tron',
    'cosmos', 'algorand', 'vechain', 'filecoin', 'tezos',
    'near', 'sand', 'mana', 'axs', 'gala',
    'ape', 'xlm', 'atom', 'ftm', 'uni'
];

function dbGet(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function analyzeSymbol(db, symbol) {
    try {
        // Ottieni bot parameters
        const params = await dbGet(db, 'SELECT * FROM bot_parameters WHERE symbol = ?', [symbol]);
        if (!params || !params.is_active) {
            return null;
        }

        // Conta klines disponibili
        const klinesCount = await dbGet(db, 'SELECT COUNT(*) as count FROM klines WHERE symbol = ?', [symbol]);
        if (!klinesCount || klinesCount.count < 50) {
            return { symbol, error: `Solo ${klinesCount?.count || 0} klines (min 50)` };
        }

        // Genera segnale
        const signal = await generateSignal(symbol, db);
        if (!signal) {
            return { symbol, error: 'Segnale non generato' };
        }

        // Calcola rischio
        const risk = await calculateRisk(symbol, signal.direction, params);

        // Conta posizioni aperte
        const openPositions = await dbAll(db, 'SELECT * FROM positions WHERE symbol = ? AND status = ?', [symbol, 'open']);

        // MTF Analysis
        const trend1h = signal.trend1h || 'N/A';
        const trend4h = signal.trend4h || 'N/A';
        let mtfBonus = 0;
        
        if (signal.direction === 'LONG') {
            if (trend1h === 'bullish' && trend4h === 'bullish') {
                mtfBonus = 15;
            } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                mtfBonus = -15;
            }
        } else if (signal.direction === 'SHORT') {
            if (trend1h === 'bearish' && trend4h === 'bearish') {
                mtfBonus = 15;
            } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                mtfBonus = -15;
            }
        }

        const adjustedStrength = signal.strength + mtfBonus;
        const minRequired = params.min_signal_strength || 65;

        return {
            symbol,
            direction: signal.direction,
            originalStrength: signal.strength,
            mtfBonus,
            adjustedStrength,
            trend1h,
            trend4h,
            minRequired,
            confirmations: signal.confirmations || 0,
            needsConfirmations: 3,
            riskStatus: risk?.status || 'unknown',
            openPositionsCount: openPositions.length,
            maxPositions: params.max_positions || 3,
            klinesCount: klinesCount.count,
            reasons: signal.reasons || []
        };
    } catch (error) {
        return { symbol, error: error.message };
    }
}

async function main() {
    const db = new sqlite3.Database(DB_PATH);

    console.log('🔍 ANALISI MASSIVA SIMBOLI (Accesso Diretto DB)\n');
    console.log('━'.repeat(120));

    const results = [];
    const errors = [];

    for (const symbol of SYMBOLS) {
        process.stdout.write(`Analizzando ${symbol.padEnd(15)}...`);
        const result = await analyzeSymbol(db, symbol);
        
        if (result) {
            if (result.error) {
                errors.push(result);
                console.log(` ✗ (${result.error})`);
            } else {
                results.push(result);
                console.log(` ✓`);
            }
        } else {
            console.log(` ✗ (bot non attivo)`);
        }
    }

    console.log('\n━'.repeat(120));
    console.log('\n📊 RISULTATI ANALISI\n');

    // 1. SIMBOLI PRONTI AD APRIRE
    const readyToOpen = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired && 
        r.confirmations >= r.needsConfirmations &&
        r.riskStatus !== 'blocked' &&
        r.openPositionsCount < r.maxPositions
    );

    if (readyToOpen.length > 0) {
        console.log('🚀 SIMBOLI PRONTI AD APRIRE:');
        readyToOpen.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength}/${r.minRequired} | Conferme: ${r.confirmations}/${r.needsConfirmations} | Posizioni: ${r.openPositionsCount}/${r.maxPositions}`);
        });
        console.log('');
    } else {
        console.log('⏳ Nessun simbolo pronto ad aprire al momento\n');
    }

    // 2. SIMBOLI QUASI PRONTI (mancano <10 punti)
    const almostReady = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired - 10 && 
        r.adjustedStrength < r.minRequired
    );

    if (almostReady.length > 0) {
        console.log('⚡ SIMBOLI QUASI PRONTI (mancano <10 punti):');
        almostReady.forEach(r => {
            const missing = r.minRequired - r.adjustedStrength;
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength.toFixed(1)}/${r.minRequired} | Mancano: ${missing.toFixed(1)} | Trend: 1h=${r.trend1h}, 4h=${r.trend4h}`);
        });
        console.log('');
    }

    // 3. SIMBOLI BLOCCATI DA MTF
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

    // 4. SIMBOLI CON STRENGTH OK MA MANCANO CONFERME
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

    // 5. SIMBOLI CON POSIZIONI PIENE
    const maxPositionsReached = results.filter(r => 
        r.direction !== 'NEUTRAL' && 
        r.adjustedStrength >= r.minRequired && 
        r.openPositionsCount >= r.maxPositions
    );

    if (maxPositionsReached.length > 0) {
        console.log('🔒 SIMBOLI CON POSIZIONI AL MASSIMO:');
        maxPositionsReached.forEach(r => {
            console.log(`   ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength}/${r.minRequired} | Posizioni: ${r.openPositionsCount}/${r.maxPositions} (PIENO)`);
        });
        console.log('');
    }

    // 6. STATISTICHE GENERALI
    console.log('📈 STATISTICHE GENERALI:');
    console.log(`   Simboli analizzati: ${results.length}`);
    console.log(`   Bot attivi: ${results.length}`);
    console.log(`   Errori (dati insufficienti): ${errors.length}`);
    console.log(`   Segnali LONG: ${results.filter(r => r.direction === 'LONG').length}`);
    console.log(`   Segnali SHORT: ${results.filter(r => r.direction === 'SHORT').length}`);
    console.log(`   Segnali NEUTRAL: ${results.filter(r => r.direction === 'NEUTRAL').length}`);
    if (results.length > 0) {
        console.log(`   Media Strength: ${(results.reduce((sum, r) => sum + r.adjustedStrength, 0) / results.length).toFixed(1)}`);
        console.log(`   Trend 1h Bullish: ${results.filter(r => r.trend1h === 'bullish').length}`);
        console.log(`   Trend 1h Bearish: ${results.filter(r => r.trend1h === 'bearish').length}`);
    }
    console.log('');

    // 7. TOP 10 PER STRENGTH
    const topByStrength = [...results]
        .filter(r => r.direction !== 'NEUTRAL')
        .sort((a, b) => b.adjustedStrength - a.adjustedStrength)
        .slice(0, 10);

    console.log('🏆 TOP 10 PER ADJUSTED STRENGTH:');
    topByStrength.forEach((r, i) => {
        const status = r.adjustedStrength >= r.minRequired ? '✓' : '✗';
        console.log(`   ${(i + 1).toString().padStart(2)}. ${r.symbol.toUpperCase().padEnd(15)} ${r.direction.padEnd(6)} | Strength: ${r.adjustedStrength.toFixed(1).padStart(5)}/${r.minRequired} ${status} | Klines: ${r.klinesCount}`);
    });
    console.log('');

    // 8. ERRORI E PROBLEMI
    if (errors.length > 0) {
        console.log('❌ SIMBOLI CON ERRORI O DATI INSUFFICIENTI:');
        errors.forEach(e => {
            console.log(`   ${e.symbol.toUpperCase().padEnd(15)}: ${e.error}`);
        });
        console.log('');
    }

    // 9. DISTRIBUZIONE MTF BONUS
    if (results.length > 0) {
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
    }

    console.log('━'.repeat(120));

    db.close();
}

main().catch(console.error);
