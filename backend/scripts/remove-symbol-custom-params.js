/**
 * Script per rimuovere parametri personalizzati da simboli specifici
 * Rimuove trade_size_usdt e altri parametri personalizzati da near, op, xlm
 * per farli usare i parametri globali
 */

const { dbGet, dbAll, dbRun } = require('../crypto_db');

async function removeSymbolCustomParams() {
    try {
        console.log('🧹 Rimozione parametri personalizzati da simboli...\n');

        // Simboli da cui rimuovere i parametri personalizzati
        const symbolsToClean = ['near', 'op', 'xlm', 'near_eur', 'op_eur', 'xlm_eur'];

        let updated = 0;
        let skipped = 0;
        const cleanedSymbols = [];

        for (const symbol of symbolsToClean) {
            try {
                // Verifica se il simbolo esiste
                const setting = await dbGet(
                    "SELECT id, symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
                    [symbol]
                );

                if (!setting) {
                    console.log(`  ⏭️  ${symbol}: non trovato nel database`);
                    skipped++;
                    continue;
                }

                let params = {};
                if (setting.parameters) {
                    params = typeof setting.parameters === 'string' 
                        ? JSON.parse(setting.parameters) 
                        : setting.parameters;
                }

                // Rimuovi parametri personalizzati che dovrebbero essere globali
                const paramsToRemove = [
                    'trade_size_usdt',
                    'trade_size_eur',
                    'min_signal_strength',
                    'min_confirmations_long',
                    'min_confirmations_short',
                    'min_volume_24h',
                    'stop_loss_pct',
                    'take_profit_pct',
                    'max_positions'
                ];

                let needsUpdate = false;
                const removedParams = [];

                for (const param of paramsToRemove) {
                    if (param in params) {
                        delete params[param];
                        removedParams.push(param);
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    await dbRun(
                        "UPDATE bot_settings SET parameters = $1::text WHERE id = $2",
                        [JSON.stringify(params), setting.id]
                    );
                    console.log(`  ✅ ${symbol}: rimossi parametri personalizzati: ${removedParams.join(', ')}`);
                    updated++;
                    cleanedSymbols.push({ symbol, removedParams });
                } else {
                    console.log(`  ⏭️  ${symbol}: nessun parametro personalizzato da rimuovere`);
                    skipped++;
                }
            } catch (err) {
                console.error(`  ❌ Errore aggiornamento ${symbol}:`, err.message);
                skipped++;
            }
        }

        console.log(`\n✅ Completato!`);
        console.log(`   - Aggiornati: ${updated} simboli`);
        console.log(`   - Saltati: ${skipped} simboli`);
        
        if (cleanedSymbols.length > 0) {
            console.log(`\n📋 Simboli puliti:`);
            for (const item of cleanedSymbols) {
                console.log(`   - ${item.symbol}: rimossi ${item.removedParams.join(', ')}`);
            }
        }

        console.log(`\n✅ I simboli ora useranno i parametri globali!`);

    } catch (error) {
        console.error('❌ Errore durante rimozione parametri personalizzati:', error);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    removeSymbolCustomParams()
        .then(() => {
            console.log('\n✅ Script completato con successo');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Errore durante esecuzione script:', err);
            process.exit(1);
        });
}

module.exports = { removeSymbolCustomParams };
