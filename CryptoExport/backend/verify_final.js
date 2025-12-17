const https = require('https');

const CRITICAL_SYMBOLS = [
    'bitcoin', 'ethereum', 'polkadot', 'polygon', 'chainlink',
    'litecoin', 'stellar', 'monero', 'tron', 'cosmos',
    'near', 'uniswap', 'optimism', 'the_sandbox', 'decentraland',
    'axie_infinity', 'gala', 'avalanche', 'binance_coin',
    // Altri simboli comuni
    'ripple', 'cardano', 'solana', 'dogecoin', 'sand', 'mana', 'axs', 'xlm', 'atom'
];

function fetchSymbolData(symbol) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'ticket.logikaservice.it',
            path: `/api/crypto/bot-analysis?symbol=${symbol}`,
            method: 'GET',
            headers: { 'User-Agent': 'Node.js Verification' },
            timeout: 10000
        };

        const req = https.get(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve({ success: true, data });
                } catch (e) {
                    resolve({ success: false, error: 'Parse error' });
                }
            });
        });

        req.on('error', (e) => resolve({ success: false, error: e.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Timeout' });
        });
    });
}

async function main() {
    console.log('🔍 VERIFICA FINALE POST-DOWNLOAD\n');
    console.log('━'.repeat(100));
    console.log(`\n📊 Verifico ${CRITICAL_SYMBOLS.length} simboli critici...\n`);
    
    const results = {
        perfect: [],
        good: [],
        partial: [],
        empty: [],
        error: []
    };
    
    for (const symbol of CRITICAL_SYMBOLS) {
        process.stdout.write(`${symbol.padEnd(20)}...`);
        
        const response = await fetchSymbolData(symbol);
        
        if (!response.success) {
            console.log(` ❌ ${response.error}`);
            results.error.push({ symbol, error: response.error });
        } else {
            const data = response.data;
            const hasPrice = data.currentPrice && data.currentPrice > 0;
            const hasRsi = data.rsi !== null && data.rsi !== undefined;
            const hasSignal = data.signal && data.signal.strength !== undefined;
            const hasMtf = !!data.mtf;
            
            const score = [hasPrice, hasRsi, hasSignal, hasMtf].filter(Boolean).length;
            
            if (score === 4 && hasPrice && hasRsi && hasSignal) {
                console.log(` ✅ PERFETTO (Price: $${data.currentPrice.toFixed(4)}, RSI: ${data.rsi.toFixed(1)}, ${data.signal.direction})`);
                results.perfect.push({ symbol, ...data });
            } else if (score >= 3) {
                console.log(` ✅ OK (score: ${score}/4)`);
                results.good.push({ symbol, score });
            } else if (score >= 1) {
                console.log(` ⚠️  PARZIALE (score: ${score}/4)`);
                results.partial.push({ symbol, score });
            } else {
                console.log(` ❌ VUOTO`);
                results.empty.push({ symbol });
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n━'.repeat(100));
    console.log('\n📊 RIEPILOGO FINALE\n');
    
    console.log(`✅ PERFETTI (tutti i dati): ${results.perfect.length}`);
    console.log(`✅ OK (quasi tutti i dati): ${results.good.length}`);
    console.log(`⚠️  PARZIALI: ${results.partial.length}`);
    console.log(`❌ VUOTI: ${results.empty.length}`);
    console.log(`❌ ERRORI: ${results.error.length}`);
    console.log('');
    
    const totalOk = results.perfect.length + results.good.length;
    const percentage = ((totalOk / CRITICAL_SYMBOLS.length) * 100).toFixed(1);
    
    console.log(`📈 Percentuale successo: ${percentage}%`);
    console.log('');
    
    if (results.empty.length > 0) {
        console.log('❌ SIMBOLI ANCORA VUOTI:');
        results.empty.forEach(r => console.log(`   - ${r.symbol}`));
        console.log('');
    }
    
    if (results.partial.length > 0) {
        console.log('⚠️  SIMBOLI PARZIALI:');
        results.partial.forEach(r => console.log(`   - ${r.symbol} (score: ${r.score}/4)`));
        console.log('');
    }
    
    if (results.error.length > 0) {
        console.log('❌ ERRORI:');
        results.error.forEach(r => console.log(`   - ${r.symbol}: ${r.error}`));
        console.log('');
    }
    
    if (totalOk === CRITICAL_SYMBOLS.length) {
        console.log('🎉 PERFETTO! Tutti i simboli hanno dati completi!');
        console.log('✅ Il bot è completamente reattivo e pronto!');
    } else if (percentage >= 90) {
        console.log('✅ OTTIMO! La maggior parte dei simboli è OK');
        console.log(`   Solo ${CRITICAL_SYMBOLS.length - totalOk} simboli necessitano attenzione`);
    } else if (percentage >= 70) {
        console.log('⚠️  BUONO ma alcuni simboli necessitano klines');
    } else {
        console.log('❌ ATTENZIONE: Molti simboli ancora senza dati');
        console.log('   Verifica download klines e mapping simboli');
    }
    
    console.log('');
    console.log('━'.repeat(100));
}

main().catch(console.error);
