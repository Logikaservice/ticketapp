// Script per verificare min_volume_24h sul database VPS
require('dotenv').config();
const { Client } = require('pg');

async function verificaVolumeMinimo() {
    console.log('🔍 Verifica min_volume_24h su database VPS');
    console.log('==========================================\n');
    
    // Usa DATABASE_URL_CRYPTO dalla VPS (dovrebbe essere localhost sulla VPS)
    const dbUrl = process.env.DATABASE_URL_CRYPTO || 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/crypto_db';
    
    console.log('📊 Database:', dbUrl.replace(/:[^:]*@/, ':****@'), '\n');
    
    const client = new Client({ connectionString: dbUrl });
    
    try {
        await client.connect();
        console.log('✅ Connesso al database\n');
        
        // 1. Verifica record global
        console.log('1️⃣ Verifica record "global":');
        const globalResult = await client.query(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );
        
        if (globalResult.rows.length === 0) {
            console.log('   ❌ Nessun record global trovato!\n');
        } else {
            const global = globalResult.rows[0];
            const params = typeof global.parameters === 'string' 
                ? JSON.parse(global.parameters) 
                : global.parameters;
            
            console.log('   ✅ Record trovato');
            console.log('   📊 min_volume_24h:', params.min_volume_24h);
            console.log('   📋 Altri parametri:', Object.keys(params).length, 'totali\n');
        }
        
        // 2. Verifica alcuni record symbol-specific
        console.log('2️⃣ Verifica record symbol-specific (primi 5):');
        const symbolsResult = await client.query(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol != 'global' LIMIT 5"
        );
        
        if (symbolsResult.rows.length === 0) {
            console.log('   ℹ️  Nessun record symbol-specific trovato\n');
        } else {
            for (const row of symbolsResult.rows) {
                const params = typeof row.parameters === 'string' 
                    ? JSON.parse(row.parameters) 
                    : row.parameters;
                
                console.log(`   • ${row.symbol}:`, params.min_volume_24h || 'non definito');
            }
            console.log('');
        }
        
        // 3. Simula getBotParameters merge logic
        console.log('3️⃣ Simula getBotParameters (con merge):');
        const testSymbol = 'BTCUSDT';
        
        const globalSettings = await client.query(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );
        const symbolSettings = await client.query(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
            [testSymbol]
        );
        
        let mergedParams = {};
        if (globalSettings.rows[0]?.parameters) {
            const globalParams = typeof globalSettings.rows[0].parameters === 'string'
                ? JSON.parse(globalSettings.rows[0].parameters)
                : globalSettings.rows[0].parameters;
            mergedParams = { ...globalParams };
        }
        if (symbolSettings.rows[0]?.parameters) {
            const symbolParams = typeof symbolSettings.rows[0].parameters === 'string'
                ? JSON.parse(symbolSettings.rows[0].parameters)
                : symbolSettings.rows[0].parameters;
            mergedParams = { ...mergedParams, ...symbolParams };
        }
        
        console.log(`   Simbolo test: ${testSymbol}`);
        console.log(`   min_volume_24h finale: ${mergedParams.min_volume_24h}`);
        console.log(`   (dopo merge global + symbol-specific)\n`);
        
        // 4. Conta totale record
        const countResult = await client.query(
            "SELECT COUNT(*) FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );
        console.log('4️⃣ Totale record bot_settings:', countResult.rows[0].count, '\n');
        
        await client.end();
        console.log('✅ Verifica completata');
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

verificaVolumeMinimo();







