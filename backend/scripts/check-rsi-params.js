/**
 * Script per verificare i parametri RSI attualmente configurati nel database
 */

const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ticketapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

const checkRSIParams = async () => {
    console.log('🔍 VERIFICA PARAMETRI RSI NEL DATABASE');
    console.log('='.repeat(60));
    
    try {
        // Verifica tutti i bot_settings
        const result = await pool.query(
            "SELECT symbol, parameters, is_active FROM bot_settings WHERE strategy_name = 'RSI_Strategy' ORDER BY symbol"
        );
        
        console.log(`\n📊 Trovati ${result.rows.length} record in bot_settings:\n`);
        
        if (result.rows.length === 0) {
            console.log('⚠️  Nessun record trovato! I parametri useranno i default:');
            console.log('   - rsi_period: 14');
            console.log('   - rsi_oversold: 30');
            console.log('   - rsi_overbought: 70');
        } else {
            result.rows.forEach((row, index) => {
                console.log(`${index + 1}. Simbolo: ${row.symbol}`);
                console.log(`   Attivo: ${row.is_active ? 'SÌ' : 'NO'}`);
                
                if (row.parameters) {
                    try {
                        const params = typeof row.parameters === 'string' 
                            ? JSON.parse(row.parameters) 
                            : row.parameters;
                        
                        console.log(`   Parametri RSI:`);
                        console.log(`      - rsi_period: ${params.rsi_period || 'NON CONFIGURATO (default: 14)'}`);
                        console.log(`      - rsi_oversold: ${params.rsi_oversold || 'NON CONFIGURATO (default: 30)'}`);
                        console.log(`      - rsi_overbought: ${params.rsi_overbought || 'NON CONFIGURATO (default: 70)'}`);
                        
                        // Mostra anche altri parametri se presenti
                        if (params.stop_loss_pct) console.log(`      - stop_loss_pct: ${params.stop_loss_pct}`);
                        if (params.take_profit_pct) console.log(`      - take_profit_pct: ${params.take_profit_pct}`);
                    } catch (e) {
                        console.log(`   ⚠️  Errore parsing parametri: ${e.message}`);
                        console.log(`   Raw: ${row.parameters}`);
                    }
                } else {
                    console.log(`   ⚠️  Nessun parametro configurato (userà default)`);
                }
                console.log('');
            });
        }
        
        // Verifica parametri globali (senza symbol)
        const globalResult = await pool.query(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND (symbol IS NULL OR symbol = '') LIMIT 1"
        );
        
        if (globalResult.rows.length > 0) {
            console.log('🌐 Parametri globali trovati:');
            const globalParams = typeof globalResult.rows[0].parameters === 'string'
                ? JSON.parse(globalResult.rows[0].parameters)
                : globalResult.rows[0].parameters;
            console.log(`   - rsi_period: ${globalParams.rsi_period || 'NON CONFIGURATO'}`);
            console.log(`   - rsi_oversold: ${globalParams.rsi_oversold || 'NON CONFIGURATO'}`);
            console.log(`   - rsi_overbought: ${globalParams.rsi_overbought || 'NON CONFIGURATO'}`);
        }
        
        console.log('\n✅ Verifica completata!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Errore durante la verifica:', error);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
};

checkRSIParams();















