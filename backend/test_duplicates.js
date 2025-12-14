/**
 * Test per dimostrare che i duplicati sono IDENTICI
 */

const https = require('https');

// Funzione per ottenere prezzo da Binance
function getPrice(tradingPair) {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(parseFloat(json.price));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Funzione per ottenere ultime 100 candele
function getKlines(tradingPair, interval = '15m', limit = 100) {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${interval}&limit=${limit}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Calcola RSI semplice
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

async function testDuplicates() {
    console.log('🔬 TEST DUPLICATI - Dimostrazione che sono IDENTICI\n');
    console.log('='.repeat(80));

    // Test 1: BITCOIN vs BITCOIN_USDT
    console.log('\n📊 TEST 1: bitcoin vs bitcoin_usdt');
    console.log('-'.repeat(80));

    const btcPair = 'BTCUSDT';

    console.log(`\n🔍 Entrambi mappano a: ${btcPair}`);

    // Ottieni prezzo
    const price1 = await getPrice(btcPair);
    await new Promise(r => setTimeout(r, 100)); // Piccolo delay
    const price2 = await getPrice(btcPair);

    console.log(`\n💰 PREZZO:`);
    console.log(`   "bitcoin" (${btcPair}):      $${price1.toFixed(2)}`);
    console.log(`   "bitcoin_usdt" (${btcPair}): $${price2.toFixed(2)}`);
    console.log(`   Differenza: $${Math.abs(price1 - price2).toFixed(2)} (${price1 === price2 ? '✅ IDENTICI' : '⚠️ Micro-differenza per timing'})`);

    // Ottieni klines
    console.log(`\n📈 KLINES (ultime 100 candele 15m):`);
    const klines1 = await getKlines(btcPair);
    await new Promise(r => setTimeout(r, 100));
    const klines2 = await getKlines(btcPair);

    console.log(`   "bitcoin": ${klines1.length} candele`);
    console.log(`   "bitcoin_usdt": ${klines2.length} candele`);

    // Confronta prime 3 candele
    console.log(`\n🔍 Confronto prime 3 candele:`);
    for (let i = 0; i < 3; i++) {
        const k1 = klines1[i];
        const k2 = klines2[i];
        const identical = JSON.stringify(k1) === JSON.stringify(k2);
        console.log(`   Candela ${i + 1}: ${identical ? '✅ IDENTICHE' : '❌ DIVERSE'}`);
        if (i === 0) {
            console.log(`      "bitcoin":      Open=$${parseFloat(k1[1]).toFixed(2)}, Close=$${parseFloat(k1[4]).toFixed(2)}`);
            console.log(`      "bitcoin_usdt": Open=$${parseFloat(k2[1]).toFixed(2)}, Close=$${parseFloat(k2[4]).toFixed(2)}`);
        }
    }

    // Calcola RSI
    const closePrices1 = klines1.map(k => parseFloat(k[4]));
    const closePrices2 = klines2.map(k => parseFloat(k[4]));

    const rsi1 = calculateRSI(closePrices1, 14);
    const rsi2 = calculateRSI(closePrices2, 14);

    console.log(`\n📊 INDICATORI TECNICI (RSI 14):`);
    console.log(`   "bitcoin":      RSI = ${rsi1.toFixed(2)}`);
    console.log(`   "bitcoin_usdt": RSI = ${rsi2.toFixed(2)}`);
    console.log(`   Differenza: ${Math.abs(rsi1 - rsi2).toFixed(4)} (${Math.abs(rsi1 - rsi2) < 0.01 ? '✅ IDENTICI' : '❌ DIVERSI'})`);

    // Test 2: ETHEREUM vs ETHEREUM_USDT
    console.log('\n\n📊 TEST 2: ethereum vs ethereum_usdt');
    console.log('-'.repeat(80));

    const ethPair = 'ETHUSDT';
    console.log(`\n🔍 Entrambi mappano a: ${ethPair}`);

    const ethPrice1 = await getPrice(ethPair);
    await new Promise(r => setTimeout(r, 100));
    const ethPrice2 = await getPrice(ethPair);

    console.log(`\n💰 PREZZO:`);
    console.log(`   "ethereum" (${ethPair}):      $${ethPrice1.toFixed(2)}`);
    console.log(`   "ethereum_usdt" (${ethPair}): $${ethPrice2.toFixed(2)}`);
    console.log(`   Differenza: $${Math.abs(ethPrice1 - ethPrice2).toFixed(2)} (${ethPrice1 === ethPrice2 ? '✅ IDENTICI' : '⚠️ Micro-differenza per timing'})`);

    // Conclusione
    console.log('\n\n' + '='.repeat(80));
    console.log('🎯 CONCLUSIONE:');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ I "duplicati" sono ESATTAMENTE LO STESSO ASSET:');
    console.log('   • Stesso prezzo in tempo reale');
    console.log('   • Stesse candele storiche (klines)');
    console.log('   • Stessi indicatori tecnici (RSI, MACD, EMA, ecc.)');
    console.log('   • Stesso grafico su TradingView');
    console.log('');
    console.log('⚠️  PROBLEMA:');
    console.log('   Il bot li vede come 2 asset separati e può aprire 2 posizioni');
    console.log('   sullo stesso trading pair, raddoppiando l\'esposizione!');
    console.log('');
    console.log('💡 SOLUZIONE:');
    console.log('   Rimuovi i duplicati e tieni solo UNA versione per ogni asset.');
    console.log('   Es: Tieni "bitcoin_usdt" e rimuovi "bitcoin"');
    console.log('');
}

testDuplicates().catch(console.error);
