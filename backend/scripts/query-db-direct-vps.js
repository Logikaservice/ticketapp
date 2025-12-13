// Query diretta al database VPS usando lo stesso metodo del backend
const { Pool } = require('pg');

// Usa la stessa connessione del backend (locale sulla VPS)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL_CRYPTO || 'postgresql://postgres@localhost:5432/crypto_db',
    ssl: false
});

async function queryDatabase() {
    console.log('🔍 Query diretta database VPS\n');
    
    try {
        // Query parametri global
        const result = await pool.query(
            `SELECT symbol, parameters 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'`
        );
        
        if (result.rows.length === 0) {
            console.log('❌ Nessun record global trovato!');
            return;
        }
        
        const row = result.rows[0];
        const params = typeof row.parameters === 'string' 
            ? JSON.parse(row.parameters)
            : row.parameters;
        
        console.log('✅ Record global trovato');
        console.log(`📊 min_volume_24h: ${params.min_volume_24h}`);
        console.log(`📋 Totale parametri: ${Object.keys(params).length}\n`);
        
        console.log('Altri parametri chiave:');
        console.log(`   - rsi_period: ${params.rsi_period}`);
        console.log(`   - rsi_oversold: ${params.rsi_oversold}`);
        console.log(`   - rsi_overbought: ${params.rsi_overbought}`);
        console.log(`   - stop_loss_pct: ${params.stop_loss_pct}`);
        console.log(`   - take_profit_pct: ${params.take_profit_pct}`);
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        await pool.end();
    }
}

queryDatabase();
