/**
 * Script per testare direttamente l'endpoint dashboard e vedere cosa restituisce
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;

// Simula la logica dell'endpoint dashboard
async function testDashboardLogic() {
    try {
        console.log('🔍 Test logica endpoint dashboard...\n');

        // 1. Recupera posizioni aperte
        console.log('📊 Step 1: Recupero posizioni aperte dal DB...');
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");
        console.log(`   ✅ Trovate ${openPositions.length} posizioni aperte\n`);

        if (openPositions.length === 0) {
            console.log('❌ Nessuna posizione aperta!');
            return;
        }

        // 2. Mostra le posizioni
        openPositions.forEach((pos, idx) => {
            console.log(`   ${idx + 1}. ${pos.symbol} - ${pos.type} - Ticket: ${pos.ticket_id}`);
        });

        // 3. Test calcolo sentimento per ogni posizione
        console.log('\n📊 Step 2: Test calcolo sentimento per ogni posizione...\n');
        
        const signalGenerator = require('./services/BidirectionalSignalGenerator');
        
        const results = [];
        
        for (const position of openPositions) {
            try {
                console.log(`🔍 Testando ${position.symbol} (${position.ticket_id})...`);
                
                // Ottieni klines
                const klinesData = await dbAll(
                    "SELECT * FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 50",
                    [position.symbol]
                );

                console.log(`   Klines trovate: ${klinesData?.length || 0}`);

                if (!klinesData || klinesData.length < 20) {
                    console.log(`   ⚠️ Dati insufficienti (serve almeno 20, trovate ${klinesData?.length || 0})`);
                    results.push({
                        position,
                        success: false,
                        error: 'Insufficient klines',
                        klinesCount: klinesData?.length || 0
                    });
                    continue;
                }

                const klinesChronological = klinesData.reverse();
                const historyForSignal = klinesChronological.map(kline => ({
                    close: parseFloat(kline.close_price),
                    high: parseFloat(kline.high_price),
                    low: parseFloat(kline.low_price),
                    volume: parseFloat(kline.volume || 0),
                    price: parseFloat(kline.close_price),
                    open: parseFloat(kline.open_price),
                    timestamp: kline.open_time
                }));

                // Genera segnale
                const currentSignal = signalGenerator.generateSignal(historyForSignal, position.symbol, {
                    rsi_period: 14,
                    rsi_oversold: 30,
                    rsi_overbought: 70,
                    min_signal_strength: 60,
                    min_confirmations_long: 3,
                    min_confirmations_short: 4
                });

                // Determina sentimento
                let sentiment = 'NEUTRAL';
                let sentimentStrength = 0;
                let sentimentDirection = null;

                if (currentSignal.direction === 'LONG') {
                    sentiment = 'BULLISH';
                    sentimentStrength = currentSignal.strength;
                    sentimentDirection = 'UP';
                } else if (currentSignal.direction === 'SHORT') {
                    sentiment = 'BEARISH';
                    sentimentStrength = currentSignal.strength;
                    sentimentDirection = 'DOWN';
                } else {
                    sentiment = 'NEUTRAL';
                    sentimentStrength = Math.max(
                        currentSignal.longSignal?.strength || 0,
                        currentSignal.shortSignal?.strength || 0
                    );
                }

                const result = {
                    ...position,
                    bot_sentiment: {
                        sentiment,
                        direction: sentimentDirection,
                        strength: sentimentStrength,
                        is_contrary: (position.type === 'buy' && sentiment === 'BEARISH') ||
                            (position.type === 'sell' && sentiment === 'BULLISH'),
                        signal_details: {
                            direction: currentSignal.direction,
                            strength: currentSignal.strength,
                            confirmations: currentSignal.confirmations,
                            reasons: currentSignal.reasons || []
                        }
                    }
                };

                console.log(`   ✅ Sentimento calcolato: ${sentiment} (strength: ${sentimentStrength})`);
                results.push({
                    position,
                    success: true,
                    result
                });

            } catch (error) {
                console.error(`   ❌ Errore per ${position.symbol}:`, error.message);
                console.error(`   Stack:`, error.stack);
                results.push({
                    position,
                    success: false,
                    error: error.message,
                    stack: error.stack
                });
            }
        }

        // 4. Riepilogo
        console.log('\n📋 Riepilogo:');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`   ✅ Successo: ${successful.length}/${results.length}`);
        console.log(`   ❌ Falliti: ${failed.length}/${results.length}`);

        if (failed.length > 0) {
            console.log('\n⚠️ Posizioni con errori:');
            failed.forEach(r => {
                console.log(`   - ${r.position.symbol}: ${r.error}`);
            });
        }

        console.log(`\n✅ Posizioni che verrebbero restituite: ${successful.length}`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error('Stack:', error.stack);
    }
}

testDashboardLogic().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

