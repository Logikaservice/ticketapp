/**
 * 🔧 Script per Risolvere Problemi Specifici Simboli
 * 
 * Risolve:
 * 1. EOS - Verifica e scarica klines
 * 2. POLPOLYGON - Corregge mapping a MATICUSDT
 * 3. AVAX_USDT - Verifica e ripristina klines se necessario
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');
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

async function downloadKlines(symbol, binanceSymbol, days = 30) {
    console.log(`   📥 Download klines per ${symbol} (${binanceSymbol})...`);
    
    const interval = '15m';
    const limit = 1000;
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    let allKlines = [];
    let currentStartTime = startTime;
    let attempts = 0;
    const maxAttempts = 20; // Aumentato per scaricare più dati
    
    while (currentStartTime < endTime && attempts < maxAttempts) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;
        
        try {
            const klines = await httpsGet(url);
            
            if (!Array.isArray(klines)) {
                console.error(`      ❌ Risposta non valida da Binance (non è un array)`);
                break;
            }
            
            if (klines.length === 0) break;
            
            allKlines = allKlines.concat(klines);
            currentStartTime = klines[klines.length - 1][0] + 1;
            attempts++;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`      ❌ Errore: ${error.message}`);
            break;
        }
    }
    
    if (allKlines.length === 0) {
        console.log(`      ⚠️ Nessuna kline scaricata`);
        return 0;
    }
    
    // Inserisci nel database
    let inserted = 0;
    for (const k of allKlines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [symbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
            );
            inserted++;
        } catch (error) {
            // Ignora duplicati
        }
    }
    
    console.log(`      ✅ ${inserted} nuove klines inserite`);
    return inserted;
}

async function fixSpecificSymbols() {
    console.log('🔧 RISOLUZIONE PROBLEMI SPECIFICI SIMBOLI');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Verifica EOS
        console.log('1️⃣ Verifica EOS...');
        const eosKlines = await dbAll(
            "SELECT COUNT(*) as count, MAX(open_time) as last_time FROM klines WHERE symbol = $1 AND interval = $2",
            ['eos', '15m']
        );
        
        const eosCount = parseInt(eosKlines[0]?.count || 0);
        console.log(`   Klines attuali: ${eosCount}`);
        
        if (eosCount < 100) {
            console.log(`   ⚠️ Klines insufficienti, tentativo download...`);
            try {
                const inserted = await downloadKlines('eos', 'EOSUSDT', 60); // Prova 60 giorni
                if (inserted > 0) {
                    console.log(`   ✅ EOS: ${inserted} nuove klines scaricate`);
                } else {
                    console.log(`   ❌ EOS: Download fallito - verifica se EOSUSDT esiste su Binance`);
                }
            } catch (error) {
                console.log(`   ❌ EOS: Errore download - ${error.message}`);
                console.log(`   💡 EOS potrebbe essere stato delisted da Binance`);
            }
        } else {
            console.log(`   ✅ EOS: Klines sufficienti`);
        }
        console.log('');

        // 2. Verifica POLPOLYGON
        console.log('2️⃣ Verifica POLPOLYGON...');
        const polKlines = await dbAll(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
            ['polpolygon', '15m']
        );
        
        const polCount = parseInt(polKlines[0]?.count || 0);
        console.log(`   Klines attuali: ${polCount}`);
        
        // ✅ FIX: POLPOLYGON = MATIC (Polygon)
        console.log(`   💡 POLPOLYGON corrisponde a MATIC su Binance`);
        
        if (polCount < 100) {
            console.log(`   ⚠️ Klines insufficienti, download con MATICUSDT...`);
            try {
                const inserted = await downloadKlines('polpolygon', 'MATICUSDT', 60);
                if (inserted > 0) {
                    console.log(`   ✅ POLPOLYGON: ${inserted} nuove klines scaricate (usando MATICUSDT)`);
                } else {
                    console.log(`   ❌ POLPOLYGON: Download fallito`);
                }
            } catch (error) {
                console.log(`   ❌ POLPOLYGON: Errore download - ${error.message}`);
            }
        } else {
            console.log(`   ✅ POLPOLYGON: Klines sufficienti`);
        }
        console.log('');

        // 3. Verifica AVAX_USDT
        console.log('3️⃣ Verifica AVAX_USDT...');
        const avaxKlines = await dbAll(
            "SELECT COUNT(*) as count, MIN(open_time) as first_time, MAX(open_time) as last_time FROM klines WHERE symbol = $1 AND interval = $2",
            ['avax_usdt', '15m']
        );
        
        const avaxCount = parseInt(avaxKlines[0]?.count || 0);
        const avaxFirst = parseInt(avaxKlines[0]?.first_time || 0);
        const avaxLast = parseInt(avaxKlines[0]?.last_time || 0);
        const avaxDays = (avaxLast - avaxFirst) / (24 * 60 * 60 * 1000);
        
        console.log(`   Klines attuali: ${avaxCount}`);
        console.log(`   Range: ${avaxDays.toFixed(1)} giorni`);
        
        // Se ha meno di 2000 klines, scarica più dati
        if (avaxCount < 2000) {
            console.log(`   ⚠️ Klines inferiori alle attese (era 7,505), download aggiuntivo...`);
            try {
                const inserted = await downloadKlines('avax_usdt', 'AVAXUSDT', 90); // 90 giorni per avere più dati
                if (inserted > 0) {
                    console.log(`   ✅ AVAX_USDT: ${inserted} nuove klines scaricate`);
                    
                    // Verifica nuovo totale
                    const newCount = await dbGet(
                        "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
                        ['avax_usdt', '15m']
                    );
                    console.log(`   📊 Nuovo totale: ${parseInt(newCount.count)} klines`);
                } else {
                    console.log(`   ⚠️ AVAX_USDT: Nessuna nuova kline (potrebbero essere già presenti)`);
                }
            } catch (error) {
                console.log(`   ❌ AVAX_USDT: Errore download - ${error.message}`);
            }
        } else {
            console.log(`   ✅ AVAX_USDT: Klines sufficienti (${avaxCount})`);
        }
        console.log('');

        // 4. Report finale
        console.log('='.repeat(80));
        console.log('✅ VERIFICA COMPLETATA');
        console.log('='.repeat(80));
        console.log('');
        console.log('💡 Esegui di nuovo: node verify_all_klines.js per verificare i risultati');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante risoluzione problemi:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixSpecificSymbols().catch(console.error);

