/**
 * Script per testare il salvataggio di min_volume_24h
 * Simula quello che succede quando il frontend invia 900000
 */

const { dbGet, dbRun } = require('../crypto_db');
const { getBotParameters } = require('../routes/cryptoRoutes');

// Simula DEFAULT_PARAMS
const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    stop_loss_pct: 2.0,
    take_profit_pct: 3.0,
    trade_size_usdt: 50,
    min_volume_24h: 500000
};

async function testSaveVolume() {
    try {
        console.log('🧪 Test salvataggio min_volume_24h = 900000\n');
        console.log('='.repeat(60));

        // 1. Simula parametri ricevuti dal frontend
        const parameters = {
            min_volume_24h: 900000
        };

        console.log('📥 Parametri ricevuti dal frontend:', parameters);

        // 2. Recupera parametri esistenti (come fa il backend)
        const existingParams = await getBotParameters('bitcoin');
        console.log('\n📊 Parametri esistenti nel DB:', {
            min_volume_24h: existingParams.min_volume_24h
        });

        // 3. Simula la logica di validazione (come fa il backend)
        const validParams = {
            min_volume_24h: (parameters.min_volume_24h !== undefined && parameters.min_volume_24h !== null && parameters.min_volume_24h !== '')
                ? (() => {
                    const parsed = parseFloat(parameters.min_volume_24h);
                    console.log('\n🔍 Processing min_volume_24h:', {
                        raw: parameters.min_volume_24h,
                        type: typeof parameters.min_volume_24h,
                        parsed: parsed,
                        isNaN: isNaN(parsed),
                        existing: existingParams.min_volume_24h
                    });
                    if (isNaN(parsed)) {
                        console.warn('⚠️ parseFloat restituisce NaN, uso esistente:', existingParams.min_volume_24h || 500000);
                        return existingParams.min_volume_24h || 500000;
                    }
                    const finalValue = Math.max(10000, Math.min(10000000, parsed));
                    console.log('✅ Final value:', finalValue);
                    return finalValue;
                })()
                : (() => {
                    console.log('⚠️ min_volume_24h non presente, uso esistente:', existingParams.min_volume_24h || 500000);
                    return existingParams.min_volume_24h || 500000;
                })()
        };

        console.log('\n✅ Parametri validati:', validParams);

        // 4. Leggi i parametri globali attuali
        const existing = await dbGet(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (existing) {
            const existingGlobalParams = typeof existing.parameters === 'string' 
                ? JSON.parse(existing.parameters) 
                : existing.parameters;
            
            console.log('\n📋 Parametri globali attuali:', {
                min_volume_24h: existingGlobalParams.min_volume_24h
            });

            // 5. Merge con tutti gli altri parametri esistenti
            const allParams = { ...existingGlobalParams, ...validParams };
            console.log('\n🔄 Parametri dopo merge:', {
                min_volume_24h: allParams.min_volume_24h
            });

            // 6. Serializza
            const parametersJson = JSON.stringify(allParams);
            const parsedCheck = JSON.parse(parametersJson);
            console.log('\n🔍 Verifica JSON:', {
                hasMinVolume24h: 'min_volume_24h' in parsedCheck,
                min_volume_24h_value: parsedCheck.min_volume_24h
            });

            // 7. Salva
            console.log('\n💾 Salvataggio nel database...');
            const result = await dbRun(
                "UPDATE bot_settings SET parameters = $1::text WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'",
                [parametersJson]
            );
            console.log('✅ UPDATE eseguito, righe modificate:', result.changes);

            // 8. Verifica
            const verification = await dbGet(
                "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
            );
            if (verification && verification.parameters) {
                const savedParams = typeof verification.parameters === 'string' 
                    ? JSON.parse(verification.parameters) 
                    : verification.parameters;
                
                console.log('\n✅ Verifica salvataggio:', {
                    savedMinVolume24h: savedParams.min_volume_24h,
                    expectedMinVolume24h: allParams.min_volume_24h,
                    match: savedParams.min_volume_24h === allParams.min_volume_24h
                });

                if (savedParams.min_volume_24h !== allParams.min_volume_24h) {
                    console.error('\n❌ ERRORE: Il valore non corrisponde!');
                }
            }
        }

    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
    }
}

testSaveVolume()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Errore fatale:', err);
        process.exit(1);
    });
