/**
 * Script per verificare direttamente nel database il valore di min_volume_24h
 */

const { dbAll, dbGet } = require('../crypto_db');

async function verificaDatabase() {
    try {
        console.log('🔍 Verifica diretta database - Volume Minimo 24h\n');
        console.log('='.repeat(60));

        // 1. Verifica tutti i record in bot_settings
        const allSettings = await dbAll(
            "SELECT symbol, strategy_name, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' ORDER BY symbol"
        );

        console.log(`📊 Trovati ${allSettings.length} record in bot_settings:\n`);

        for (const setting of allSettings) {
            const params = typeof setting.parameters === 'string' 
                ? JSON.parse(setting.parameters) 
                : setting.parameters;
            
            console.log(`Symbol: ${setting.symbol}`);
            console.log(`  min_volume_24h: ${params.min_volume_24h}`);
            console.log(`  (tipo: ${typeof params.min_volume_24h})`);
            console.log('');
        }

        // 2. Verifica specificamente il record 'global'
        console.log('='.repeat(60));
        console.log('\n🔍 Verifica record GLOBAL:\n');
        
        const global = await dbAll(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );

        if (global.length === 0) {
            console.log('❌ Nessun record GLOBAL trovato!');
        } else {
            for (const row of global) {
                const params = typeof row.parameters === 'string' 
                    ? JSON.parse(row.parameters) 
                    : row.parameters;
                
                console.log(`Symbol: ${row.symbol}`);
                console.log(`Parameters (raw): ${row.parameters.substring(0, 200)}...`);
                console.log(`min_volume_24h: ${params.min_volume_24h}`);
                console.log(`  Valore esatto: ${JSON.stringify(params.min_volume_24h)}`);
                console.log(`  Tipo: ${typeof params.min_volume_24h}`);
            }
        }

        // 3. Verifica come viene letto da getBotParameters (NUOVA LOGICA CON MERGE)
        console.log('\n' + '='.repeat(60));
        console.log('\n🔍 Verifica lettura tramite getBotParameters (NUOVA LOGICA):\n');
        
        // Simula la NUOVA logica di getBotParameters (merge corretto)
        const globalBot = await dbGet(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );
        const symbolBot = await dbGet(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'bitcoin'"
        );

        let mergedParams = {};
        if (globalBot && globalBot.parameters) {
            const globalParams = typeof globalBot.parameters === 'string' 
                ? JSON.parse(globalBot.parameters) 
                : globalBot.parameters;
            mergedParams = { ...mergedParams, ...globalParams };
            console.log('✅ Parametri globali caricati');
        }
        if (symbolBot && symbolBot.parameters) {
            const symbolParams = typeof symbolBot.parameters === 'string' 
                ? JSON.parse(symbolBot.parameters) 
                : symbolBot.parameters;
            mergedParams = { ...mergedParams, ...symbolParams };
            console.log('✅ Parametri simbolo caricati e merge eseguito');
        }
        
        console.log(`min_volume_24h (dopo merge): ${mergedParams.min_volume_24h}`);

        // 4. Verifica come viene letto nel TradingBot (NUOVA LOGICA CON MERGE)
        console.log('\n' + '='.repeat(60));
        console.log('\n🔍 Verifica lettura nel TradingBot (NUOVA LOGICA):\n');
        
        const globalSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );
        const symbolSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'bitcoin'"
        );

        let settingsParams = {};
        if (globalSettings?.parameters) {
            settingsParams = typeof globalSettings.parameters === 'string' 
                ? JSON.parse(globalSettings.parameters) 
                : globalSettings.parameters;
        }
        if (symbolSettings?.parameters) {
            const symbolParams = typeof symbolSettings.parameters === 'string' 
                ? JSON.parse(symbolSettings.parameters) 
                : symbolSettings.parameters;
            settingsParams = { ...settingsParams, ...symbolParams };
        }
        
        console.log(`min_volume_24h letto (dopo merge): ${settingsParams.min_volume_24h}`);

    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
    }
}

verificaDatabase()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Errore fatale:', err);
        process.exit(1);
    });
