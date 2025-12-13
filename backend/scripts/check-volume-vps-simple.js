// Verifica min_volume_24h su database VPS (semplificato)
const { Client } = require('pg');

async function verifica() {
    // Connessione diretta senza password (come sulla VPS)
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'crypto_db',
        port: 5432
    });
    
    try {
        await client.connect();
        console.log('✅ Connesso a crypto_db\n');
        
        // Query record global
        const result = await client.query(
            `SELECT symbol, parameters 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'`
        );
        
        if (result.rows.length === 0) {
            console.log('❌ Nessun record global trovato!');
            await client.end();
            return;
        }
        
        const params = typeof result.rows[0].parameters === 'string'
            ? JSON.parse(result.rows[0].parameters)
            : result.rows[0].parameters;
        
        console.log('📊 Parametri GLOBAL:');
        console.log('   min_volume_24h:', params.min_volume_24h);
        console.log('   Totale parametri:', Object.keys(params).length);
        console.log('\n📋 Alcuni parametri:');
        console.log('   rsi_period:', params.rsi_period);
        console.log('   rsi_oversold:', params.rsi_oversold);
        console.log('   rsi_overbought:', params.rsi_overbought);
        console.log('   take_profit:', params.take_profit);
        console.log('   stop_loss:', params.stop_loss);
        
        await client.end();
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

verifica();
