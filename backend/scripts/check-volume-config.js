const { dbGet } = require('../crypto_db');

(async () => {
    try {
        const bot = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        
        if (bot && bot.parameters) {
            const params = typeof bot.parameters === 'string' 
                ? JSON.parse(bot.parameters) 
                : bot.parameters;
            
            console.log('📊 Volume minimo 24h configurato:', params.min_volume_24h);
            console.log('\n📋 Tutti i parametri rilevanti:');
            console.log('  - min_volume_24h:', params.min_volume_24h);
            console.log('  - min_signal_strength:', params.min_signal_strength);
            console.log('  - min_confirmations_long:', params.min_confirmations_long);
            console.log('  - min_confirmations_short:', params.min_confirmations_short);
        } else {
            console.log('⚠️ Nessun parametro trovato in bot_settings');
        }
    } catch(e) {
        console.error('❌ Errore:', e.message);
    }
    process.exit(0);
})();

