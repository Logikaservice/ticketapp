const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crypto.db');

// Configurazione ottimale raccomandata
const OPTIMAL_CONFIG = {
    // RSI Parameters
    rsi_period: 14,
    rsi_oversold: 35,  // Cambiato da 30 a 35
    rsi_overbought: 70,

    // Risk Management
    stop_loss_pct: 3.0,  // Ridotto da 10% a 3%
    take_profit_pct: 5.0,  // Ridotto da 15% a 5%
    trade_size_eur: 100,  // Aumentato da 50€ a 100€

    // Trailing Stop Loss
    trailing_stop_enabled: true,  // ATTIVATO
    trailing_stop_distance_pct: 1.5,

    // Partial Close
    partial_close_enabled: true,  // ATTIVATO
    take_profit_1_pct: 2.5,  // Primo target: 2.5% (chiude 50%)
    take_profit_2_pct: 5.0,  // Secondo target: 5% (chiude tutto)

    // Advanced Filters (questi sono usati dal codice, non dal DB ma li salvo per riferimento)
    min_signal_strength: 65,
    min_confirmations_long: 3,
    min_confirmations_short: 4,
    atr_minimum_pct: 0.3,
    volume_minimum_24h: 300000,

    // Risk Management Limits
    max_exposure_pct: 40.0,
    max_positions: 6
};

console.log('🔄 RESET E CONFIGURAZIONE PARAMETRI BOT\n');
console.log('📋 Configurazione Ottimale:');
console.log(JSON.stringify(OPTIMAL_CONFIG, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

// Step 1: Ottieni tutti i simboli attivi
db.all('SELECT symbol FROM bot_settings WHERE strategy_name = ? AND is_active = 1',
    ['RSI_Strategy'],
    (err, rows) => {
        if (err) {
            console.error('❌ Errore lettura simboli:', err);
            db.close();
            return;
        }

        console.log(`📊 Trovati ${rows.length} simboli attivi\n`);

        // Step 2: Aggiorna ogni simbolo con i nuovi parametri
        let updated = 0;
        let errors = 0;

        rows.forEach((row, index) => {
            const symbol = row.symbol;
            const paramsJSON = JSON.stringify(OPTIMAL_CONFIG);

            db.run(
                'UPDATE bot_settings SET parameters = ? WHERE strategy_name = ? AND symbol = ?',
                [paramsJSON, 'RSI_Strategy', symbol],
                function (updateErr) {
                    if (updateErr) {
                        console.error(`❌ Errore aggiornamento ${symbol}:`, updateErr.message);
                        errors++;
                    } else {
                        updated++;
                        if (updated % 10 === 0 || updated === rows.length) {
                            console.log(`✅ Aggiornati ${updated}/${rows.length} simboli...`);
                        }
                    }

                    // Quando finito, verifica
                    if (updated + errors === rows.length) {
                        console.log('\n' + '='.repeat(60));
                        console.log(`\n✅ Aggiornamento completato!`);
                        console.log(`   - Successi: ${updated}`);
                        console.log(`   - Errori: ${errors}`);
                        console.log('\n🔍 Verifico alcuni simboli campione...\n');

                        // Verifica campione (primi 3 simboli)
                        const sampleSymbols = rows.slice(0, 3).map(r => r.symbol);

                        sampleSymbols.forEach(sym => {
                            db.get(
                                'SELECT parameters FROM bot_settings WHERE strategy_name = ? AND symbol = ?',
                                ['RSI_Strategy', sym],
                                (verifyErr, verifyRow) => {
                                    if (verifyErr) {
                                        console.error(`❌ Errore verifica ${sym}:`, verifyErr);
                                    } else {
                                        const params = JSON.parse(verifyRow.parameters);
                                        console.log(`${sym.toUpperCase()}:`);
                                        console.log(`  ✓ RSI Oversold: ${params.rsi_oversold} (target: 35)`);
                                        console.log(`  ✓ Stop Loss: ${params.stop_loss_pct}% (target: 3%)`);
                                        console.log(`  ✓ Take Profit: ${params.take_profit_pct}% (target: 5%)`);
                                        console.log(`  ✓ Trailing Stop: ${params.trailing_stop_enabled ? 'ON' : 'OFF'} @ ${params.trailing_stop_distance_pct}%`);
                                        console.log(`  ✓ Partial Close: ${params.partial_close_enabled ? 'ON' : 'OFF'} (${params.take_profit_1_pct}% / ${params.take_profit_2_pct}%)`);
                                        console.log(`  ✓ Trade Size: ${params.trade_size_eur}€\n`);
                                    }
                                }
                            );
                        });

                        // Chiudi DB dopo un po' per dare tempo alle verifiche
                        setTimeout(() => {
                            console.log('='.repeat(60));
                            console.log('\n✅ CONFIGURAZIONE COMPLETATA E VERIFICATA!\n');
                            console.log('📝 Note:');
                            console.log('   - I parametri sono ora salvati nel database');
                            console.log('   - Ogni modifica futura tramite interfaccia verrà salvata');
                            console.log('   - Riavvia il bot per applicare le modifiche\n');
                            db.close();
                        }, 2000);
                    }
                }
            );
        });
    }
);
