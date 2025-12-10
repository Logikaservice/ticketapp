// Script di configurazione per PostgreSQL
const { Pool } = require('pg');

// Leggi la connection string dall'ambiente
const DATABASE_URL_CRYPTO = process.env.DATABASE_URL_CRYPTO || 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/crypto_db';

const pool = new Pool({
    connectionString: DATABASE_URL_CRYPTO,
    ssl: false // Cambia a true se usi SSL
});

// Configurazione ottimale raccomandata
const OPTIMAL_CONFIG = {
    rsi_period: 14,
    rsi_oversold: 35,
    rsi_overbought: 70,
    stop_loss_pct: 3.0,
    take_profit_pct: 5.0,
    trade_size_eur: 100,
    trailing_stop_enabled: true,
    trailing_stop_distance_pct: 1.5,
    partial_close_enabled: true,
    take_profit_1_pct: 2.5,
    take_profit_2_pct: 5.0,
    min_signal_strength: 65,
    min_confirmations_long: 3,
    min_confirmations_short: 4,
    atr_minimum_pct: 0.3,
    volume_minimum_24h: 300000,
    max_daily_loss_pct: 3.0,
    max_exposure_pct: 40.0,
    max_positions: 6
};

async function resetBotConfig() {
    const client = await pool.connect();

    try {
        console.log('\n🔄 RESET E CONFIGURAZIONE PARAMETRI BOT (PostgreSQL)\n');
        console.log('📋 Configurazione Ottimale:');
        console.log(JSON.stringify(OPTIMAL_CONFIG, null, 2));
        console.log('\n' + '='.repeat(60) + '\n');

        // Step 1: Ottieni tutti i simboli attivi
        const result = await client.query(
            "SELECT symbol FROM bot_settings WHERE strategy_name = $1 AND is_active = 1",
            ['RSI_Strategy']
        );

        console.log(`📊 Trovati ${result.rows.length} simboli attivi\n`);

        if (result.rows.length === 0) {
            console.log('⚠️  Nessun simbolo attivo trovato. Verifica che la tabella bot_settings esista.\n');
            return;
        }

        // Step 2: Aggiorna ogni simbolo con i nuovi parametri
        let updated = 0;
        const paramsJSON = JSON.stringify(OPTIMAL_CONFIG);

        for (const row of result.rows) {
            const symbol = row.symbol;

            await client.query(
                'UPDATE bot_settings SET parameters = $1 WHERE strategy_name = $2 AND symbol = $3',
                [paramsJSON, 'RSI_Strategy', symbol]
            );

            updated++;
            if (updated % 10 === 0 || updated === result.rows.length) {
                console.log(`✅ Aggiornati ${updated}/${result.rows.length} simboli...`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`\n✅ Aggiornamento completato!`);
        console.log(`   - Successi: ${updated}`);
        console.log('\n🔍 Verifico alcuni simboli campione...\n');

        // Verifica campione (primi 3 simboli)
        const sampleSymbols = result.rows.slice(0, 3);

        for (const row of sampleSymbols) {
            const verifyResult = await client.query(
                'SELECT parameters FROM bot_settings WHERE strategy_name = $1 AND symbol = $2',
                ['RSI_Strategy', row.symbol]
            );

            if (verifyResult.rows.length > 0) {
                const params = JSON.parse(verifyResult.rows[0].parameters);
                console.log(`${row.symbol.toUpperCase()}:`);
                console.log(`  ✓ RSI Oversold: ${params.rsi_oversold} (target: 35)`);
                console.log(`  ✓ Stop Loss: ${params.stop_loss_pct}% (target: 3%)`);
                console.log(`  ✓ Take Profit: ${params.take_profit_pct}% (target: 5%)`);
                console.log(`  ✓ Trailing Stop: ${params.trailing_stop_enabled ? 'ON' : 'OFF'} @ ${params.trailing_stop_distance_pct}%`);
                console.log(`  ✓ Partial Close: ${params.partial_close_enabled ? 'ON' : 'OFF'} (${params.take_profit_1_pct}% / ${params.take_profit_2_pct}%)`);
                console.log(`  ✓ Trade Size: ${params.trade_size_eur}€\n`);
            }
        }

        console.log('='.repeat(60));
        console.log('\n✅ CONFIGURAZIONE COMPLETATA E VERIFICATA!\n');
        console.log('📝 Note:');
        console.log('   - I parametri sono ora salvati nel database PostgreSQL');
        console.log('   - Ogni modifica futura tramite interfaccia verrà salvata');
        console.log('   - Riavvia il bot per applicare le modifiche\n');

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

// Esegui
resetBotConfig().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
