/**
 * 🔍 Test Script per Verificare Simboli EUR su Binance
 * 
 * Verifica quali coppie EUR sono realmente disponibili su Binance
 */

const https = require('https');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                        reject(new Error(`Binance API returned HTML instead of JSON`));
                        return;
                    }
                    const parsed = JSON.parse(data);
                    if (parsed.code && parsed.msg) {
                        reject(new Error(`Binance API Error ${parsed.code}: ${parsed.msg}`));
                        return;
                    }
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function testEurSymbols() {
    console.log('🔍 TEST SIMBOLI EUR SU BINANCE');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Ottieni tutti i simboli disponibili su Binance
        console.log('1️⃣ Recupero tutti i simboli disponibili su Binance...');
        const exchangeInfo = await httpsGet('https://api.binance.com/api/v3/exchangeInfo');
        
        if (!exchangeInfo.symbols || !Array.isArray(exchangeInfo.symbols)) {
            console.log('   ❌ Formato risposta non valido');
            return;
        }

        // Filtra solo simboli EUR
        const eurSymbols = exchangeInfo.symbols.filter(s => 
            s.symbol.endsWith('EUR') && s.status === 'TRADING'
        );

        console.log(`   ✅ Trovati ${eurSymbols.length} simboli EUR disponibili su Binance`);
        console.log('');

        // 2. Mostra i primi 20 simboli EUR
        console.log('2️⃣ Simboli EUR disponibili (primi 20):');
        eurSymbols.slice(0, 20).forEach((s, idx) => {
            console.log(`   ${idx + 1}. ${s.symbol} (${s.baseAsset}/${s.quoteAsset})`);
        });
        if (eurSymbols.length > 20) {
            console.log(`   ... e altri ${eurSymbols.length - 20} simboli`);
        }
        console.log('');

        // 3. Test simboli EUR comuni dal nostro database
        console.log('3️⃣ Test simboli EUR dal nostro database...');
        const ourEurSymbols = [
            'BTCEUR', 'ETHEUR', 'ADAEUR', 'DOTEUR', 'LINKEUR', 'LTCEUR',
            'XRPEUR', 'BNBEUR', 'SOLEUR', 'AVAXEUR', 'MATICEUR', 'DOGEEUR',
            'SHIBEUR', 'TRXEUR', 'XLMEUR', 'ATOMEUR', 'NEAREUR', 'SUIEUR',
            'ARBEUR', 'OPEUR', 'PEPEEUR', 'FLOKIEUR', 'BONKEUR', 'SAND EUR',
            'MANAEUR', 'GALAEUR', 'AAVEEUR', 'UNIEUR', 'MAKEREUR', 'COMPEUR'
        ];

        const available = [];
        const notAvailable = [];

        for (const symbol of ourEurSymbols) {
            // Normalizza: rimuovi spazi, converti in maiuscolo
            const normalized = symbol.replace(/\s+/g, '').toUpperCase();
            
            try {
                const url = `https://api.binance.com/api/v3/klines?symbol=${normalized}&interval=15m&limit=1`;
                const result = await httpsGet(url);
                
                if (Array.isArray(result) && result.length > 0) {
                    available.push(normalized);
                    console.log(`   ✅ ${normalized}: Disponibile`);
                } else {
                    notAvailable.push(normalized);
                    console.log(`   ⚠️ ${normalized}: Array vuoto`);
                }
            } catch (error) {
                notAvailable.push(normalized);
                if (error.message.includes('Invalid symbol')) {
                    console.log(`   ❌ ${normalized}: Non disponibile`);
                } else {
                    console.log(`   ❌ ${normalized}: Errore - ${error.message}`);
                }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('');

        // 4. Report finale
        console.log('='.repeat(80));
        console.log('📊 REPORT FINALE');
        console.log('='.repeat(80));
        console.log('');
        console.log(`✅ Simboli EUR disponibili su Binance: ${eurSymbols.length}`);
        console.log(`✅ Simboli EUR dal nostro DB disponibili: ${available.length}`);
        console.log(`❌ Simboli EUR dal nostro DB NON disponibili: ${notAvailable.length}`);
        console.log('');

        if (available.length > 0) {
            console.log('✅ SIMBOLI EUR DISPONIBILI:');
            available.forEach(s => console.log(`   - ${s}`));
            console.log('');
        }

        if (notAvailable.length > 0) {
            console.log('❌ SIMBOLI EUR NON DISPONIBILI:');
            notAvailable.forEach(s => console.log(`   - ${s}`));
            console.log('');
        }

        // 5. Suggerimenti
        console.log('💡 SUGGERIMENTI:');
        if (available.length > 0) {
            console.log(`1. Usa questi simboli EUR disponibili: ${available.join(', ')}`);
            console.log('2. Aggiorna la mappa SYMBOL_MAP per includere i simboli EUR disponibili');
        }
        if (notAvailable.length > 0) {
            console.log(`3. I simboli ${notAvailable.join(', ')} non sono disponibili su Binance`);
            console.log('4. Considera di rimuoverli o usare le coppie USDT equivalenti');
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante test:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testEurSymbols().catch(console.error);

