/**
 * 🔍 Test Script per Verificare Download MATICUSDT
 * 
 * Verifica se MATICUSDT è disponibile su Binance e testa il download
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

async function testMaticDownload() {
    console.log('🔍 TEST DOWNLOAD MATICUSDT');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Test simbolo MATICUSDT
        console.log('1️⃣ Test simbolo MATICUSDT su Binance...');
        const testUrl = 'https://api.binance.com/api/v3/klines?symbol=MATICUSDT&interval=15m&limit=1';
        console.log(`   URL: ${testUrl}`);
        
        try {
            const result = await httpsGet(testUrl);
            if (Array.isArray(result) && result.length > 0) {
                console.log(`   ✅ MATICUSDT esiste su Binance!`);
                console.log(`   📊 Prima kline: ${new Date(result[0][0]).toISOString()}`);
            } else {
                console.log(`   ⚠️ MATICUSDT restituisce array vuoto`);
            }
        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}`);
            if (error.message.includes('Invalid symbol')) {
                console.log(`   💡 MATICUSDT potrebbe non esistere - prova MATIC/USDT o altri formati`);
            }
        }
        console.log('');

        // 2. Test simboli alternativi
        console.log('2️⃣ Test simboli alternativi...');
        const alternatives = ['MATICUSDT', 'MATIC/USDT', 'POLUSDT'];
        
        for (const symbol of alternatives) {
            try {
                const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=1`;
                const result = await httpsGet(url);
                if (Array.isArray(result) && result.length > 0) {
                    console.log(`   ✅ ${symbol}: Disponibile!`);
                } else {
                    console.log(`   ⚠️ ${symbol}: Array vuoto`);
                }
            } catch (error) {
                console.log(`   ❌ ${symbol}: ${error.message}`);
            }
        }
        console.log('');

        // 3. Test download completo (ultime 24h)
        console.log('3️⃣ Test download ultime 24h...');
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const url = `https://api.binance.com/api/v3/klines?symbol=MATICUSDT&interval=15m&startTime=${oneDayAgo}&limit=1000`;
        
        try {
            const klines = await httpsGet(url);
            if (Array.isArray(klines)) {
                console.log(`   ✅ Ricevute ${klines.length} klines`);
                if (klines.length > 0) {
                    console.log(`   📅 Prima: ${new Date(klines[0][0]).toISOString()}`);
                    console.log(`   📅 Ultima: ${new Date(klines[klines.length - 1][0]).toISOString()}`);
                }
            } else {
                console.log(`   ⚠️ Risposta non è un array: ${typeof klines}`);
            }
        } catch (error) {
            console.log(`   ❌ Errore download: ${error.message}`);
        }
        console.log('');

        // 4. Verifica simbolo nel database
        console.log('4️⃣ Verifica simboli nel database...');
        const { dbAll } = require('./crypto_db');
        
        const symbols = await dbAll(
            "SELECT DISTINCT symbol FROM klines WHERE symbol LIKE '%polygon%' OR symbol LIKE '%matic%' OR symbol LIKE '%pol%' ORDER BY symbol"
        );
        
        if (symbols.length > 0) {
            console.log(`   📊 Simboli trovati nel database:`);
            for (const row of symbols) {
                const count = await dbAll(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                    [row.symbol]
                );
                console.log(`      - ${row.symbol}: ${count[0]?.count || 0} klines`);
            }
        } else {
            console.log(`   ⚠️ Nessun simbolo polygon/matic trovato nel database`);
        }
        console.log('');

        console.log('='.repeat(80));
        console.log('✅ TEST COMPLETATO');
        console.log('='.repeat(80));
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante test:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMaticDownload().catch(console.error);

