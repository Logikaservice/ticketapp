/**
 * Script per verificare se XLM o altri simboli hanno parametri personalizzati
 * che li differenziano dagli altri
 */

const { dbAll, dbGet } = require('../crypto_db');

async function checkSymbolParams() {
    try {
        console.log('🔍 Verifica parametri personalizzati per simboli...\n');

        // 1. Carica parametri globali
        const globalSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );

        let globalParams = {};
        if (globalSettings?.parameters) {
            globalParams = typeof globalSettings.parameters === 'string' 
                ? JSON.parse(globalSettings.parameters) 
                : globalSettings.parameters;
        }

        console.log('📊 Parametri GLOBALI:');
        console.log(JSON.stringify(globalParams, null, 2));
        console.log('\n' + '='.repeat(60) + '\n');

        // 2. Carica tutti i simboli attivi
        const allSymbols = await dbAll(
            "SELECT symbol, is_active, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol != 'global' ORDER BY symbol"
        );

        console.log(`📋 Trovati ${allSymbols.length} simboli nel database\n`);

        const symbolsWithCustomParams = [];
        const activeSymbols = [];

        for (const symbol of allSymbols) {
            if (symbol.is_active === 1) {
                activeSymbols.push(symbol.symbol);
            }

            let symbolParams = {};
            if (symbol.parameters) {
                symbolParams = typeof symbol.parameters === 'string' 
                    ? JSON.parse(symbol.parameters) 
                    : symbol.parameters;
            }

            // Confronta con parametri globali
            const differences = {};
            const importantParams = [
                'min_signal_strength',
                'min_confirmations_long',
                'min_confirmations_short',
                'min_volume_24h',
                'trade_size_usdt',
                'trade_size_eur',
                'stop_loss_pct',
                'take_profit_pct',
                'max_positions'
            ];

            for (const param of importantParams) {
                const globalValue = globalParams[param];
                const symbolValue = symbolParams[param];

                if (symbolValue !== undefined && symbolValue !== globalValue) {
                    differences[param] = {
                        global: globalValue,
                        symbol: symbolValue
                    };
                }
            }

            if (Object.keys(differences).length > 0) {
                symbolsWithCustomParams.push({
                    symbol: symbol.symbol,
                    is_active: symbol.is_active === 1,
                    differences,
                    allParams: symbolParams
                });
            }
        }

        console.log(`✅ Simboli ATTIVI: ${activeSymbols.length}`);
        console.log(`   ${activeSymbols.join(', ')}\n`);

        if (symbolsWithCustomParams.length > 0) {
            console.log(`⚠️  Trovati ${symbolsWithCustomParams.length} simboli con parametri PERSONALIZZATI:\n`);
            
            for (const item of symbolsWithCustomParams) {
                console.log(`📌 ${item.symbol} ${item.is_active ? '(ATTIVO)' : '(INATTIVO)'}`);
                console.log('   Differenze dai parametri globali:');
                for (const [param, values] of Object.entries(item.differences)) {
                    console.log(`      - ${param}:`);
                    console.log(`        Globale: ${values.global !== undefined ? values.global : 'NON DEFINITO'}`);
                    console.log(`        Simbolo: ${values.symbol}`);
                }
                console.log('');
            }
        } else {
            console.log('✅ Nessun simbolo ha parametri personalizzati - tutti usano i parametri globali\n');
        }

        // 3. Verifica specificamente XLM
        console.log('='.repeat(60));
        console.log('🔍 VERIFICA SPECIFICA XLM:\n');

        const xlmVariants = ['xlm', 'xlm_eur', 'stellar', 'stellar_eur'];
        for (const variant of xlmVariants) {
            const xlmSettings = await dbGet(
                "SELECT symbol, is_active, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
                [variant]
            );

            if (xlmSettings) {
                console.log(`📌 Trovato: ${xlmSettings.symbol} (attivo: ${xlmSettings.is_active === 1})`);
                
                let xlmParams = {};
                if (xlmSettings.parameters) {
                    xlmParams = typeof xlmSettings.parameters === 'string' 
                        ? JSON.parse(xlmSettings.parameters) 
                        : xlmSettings.parameters;
                }

                console.log('   Parametri:');
                console.log(JSON.stringify(xlmParams, null, 2));
                console.log('');

                // Confronta con globali
                const xlmDifferences = {};
                for (const param of importantParams) {
                    if (xlmParams[param] !== undefined && xlmParams[param] !== globalParams[param]) {
                        xlmDifferences[param] = {
                            global: globalParams[param],
                            xlm: xlmParams[param]
                        };
                    }
                }

                if (Object.keys(xlmDifferences).length > 0) {
                    console.log('   ⚠️  DIFFERENZE dai parametri globali:');
                    for (const [param, values] of Object.entries(xlmDifferences)) {
                        console.log(`      - ${param}: Globale=${values.global}, XLM=${values.xlm}`);
                    }
                } else {
                    console.log('   ✅ Nessuna differenza - usa parametri globali');
                }
                console.log('');
            }
        }

    } catch (error) {
        console.error('❌ Errore durante verifica:', error);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    checkSymbolParams()
        .then(() => {
            console.log('\n✅ Verifica completata');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Errore durante esecuzione:', err);
            process.exit(1);
        });
}

module.exports = { checkSymbolParams };
