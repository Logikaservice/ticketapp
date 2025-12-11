/**
 * 📊 Analisi Quote Currencies Disponibili su Binance
 * 
 * Questo script analizza quali quote currencies sono disponibili su Binance
 * e valuta la fattibilità di aggiungere ARS, JPY, e altre coppie
 */

const https = require('https');

// Helper per fare richieste HTTPS
const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
};

async function analyzeQuoteCurrencies() {
    console.log('📊 ANALISI QUOTE CURRENCIES SU BINANCE');
    console.log('='.repeat(100));
    console.log('');

    try {
        // 1. Recupera tutti i simboli disponibili su Binance
        console.log('🔍 Recupero tutti i simboli da Binance...');
        const exchangeInfo = await httpsGet('https://api.binance.com/api/v3/exchangeInfo');
        
        if (!exchangeInfo || !exchangeInfo.symbols) {
            throw new Error('Impossibile recuperare exchange info da Binance');
        }

        // 2. Raggruppa per quote currency
        const quoteCurrencies = {};
        const baseCurrencies = new Set();
        
        exchangeInfo.symbols.forEach(symbol => {
            if (symbol.status === 'TRADING') {
                const quote = symbol.quoteAsset;
                const base = symbol.baseAsset;
                
                if (!quoteCurrencies[quote]) {
                    quoteCurrencies[quote] = {
                        quote: quote,
                        pairs: [],
                        count: 0,
                        popularBases: {}
                    };
                }
                
                quoteCurrencies[quote].pairs.push(symbol.symbol);
                quoteCurrencies[quote].count++;
                baseCurrencies.add(base);
                
                // Traccia basi popolari per ogni quote
                const popularBases = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'XRP', 'AVAX', 'MATIC'];
                if (popularBases.includes(base)) {
                    if (!quoteCurrencies[quote].popularBases[base]) {
                        quoteCurrencies[quote].popularBases[base] = 0;
                    }
                    quoteCurrencies[quote].popularBases[base]++;
                }
            }
        });

        // 3. Ordina per numero di coppie disponibili
        const sortedQuotes = Object.values(quoteCurrencies)
            .sort((a, b) => b.count - a.count);

        console.log(`✅ Trovate ${sortedQuotes.length} quote currencies diverse`);
        console.log(`✅ Trovate ${baseCurrencies.size} base currencies diverse`);
        console.log('');

        // 4. Analisi quote currencies principali
        console.log('📊 TOP 20 QUOTE CURRENCIES (per numero di coppie disponibili):');
        console.log('-'.repeat(100));
        console.log('');

        const topQuotes = sortedQuotes.slice(0, 20);
        topQuotes.forEach((quote, index) => {
            const popularCount = Object.keys(quote.popularBases).length;
            console.log(`${(index + 1).toString().padStart(2, ' ')}. ${quote.quote.padEnd(8)} | ${quote.count.toString().padStart(4)} coppie | ${popularCount} basi popolari`);
        });

        console.log('');
        console.log('='.repeat(100));
        console.log('');

        // 5. Analisi specifica per ARS, JPY, e altre valute fiat
        console.log('💱 ANALISI VALUTE FIAT SPECIFICHE:');
        console.log('-'.repeat(100));
        console.log('');

        const fiatCurrencies = ['ARS', 'JPY', 'EUR', 'USD', 'GBP', 'AUD', 'CAD', 'CHF', 'BRL', 'TRY', 'RUB', 'KRW', 'CNY'];
        
        fiatCurrencies.forEach(fiat => {
            const quoteData = quoteCurrencies[fiat];
            if (quoteData) {
                console.log(`✅ ${fiat}: ${quoteData.count} coppie disponibili`);
                
                // Mostra alcune coppie popolari
                const popularPairs = quoteData.pairs
                    .filter(p => ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'XRP'].some(b => p.startsWith(b)))
                    .slice(0, 5);
                
                if (popularPairs.length > 0) {
                    console.log(`   Esempi: ${popularPairs.join(', ')}`);
                }
                
                // Mostra basi popolari disponibili
                const bases = Object.keys(quoteData.popularBases);
                if (bases.length > 0) {
                    console.log(`   Basi popolari: ${bases.join(', ')}`);
                }
            } else {
                console.log(`❌ ${fiat}: Non disponibile su Binance`);
            }
            console.log('');
        });

        // 6. Analisi liquidità (24h volume) per quote currencies principali
        console.log('='.repeat(100));
        console.log('📈 ANALISI LIQUIDITÀ (Volume 24h) - TOP 10 QUOTE CURRENCIES:');
        console.log('-'.repeat(100));
        console.log('');

        const topQuoteSymbols = sortedQuotes.slice(0, 10).map(q => q.quote);
        
        for (const quote of topQuoteSymbols) {
            const quoteData = quoteCurrencies[quote];
            if (!quoteData) continue;
            
            // Prendi alcune coppie popolari e calcola volume totale
            const popularPairs = quoteData.pairs
                .filter(p => ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'XRP', 'LINK'].some(b => p.startsWith(b)))
                .slice(0, 5);
            
            let totalVolume = 0;
            let volumeCount = 0;
            
            for (const pair of popularPairs) {
                try {
                    const ticker = await httpsGet(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
                    if (ticker && ticker.quoteVolume) {
                        totalVolume += parseFloat(ticker.quoteVolume);
                        volumeCount++;
                    }
                } catch (e) {
                    // Skip se errore
                }
            }
            
            const avgVolume = volumeCount > 0 ? totalVolume / volumeCount : 0;
            const volumeLabel = avgVolume > 1000000 ? `${(avgVolume / 1000000).toFixed(2)}M` : 
                               avgVolume > 1000 ? `${(avgVolume / 1000).toFixed(2)}K` : 
                               avgVolume.toFixed(2);
            
            console.log(`${quote.padEnd(8)} | ${quoteData.count.toString().padStart(4)} coppie | Volume medio: ${volumeLabel} ${quote}`);
        }

        console.log('');
        console.log('='.repeat(100));
        console.log('');

        // 7. Raccomandazioni
        console.log('💡 RACCOMANDAZIONI:');
        console.log('-'.repeat(100));
        console.log('');
        console.log('✅ USDT:');
        console.log('   - Standard de facto per crypto trading');
        console.log('   - Massima liquidità e volume');
        console.log('   - Spread più bassi');
        console.log('   - Supporto completo su Binance');
        console.log('');
        console.log('✅ EUR:');
        console.log('   - Utile per utenti europei');
        console.log('   - Buona liquidità per coppie principali');
        console.log('   - 23 coppie disponibili su Binance');
        console.log('   - Spread leggermente più alti di USDT');
        console.log('');
        console.log('⚠️ ARS (Argentine Peso):');
        const arsData = quoteCurrencies['ARS'];
        if (arsData) {
            console.log(`   - ${arsData.count} coppie disponibili su Binance`);
            console.log('   - Utile per utenti argentini');
            console.log('   - ⚠️ Attenzione: volatilità del peso argentino');
            console.log('   - ⚠️ Liquidità limitata rispetto a USDT/EUR');
        } else {
            console.log('   - ❌ Non disponibile su Binance');
        }
        console.log('');
        console.log('⚠️ JPY (Japanese Yen):');
        const jpyData = quoteCurrencies['JPY'];
        if (jpyData) {
            console.log(`   - ${jpyData.count} coppie disponibili su Binance`);
            console.log('   - Utile per utenti giapponesi');
            console.log('   - Buona liquidità per coppie principali');
            console.log('   - ⚠️ Spread più alti di USDT');
        } else {
            console.log('   - ❌ Non disponibile su Binance');
        }
        console.log('');
        console.log('📋 CONSIDERAZIONI PER ESTENDERE IL SISTEMA:');
        console.log('   1. Verifica disponibilità su Binance (questo script)');
        console.log('   2. Verifica liquidità e volume 24h');
        console.log('   3. Considera spread e commissioni');
        console.log('   4. Valuta necessità degli utenti');
        console.log('   5. Implementa gestione multi-currency nel database');
        console.log('   6. Aggiorna mapping SYMBOL_TO_PAIR');
        console.log('   7. Aggiorna logica di calcolo P&L per conversioni');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante analisi:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

analyzeQuoteCurrencies().catch(console.error);

