const https = require('https');

// Lista completa simboli da verificare (tutti quelli che compaiono nella dashboard)
const SYMBOLS_TO_CHECK = [
    // Top 20
    'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'cardano',
    'solana', 'polkadot', 'dogecoin', 'avalanche', 'polygon',
    'chainlink', 'litecoin', 'stellar', 'monero', 'tron',
    'cosmos', 'algorand', 'vechain', 'filecoin', 'tezos',
    
    // Altri popolari
    'near', 'sand', 'mana', 'axs', 'gala',
    'ape', 'xlm', 'atom', 'ftm', 'uni',
    
    // Varianti e altri
    'matic', 'dot', 'doge', 'link', 'ada',
    'bnb', 'xrp', 'ltc', 'trx', 'xlm',
    
    // Quello che ha dato problemi
    'op', 'opy', 'opyusdt', 'optimism'
];

function fetchSymbolData(symbol) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'ticket.logikaservice.it',
            path: `/api/crypto/bot-analysis?symbol=${symbol}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Node.js Analysis Script'
            },
            timeout: 8000
        };

        const req = https.get(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve({ success: true, data });
                } catch (e) {
                    resolve({ success: false, error: 'Parse error', body: body.substring(0, 100) });
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

function analyzeData(data) {
    if (!data || !data.signal) {
        return { isEmpty: true, reason: 'No signal data' };
    }
    
    const issues = [];
    
    // Verifica prezzo
    if (!data.currentPrice || data.currentPrice === 0) {
        issues.push('price=0');
    }
    
    // Verifica RSI
    if (data.rsi === null || data.rsi === undefined) {
        issues.push('no RSI');
    }
    
    // Verifica signal
    if (data.signal.strength === 0 && data.signal.direction === 'NEUTRAL') {
        issues.push('strength=0');
    }
    
    // Verifica se mancano dati MTF
    if (!data.mtf) {
        issues.push('no MTF');
    }
    
    // Verifica requirements
    if (!data.requirements) {
        issues.push('no requirements');
    }
    
    // Verifica risk
    if (!data.risk) {
        issues.push('no risk');
    }
    
    return {
        isEmpty: issues.length > 3, // Considera "vuoto" se mancano più di 3 componenti
        issues,
        hasAllData: issues.length === 0,
        signal: data.signal,
        price: data.currentPrice,
        rsi: data.rsi
    };
}

async function main() {
    console.log('🔍 VERIFICA DATI VUOTI E PROBLEMATICI (API VPS)\n');
    console.log('━'.repeat(120));
    console.log(`\n📊 Verifico ${SYMBOLS_TO_CHECK.length} simboli...\n`);
    
    const results = [];
    const problems = {
        apiErrors: [],
        emptyData: [],
        partialData: [],
        ok: []
    };
    
    for (const symbol of SYMBOLS_TO_CHECK) {
        process.stdout.write(`Verificando ${symbol.padEnd(20)}...`);
        
        const response = await fetchSymbolData(symbol);
        
        if (!response.success) {
            console.log(` ❌ ${response.error}`);
            problems.apiErrors.push({ symbol, error: response.error });
        } else {
            const analysis = analyzeData(response.data);
            
            if (analysis.isEmpty) {
                console.log(` ⚠️  VUOTO`);
                problems.emptyData.push({ symbol, ...analysis });
            } else if (analysis.issues.length > 0) {
                console.log(` ⚠️  ${analysis.issues.join(', ')}`);
                problems.partialData.push({ symbol, ...analysis });
            } else {
                console.log(` ✓`);
                problems.ok.push({ symbol, ...analysis });
            }
            
            results.push({ symbol, response: response.data, analysis });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n━'.repeat(120));
    console.log('\n📊 RIEPILOGO\n');
    
    // Errori API
    if (problems.apiErrors.length > 0) {
        console.log('🚨 ERRORI API (questi potrebbero causare crash):');
        problems.apiErrors.forEach(p => {
            console.log(`   ${p.symbol.padEnd(20)} | ${p.error}`);
        });
        console.log('');
    }
    
    // Dati completamente vuoti
    if (problems.emptyData.length > 0) {
        console.log('⚠️  DATI COMPLETAMENTE VUOTI (>3 problemi):');
        problems.emptyData.forEach(p => {
            const issuesStr = (p.issues && Array.isArray(p.issues)) ? p.issues.join(', ') : p.reason || 'unknown';
            console.log(`   ${p.symbol.padEnd(20)} | Problemi: ${issuesStr}`);
        });
        console.log('');
        console.log('   💡 Questi simboli potrebbero:');
        console.log('      - Non avere klines nel database');
        console.log('      - Avere un nome simbolo non mappato correttamente');
        console.log('      - Essere stati disabilitati');
        console.log('');
    }
    
    // Dati parziali
    if (problems.partialData.length > 0) {
        console.log('⚠️  DATI PARZIALI (1-3 problemi):');
        problems.partialData.forEach(p => {
            console.log(`   ${p.symbol.padEnd(20)} | Issues: ${p.issues.join(', ')} | Signal: ${p.signal?.direction} (${p.signal?.strength})`);
        });
        console.log('');
        console.log('   💡 Questi simboli funzionano ma potrebbero avere:');
        console.log('      - Dati incompleti (es. manca RSI ma c\'è il segnale)');
        console.log('      - Componenti opzionali non disponibili');
        console.log('');
    }
    
    // Statistiche
    console.log('📈 STATISTICHE:');
    console.log(`   Simboli verificati: ${SYMBOLS_TO_CHECK.length}`);
    console.log(`   ✅ OK (dati completi): ${problems.ok.length}`);
    console.log(`   ⚠️  Dati parziali: ${problems.partialData.length}`);
    console.log(`   ⚠️  Dati vuoti: ${problems.emptyData.length}`);
    console.log(`   ❌ Errori API: ${problems.apiErrors.length}`);
    console.log('');
    
    // Analisi impatto
    const totalProblems = problems.emptyData.length + problems.apiErrors.length;
    
    if (totalProblems > 0) {
        console.log('🚨 IMPATTO SULLA LOGICA DEL BOT:');
        console.log('');
        console.log(`   ⚠️  ${totalProblems} simboli con problemi critici potrebbero:`);
        console.log('   1. ❌ Causare errori 500 nelle chiamate API');
        console.log('   2. ❌ Restituire sempre strength=0 e NEUTRAL');
        console.log('   3. ❌ Bloccare l\'apertura posizioni');
        console.log('   4. ❌ Generare log di errore continui');
        console.log('   5. ⚠️  Rallentare le risposte API (timeout)');
        console.log('');
        console.log('   💡 RACCOMANDAZIONI:');
        console.log('   - Verificare SYMBOL_NORMALIZATION_MAP in cryptoRoutes.js');
        console.log('   - Scaricare klines mancanti con download_klines.js');
        console.log('   - Disabilitare bot per simboli con errori persistenti');
        console.log('   - Controllare mapping nomi simboli (es: "op" vs "optimism")');
        console.log('');
    } else if (problems.partialData.length > 0) {
        console.log('✅ Nessun problema critico, ma:');
        console.log(`   ${problems.partialData.length} simboli hanno dati parziali (funzionano ma incompleti)`);
        console.log('');
    } else {
        console.log('✅ TUTTI I SIMBOLI HANNO DATI COMPLETI!');
        console.log('   Il bot può operare senza problemi');
        console.log('');
    }
    
    // Mostra alcuni esempi OK
    if (problems.ok.length > 0) {
        console.log('✅ ESEMPI SIMBOLI CON DATI COMPLETI:');
        problems.ok.slice(0, 5).forEach(p => {
            console.log(`   ${p.symbol.padEnd(20)} | ${p.signal.direction.padEnd(8)} | Strength: ${p.signal.strength.toString().padStart(3)} | Price: $${p.price.toFixed(4)}`);
        });
        if (problems.ok.length > 5) {
            console.log(`   ... e altri ${problems.ok.length - 5} simboli OK`);
        }
        console.log('');
    }
    
    console.log('━'.repeat(120));
}

main().catch(console.error);
