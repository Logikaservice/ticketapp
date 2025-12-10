/**
 * Script per testare il calcolo del sentimento bot per SAND
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const signalGenerator = require('./services/BidirectionalSignalGenerator');

async function testSentiment() {
    try {
        console.log('🔍 Test calcolo sentimento bot per SAND...\n');

        // Recupera posizione SAND
        const sandPosition = await dbGet("SELECT * FROM open_positions WHERE symbol = 'sand' AND status = 'open' ORDER BY opened_at DESC LIMIT 1");
        
        if (!sandPosition) {
            console.log('❌ Nessuna posizione SAND trovata');
            return;
        }

        console.log(`✅ Posizione SAND trovata: ${sandPosition.ticket_id}\n`);

        // Ottieni klines per calcolare segnale attuale
        console.log('📊 Recupero klines per SAND...');
        const klinesData = await dbAll(
            "SELECT * FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 50",
            [sandPosition.symbol]
        );

        console.log(`   Klines trovate: ${klinesData?.length || 0}`);

        if (!klinesData || klinesData.length < 20) {
            console.log(`\n⚠️ Dati insufficienti per calcolare sentimento (serve almeno 20 klines, trovate ${klinesData?.length || 0})`);
            console.log('   Questo potrebbe essere il motivo per cui la posizione non viene restituita!');
            return;
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

        console.log(`✅ Klines preparate: ${historyForSignal.length}\n`);

        // Genera segnale attuale
        console.log('🔮 Calcolo segnale...');
        try {
            const currentSignal = signalGenerator.generateSignal(historyForSignal, sandPosition.symbol, {
                rsi_period: 14,
                rsi_oversold: 30,
                rsi_overbought: 70,
                min_signal_strength: 60,
                min_confirmations_long: 3,
                min_confirmations_short: 4
            });

            console.log(`✅ Segnale generato:`);
            console.log(`   Direzione: ${currentSignal.direction}`);
            console.log(`   Strength: ${currentSignal.strength}`);
            console.log(`   Confirmations: ${currentSignal.confirmations}`);

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

            console.log(`\n✅ Sentimento calcolato:`);
            console.log(`   Sentiment: ${sentiment}`);
            console.log(`   Direction: ${sentimentDirection}`);
            console.log(`   Strength: ${sentimentStrength}`);

            const result = {
                ...sandPosition,
                bot_sentiment: {
                    sentiment,
                    direction: sentimentDirection,
                    strength: sentimentStrength,
                    is_contrary: (sandPosition.type === 'buy' && sentiment === 'BEARISH') ||
                        (sandPosition.type === 'sell' && sentiment === 'BULLISH'),
                    signal_details: {
                        direction: currentSignal.direction,
                        strength: currentSignal.strength,
                        confirmations: currentSignal.confirmations,
                        reasons: currentSignal.reasons || []
                    }
                }
            };

            console.log(`\n✅ Posizione con sentimento creata con successo!`);
            console.log(`   Ticket ID: ${result.ticket_id}`);
            console.log(`   Symbol: ${result.symbol}`);
            console.log(`   Bot Sentiment: ${result.bot_sentiment.sentiment}`);

        } catch (signalError) {
            console.error(`\n❌ Errore nel calcolo del segnale:`, signalError.message);
            console.error(`   Stack:`, signalError.stack);
            throw signalError;
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error('Stack:', error.stack);
    }
}

testSentiment().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

