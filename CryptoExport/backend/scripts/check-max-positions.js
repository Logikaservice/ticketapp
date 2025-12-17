/**
 * 🔍 Script per verificare il limite max_positions nel database PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkMaxPositions() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔍 Verifica max_positions nel database PostgreSQL\n');

        // Query per ottenere tutti i bot_settings
        const result = await pool.query(
            "SELECT id, strategy_name, symbol, is_active, parameters FROM bot_settings ORDER BY id"
        );

        if (result.rows.length === 0) {
            console.log('❌ NESSUN RECORD TROVATO in bot_settings');
            console.log('   Il database non ha impostazioni salvate.\n');
            return;
        }

        console.log(`✅ Trovati ${result.rows.length} record in bot_settings:\n`);

        for (const record of result.rows) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📋 Record ID: ${record.id}`);
            console.log(`   Strategy: ${record.strategy_name}`);
            console.log(`   Symbol: ${record.symbol}`);
            console.log(`   Active: ${record.is_active}`);

            // Parse parameters
            let params;
            try {
                if (typeof record.parameters === 'string') {
                    params = JSON.parse(record.parameters);
                } else {
                    params = record.parameters;
                }
            } catch (err) {
                console.log(`   ❌ Errore parsing parameters: ${err.message}`);
                console.log(`   Raw: ${record.parameters}`);
                continue;
            }

            // Mostra parametri chiave per il limite posizioni
            console.log('\n   🔢 LIMITI POSIZIONI:');
            console.log(`      max_positions: ${params.max_positions !== undefined ? params.max_positions : '❌ NON IMPOSTATO'}`);
            console.log(`      max_positions_per_group: ${params.max_positions_per_group !== undefined ? params.max_positions_per_group : '❌ NON IMPOSTATO'}`);
            console.log(`      max_positions_per_symbol: ${params.max_positions_per_symbol !== undefined ? params.max_positions_per_symbol : '❌ NON IMPOSTATO'}`);
            
            console.log('\n   💰 TRADE SIZE:');
            console.log(`      trade_size_usdt: ${params.trade_size_usdt !== undefined ? `$${params.trade_size_usdt}` : '❌ NON IMPOSTATO'}`);
            
            console.log('\n   📊 ALTRI PARAMETRI:');
            console.log(`      stop_loss_pct: ${params.stop_loss_pct !== undefined ? `${params.stop_loss_pct}%` : '❌ NON IMPOSTATO'}`);
            console.log(`      take_profit_pct: ${params.take_profit_pct !== undefined ? `${params.take_profit_pct}%` : '❌ NON IMPOSTATO'}`);
            console.log(`      min_signal_strength: ${params.min_signal_strength !== undefined ? params.min_signal_strength : '❌ NON IMPOSTATO'}`);
            console.log('');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Verifica posizioni aperte
        const positionsResult = await pool.query(
            "SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'"
        );
        const openCount = parseInt(positionsResult.rows[0]?.count || 0);
        console.log(`📊 Posizioni attualmente aperte: ${openCount}\n`);

        // Diagnosi
        const globalSettings = result.rows.find(r => r.symbol === 'global' || r.symbol === 'bitcoin_usdt');
        if (globalSettings) {
            let params;
            try {
                params = typeof globalSettings.parameters === 'string' 
                    ? JSON.parse(globalSettings.parameters) 
                    : globalSettings.parameters;
                
                const maxPos = params.max_positions;
                if (maxPos !== undefined) {
                    console.log('🔍 DIAGNOSI:');
                    if (maxPos === 2) {
                        console.log(`   ⚠️  PROBLEMA TROVATO!`);
                        console.log(`   Il database ha max_positions = ${maxPos}`);
                        console.log(`   Anche se configuri 10 nell'interfaccia, il database ha ancora ${maxPos}!`);
                        console.log(`\n💡 SOLUZIONE:`);
                        console.log(`   1. Vai nelle impostazioni del bot`);
                        console.log(`   2. Modifica "Max Posizioni" da ${maxPos} a 10`);
                        console.log(`   3. Clicca "Salva Impostazioni"`);
                        console.log(`   4. Riavvia il bot\n`);
                    } else if (openCount >= maxPos) {
                        console.log(`   ⚠️  Limite raggiunto!`);
                        console.log(`   Posizioni aperte: ${openCount}/${maxPos}`);
                        console.log(`   Il bot non aprirà nuove posizioni finché non scende sotto ${maxPos}\n`);
                    } else {
                        console.log(`   ✅ OK - Configurazione corretta`);
                        console.log(`   max_positions = ${maxPos}, posizioni aperte = ${openCount}\n`);
                    }
                } else {
                    console.log('   ❌ max_positions non trovato nel database!\n');
                }
            } catch (err) {
                console.log(`   ❌ Errore analisi: ${err.message}\n`);
            }
        }

    } catch (err) {
        console.error('❌ Errore:', err.message);
        throw err;
    } finally {
        await pool.end();
    }
}

checkMaxPositions()
    .then(() => {
        console.log('✅ Verifica completata');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Errore fatale:', err.message);
        process.exit(1);
    });
