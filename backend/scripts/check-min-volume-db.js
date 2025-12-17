// Verifica min_volume_24h usando esattamente lo stesso modulo del backend
const cryptoDb = require('../crypto_db');
const { dbGet } = cryptoDb;

async function checkMinVolume() {
    console.log('🔍 Verifica min_volume_24h da database\n');
    
    try {
        // Query record global
        const result = await dbGet(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'",
            []
        );
        
        if (!result) {
            console.log('❌ Nessun record global trovato!');
            return;
        }
        
        const params = typeof result.parameters === 'string'
            ? JSON.parse(result.parameters)
            : result.parameters;
        
        console.log('✅ Record global trovato');
        console.log(`\n📊 min_volume_24h: ${params.min_volume_24h}`);
        console.log(`📋 Totale parametri: ${Object.keys(params).length}`);
        
        console.log('\n🔍 Altri parametri rilevanti:');
        console.log(`   rsi_period: ${params.rsi_period}`);
        console.log(`   rsi_oversold: ${params.rsi_oversold}`);
        console.log(`   rsi_overbought: ${params.rsi_overbought}`);
        console.log(`   stop_loss_pct: ${params.stop_loss_pct}`);
        console.log(`   take_profit_pct: ${params.take_profit_pct}`);
        console.log(`   trade_size_usdt: ${params.trade_size_usdt}`);
        
        // Confronta con API
        console.log('\n🔍 Confronto con API backend:');
        console.log(`   min_volume_24h nel DB: ${params.min_volume_24h}`);
        console.log(`   min_volume_24h dall'API: 500000 (verificato prima)`);
        
        if (params.min_volume_24h !== 500000) {
            console.log('\n⚠️  DISCREPANZA RILEVATA!');
            console.log('   Il valore nel database è diverso da quello restituito dall\'API');
            console.log('   Possibili cause:');
            console.log('   1. L\'API usa un altro fallback');
            console.log('   2. C\'è un errore nel merge dei parametri');
            console.log('   3. Il backend non legge correttamente dal database');
        } else {
            console.log('\n✅ Valori corrispondenti');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

checkMinVolume();







