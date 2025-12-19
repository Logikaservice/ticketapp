// Analisi requisiti bot per aprire posizioni
const https = require('https');
const http = require('http');

const symbol = process.argv[2] || 'ripple_eur';
const url = `http://localhost:3001/api/crypto/bot-analysis?symbol=${symbol}`;

const protocol = url.startsWith('https') ? https : http;

protocol.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            analyzeRequirements(json, symbol);
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});

function analyzeRequirements(data, symbol) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 ANALISI REQUISITI BOT - ${symbol.toUpperCase()}`);
    console.log('='.repeat(80));
    
    const signal = data.signal || {};
    const requirements = data.requirements || {};
    const blockers = data.blockers || {};
    const mtf = data.mtf || {};
    
    console.log(`\n🔍 SEGNALE ATTUALE:`);
    console.log(`   Direction: ${signal.direction || 'NEUTRAL'}`);
    console.log(`   Strength: ${signal.strength || 0}/100`);
    console.log(`   Confirmations: ${signal.confirmations || 0}`);
    
    // LONG Requirements
    const longReq = requirements.long || {};
    console.log(`\n📈 LONG REQUIREMENTS:`);
    console.log(`   Min Strength: ${longReq.minStrength || 70}`);
    console.log(`   Current Strength: ${longReq.currentStrength || 0}`);
    console.log(`   Needs Strength: ${longReq.needsStrength || 0} punti`);
    console.log(`   Min Confirmations: ${longReq.minConfirmations || 3}`);
    console.log(`   Current Confirmations: ${longReq.currentConfirmations || 0}`);
    console.log(`   Needs Confirmations: ${longReq.needsConfirmations || 0}`);
    console.log(`   Can Open: ${longReq.canOpen ? '✅ YES' : '❌ NO'}`);
    console.log(`   Reason: ${longReq.reason || 'N/A'}`);
    
    // SHORT Requirements
    const shortReq = requirements.short || {};
    console.log(`\n📉 SHORT REQUIREMENTS:`);
    console.log(`   Min Strength: ${shortReq.minStrength || 70}`);
    console.log(`   Current Strength: ${shortReq.currentStrength || 0}`);
    console.log(`   Needs Strength: ${shortReq.needsStrength || 0} punti`);
    console.log(`   Min Confirmations: ${shortReq.minConfirmations || 4}`);
    console.log(`   Current Confirmations: ${shortReq.currentConfirmations || 0}`);
    console.log(`   Needs Confirmations: ${shortReq.needsConfirmations || 0}`);
    console.log(`   Can Open: ${shortReq.canOpen ? '✅ YES' : '❌ NO'}`);
    console.log(`   Reason: ${shortReq.reason || 'N/A'}`);
    
    // MTF Analysis
    console.log(`\n🔭 MULTI-TIMEFRAME:`);
    console.log(`   Trend 1h: ${mtf.trend1h || 'neutral'}`);
    console.log(`   Trend 4h: ${mtf.trend4h || 'neutral'}`);
    if (mtf.long) {
        console.log(`   LONG Bonus: ${mtf.long.bonus >= 0 ? '+' : ''}${mtf.long.bonus}`);
        console.log(`   LONG Adjusted Strength: ${mtf.long.adjustedStrength || 0}/100`);
    }
    if (mtf.short) {
        console.log(`   SHORT Bonus: ${mtf.short.bonus >= 0 ? '+' : ''}${mtf.short.bonus}`);
        console.log(`   SHORT Adjusted Strength: ${mtf.short.adjustedStrength || 0}/100`);
    }
    
    // Blockers
    const longBlockers = blockers.long || [];
    const shortBlockers = blockers.short || [];
    console.log(`\n🚫 BLOCKERS:`);
    console.log(`   LONG Blockers: ${longBlockers.length}`);
    longBlockers.forEach((blocker, idx) => {
        console.log(`      ${idx + 1}. ${blocker.type}: ${blocker.reason} (${blocker.severity})`);
    });
    console.log(`   SHORT Blockers: ${shortBlockers.length}`);
    shortBlockers.forEach((blocker, idx) => {
        console.log(`      ${idx + 1}. ${blocker.type}: ${blocker.reason} (${blocker.severity})`);
    });
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 RIEPILOGO - COSA MANCA PER APRIRE POSIZIONI:`);
    console.log('='.repeat(80));
    
    if (signal.direction === 'LONG') {
        console.log(`\n📈 LONG:`);
        console.log(`   ✅ Strength: ${longReq.currentStrength || 0}/${longReq.minStrength || 70} ${longReq.needsStrength > 0 ? `(MANCANO ${longReq.needsStrength} punti)` : '(OK)'}`);
        console.log(`   ${longReq.currentConfirmations >= (longReq.minConfirmations || 3) ? '✅' : '❌'} Confirmations: ${longReq.currentConfirmations || 0}/${longReq.minConfirmations || 3} ${longReq.needsConfirmations > 0 ? `(MANCANO ${longReq.needsConfirmations})` : '(OK)'}`);
        console.log(`   ${mtf.long && mtf.long.adjustedStrength >= (longReq.minStrength || 70) ? '✅' : '❌'} Adjusted Strength (con MTF): ${mtf.long?.adjustedStrength || 0}/${longReq.minStrength || 70}`);
        if (longBlockers.length > 0) {
            console.log(`   ❌ Bloccato da: ${longBlockers.map(b => b.type).join(', ')}`);
        } else {
            console.log(`   ✅ Nessun blocker`);
        }
    } else if (signal.direction === 'SHORT') {
        console.log(`\n📉 SHORT:`);
        console.log(`   ✅ Strength: ${shortReq.currentStrength || 0}/${shortReq.minStrength || 70} ${shortReq.needsStrength > 0 ? `(MANCANO ${shortReq.needsStrength} punti)` : '(OK)'}`);
        console.log(`   ${shortReq.currentConfirmations >= (shortReq.minConfirmations || 4) ? '✅' : '❌'} Confirmations: ${shortReq.currentConfirmations || 0}/${shortReq.minConfirmations || 4} ${shortReq.needsConfirmations > 0 ? `(MANCANO ${shortReq.needsConfirmations})` : '(OK)'}`);
        console.log(`   ${mtf.short && mtf.short.adjustedStrength >= (shortReq.minStrength || 70) ? '✅' : '❌'} Adjusted Strength (con MTF): ${mtf.short?.adjustedStrength || 0}/${shortReq.minStrength || 70}`);
        if (shortBlockers.length > 0) {
            console.log(`   ❌ Bloccato da: ${shortBlockers.map(b => b.type).join(', ')}`);
        } else {
            console.log(`   ✅ Nessun blocker`);
        }
    } else {
        console.log(`\n⚠️ Segnale NEUTRAL - Nessuna direzione di trading attiva`);
        console.log(`   Il bot aspetta un segnale LONG o SHORT valido`);
    }
    
    // Indicators Analysis
    const indicators = signal.indicators || {};
    console.log(`\n📊 INDICATORI:`);
    console.log(`   RSI: ${indicators.rsi?.toFixed(2) || 'N/A'}`);
    console.log(`   Williams %R: ${indicators.williamsR?.toFixed(2) || 'N/A'}`);
    console.log(`   TSI: ${indicators.tsi?.toFixed(2) || 'N/A'}`);
    
    // Strength Contributions
    if (signal.direction === 'LONG' && longReq.strengthContributions && longReq.strengthContributions.length > 0) {
        console.log(`\n💪 LONG Strength Contributions:`);
        longReq.strengthContributions.forEach(contrib => {
            console.log(`   ${contrib.indicator}: +${contrib.points} punti`);
        });
    }
    if (signal.direction === 'SHORT' && shortReq.strengthContributions && shortReq.strengthContributions.length > 0) {
        console.log(`\n💪 SHORT Strength Contributions:`);
        shortReq.strengthContributions.forEach(contrib => {
            console.log(`   ${contrib.indicator}: +${contrib.points} punti`);
        });
    }
    
    console.log(`\n${'='.repeat(80)}\n`);
}

