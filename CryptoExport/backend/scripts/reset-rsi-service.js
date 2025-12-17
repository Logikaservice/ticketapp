/**
 * Script per cancellare completamente il servizio RSI e tutti i suoi dati
 * e ricrearlo da zero con struttura pulita e personalizzabile
 */

// Usa lo stesso sistema di connessione di cryptoRoutes.js
const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

const resetRSIService = async () => {
    console.log('🔄 RESET SERVIZIO RSI');
    console.log('='.repeat(60));
    
    try {
        // 1. Verifica dati esistenti
        console.log('\n📊 1. Verifica dati esistenti...');
        const existingData = await dbAll(
            "SELECT COUNT(*) as count FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );
        const count = parseInt(existingData[0]?.count || 0);
        console.log(`   Trovati ${count} record RSI_Strategy`);
        
        if (count > 0) {
            const details = await dbAll(
                "SELECT symbol, is_active FROM bot_settings WHERE strategy_name = 'RSI_Strategy' ORDER BY symbol"
            );
            console.log('   Record da cancellare:');
            details.forEach(row => {
                console.log(`      - ${row.symbol || '(global)'}: attivo=${row.is_active}`);
            });
        }
        
        // 2. Cancella tutti i dati RSI
        console.log('\n🗑️  2. Cancellazione dati RSI...');
        await dbRun(
            "DELETE FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );
        console.log(`   ✅ Cancellati tutti i record RSI_Strategy`);
        
        // 3. Crea nuovo record con parametri di default completi e personalizzabili
        console.log('\n✨ 3. Creazione nuovo servizio RSI...');
        
        const defaultRSIParams = {
            // Parametri RSI
            rsi_period: 14,
            rsi_oversold: 30,
            rsi_overbought: 70,
            
            // Parametri Trading
            stop_loss_pct: 2.0,
            take_profit_pct: 3.0,
            trade_size_usdt: 50,
            
            // Trailing Stop
            trailing_stop_enabled: false,
            trailing_stop_distance_pct: 1.0,
            
            // Partial Close
            partial_close_enabled: false,
            take_profit_1_pct: 1.5,
            take_profit_2_pct: 3.0,
            
            // Filtri Avanzati (nuovi parametri personalizzabili)
            min_signal_strength: 70,           // Forza minima segnale per aprire posizione
            min_confirmations_long: 3,         // Minimo conferme per LONG
            min_confirmations_short: 4,        // Minimo conferme per SHORT
            min_atr_pct: 0.2,                  // ATR minimo per trading (volatilità)
            max_atr_pct: 5.0,                  // ATR massimo per trading (volatilità troppo alta)
            min_volume_24h: 500000,            // Volume minimo 24h (EUR/USDT)
            
            // Risk Management
            max_exposure_pct: 50.0,            // Esposizione massima (% del portfolio)
            max_positions: 5,                  // Numero massimo posizioni aperte simultanee
            
            // Timeframe
            analysis_timeframe: '15m',         // Timeframe per analisi (15m, 1h, 4h, 1d)
            
            // Note
            notes: 'Servizio RSI ricreato - Tutti i parametri sono personalizzabili'
        };
        
        // Crea record globale (per tutti i simboli) - usa 'global' come symbol
        await dbRun(
            `INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters) 
             VALUES (?, ?, ?, ?)`,
            ['RSI_Strategy', 'global', 1, JSON.stringify(defaultRSIParams)]
        );
        
        console.log('   ✅ Creato record globale con parametri di default');
        console.log('\n📋 Parametri di default creati:');
        console.log('   RSI:');
        console.log(`      - Periodo: ${defaultRSIParams.rsi_period}`);
        console.log(`      - Oversold: ${defaultRSIParams.rsi_oversold}`);
        console.log(`      - Overbought: ${defaultRSIParams.rsi_overbought}`);
        console.log('   Trading:');
        console.log(`      - Stop Loss: ${defaultRSIParams.stop_loss_pct}%`);
        console.log(`      - Take Profit: ${defaultRSIParams.take_profit_pct}%`);
        console.log(`      - Trade Size: ${defaultRSIParams.trade_size_usdt} USDT`);
        console.log('   Filtri Avanzati:');
        console.log(`      - Min Signal Strength: ${defaultRSIParams.min_signal_strength}`);
        console.log(`      - Min Confirmations LONG: ${defaultRSIParams.min_confirmations_long}`);
        console.log(`      - Min Confirmations SHORT: ${defaultRSIParams.min_confirmations_short}`);
        console.log(`      - Min ATR: ${defaultRSIParams.min_atr_pct}%`);
        console.log(`      - Max ATR: ${defaultRSIParams.max_atr_pct}%`);
        console.log(`      - Min Volume 24h: ${defaultRSIParams.min_volume_24h}`);
        console.log('   Risk Management:');
        console.log(`      - Max Exposure: ${defaultRSIParams.max_exposure_pct}%`);
        console.log(`      - Max Positions: ${defaultRSIParams.max_positions}`);
        
        // 4. Verifica creazione
        console.log('\n✅ 4. Verifica creazione...');
        const verify = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );
        console.log(`   ✅ Verificati ${verify.length} record creati`);
        
        if (verify.length > 0) {
            const params = typeof verify[0].parameters === 'string'
                ? JSON.parse(verify[0].parameters)
                : verify[0].parameters;
            console.log(`   ✅ Parametri salvati correttamente (${Object.keys(params).length} parametri)`);
        }
        
        console.log('\n🎉 RESET COMPLETATO!');
        console.log('='.repeat(60));
        console.log('\n📝 PROSSIMI PASSI:');
        console.log('   1. Usa PUT /api/crypto/bot/parameters per personalizzare i parametri');
        console.log('   2. Usa GET /api/crypto/bot/parameters per vedere i parametri attuali');
        console.log('   3. Tutti i parametri sono ora personalizzabili!');
        console.log('');
        
    } catch (error) {
        console.error('\n❌ Errore durante il reset:', error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Non serve chiudere la connessione, crypto_db la gestisce
    }
};

// Esegui reset
resetRSIService();

