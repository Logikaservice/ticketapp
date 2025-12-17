/**
 * Script per aggiungere trade_size_usdt ai parametri globali se manca
 */

const { dbGet, dbRun } = require('../crypto_db');

async function fixGlobalTradeSize() {
    try {
        console.log('🔧 Aggiunta trade_size_usdt ai parametri globali...\n');

        // 1. Carica parametri globali
        const globalSettings = await dbGet(
            "SELECT id, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );

        if (!globalSettings) {
            console.error('❌ Record globale non trovato!');
            return;
        }

        let params = {};
        if (globalSettings.parameters) {
            params = typeof globalSettings.parameters === 'string' 
                ? JSON.parse(globalSettings.parameters) 
                : globalSettings.parameters;
        }

        console.log('📊 Parametri globali attuali:');
        console.log(JSON.stringify(params, null, 2));
        console.log('');

        // 2. Verifica se trade_size_usdt è presente
        if (!params.trade_size_usdt || params.trade_size_usdt === undefined || params.trade_size_usdt === null) {
            console.log('⚠️  trade_size_usdt mancante nei parametri globali');
            
            // Aggiungi trade_size_usdt con valore 100
            params.trade_size_usdt = 100;
            
            // Salva nel database
            await dbRun(
                "UPDATE bot_settings SET parameters = $1::text WHERE id = $2",
                [JSON.stringify(params), globalSettings.id]
            );
            
            console.log('✅ Aggiunto trade_size_usdt: 100 ai parametri globali');
        } else {
            console.log(`✅ trade_size_usdt già presente: ${params.trade_size_usdt}`);
            
            // Se è diverso da 100, aggiornalo
            if (params.trade_size_usdt !== 100) {
                console.log(`⚠️  trade_size_usdt è ${params.trade_size_usdt}, aggiorno a 100`);
                params.trade_size_usdt = 100;
                
                await dbRun(
                    "UPDATE bot_settings SET parameters = $1::text WHERE id = $2",
                    [JSON.stringify(params), globalSettings.id]
                );
                
                console.log('✅ Aggiornato trade_size_usdt a 100');
            }
        }

        console.log('\n📊 Parametri globali finali:');
        console.log(JSON.stringify(params, null, 2));
        console.log('\n✅ Completato!');

    } catch (error) {
        console.error('❌ Errore durante fix:', error);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    fixGlobalTradeSize()
        .then(() => {
            console.log('\n✅ Script completato con successo');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Errore durante esecuzione script:', err);
            process.exit(1);
        });
}

module.exports = { fixGlobalTradeSize };
