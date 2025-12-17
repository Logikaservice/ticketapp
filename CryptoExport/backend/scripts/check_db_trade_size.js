#!/usr/bin/env node
/**
 * 🔍 Script per verificare direttamente nel database cosa c'è salvato per trade_size_usdt
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cryptoDb = require('../crypto_db');
const dbGet = cryptoDb.dbGet;

async function checkDbTradeSize() {
    try {
        console.log('🔍 Verifica diretta nel database...\n');

        // Leggi direttamente dal database
        const globalBot = await dbGet(
            "SELECT id, symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!globalBot) {
            console.log('❌ Nessun record globale trovato nel database!\n');
            return;
        }

        console.log('✅ Record globale trovato:');
        console.log(`   ID: ${globalBot.id}`);
        console.log(`   Symbol: ${globalBot.symbol}`);
        console.log(`   Parameters (raw): ${globalBot.parameters ? globalBot.parameters.substring(0, 200) : 'NULL'}...\n`);

        if (!globalBot.parameters) {
            console.log('❌ Parameters è NULL nel database!\n');
            return;
        }

        // Parse JSON
        let params;
        try {
            params = typeof globalBot.parameters === 'string' 
                ? JSON.parse(globalBot.parameters) 
                : globalBot.parameters;
        } catch (parseErr) {
            console.error('❌ Errore parsing JSON:', parseErr.message);
            return;
        }

        console.log('📊 Parametri parsati dal database:');
        console.log(`   trade_size_usdt: ${params.trade_size_usdt} (type: ${typeof params.trade_size_usdt})`);
        console.log(`   trade_size_eur: ${params.trade_size_eur} (type: ${typeof params.trade_size_eur})`);
        console.log(`   max_positions: ${params.max_positions} (type: ${typeof params.max_positions})`);
        console.log(`   stop_loss_pct: ${params.stop_loss_pct}`);
        console.log(`   take_profit_pct: ${params.take_profit_pct}`);
        console.log(`   Total keys: ${Object.keys(params).length}\n`);

        // Verifica presenza
        console.log('🔍 Verifica presenza chiavi:');
        console.log(`   'trade_size_usdt' in params: ${'trade_size_usdt' in params}`);
        console.log(`   'trade_size_eur' in params: ${'trade_size_eur' in params}`);
        console.log(`   'max_positions' in params: ${'max_positions' in params}\n`);

        // Verifica valori null/undefined
        if (params.trade_size_usdt === null || params.trade_size_usdt === undefined) {
            console.log('⚠️  PROBLEMA: trade_size_usdt è null o undefined nel database!');
        } else if (params.trade_size_usdt === 0 || isNaN(params.trade_size_usdt)) {
            console.log('⚠️  PROBLEMA: trade_size_usdt è 0 o NaN nel database!');
        } else {
            console.log(`✅ trade_size_usdt ha un valore valido: ${params.trade_size_usdt}`);
        }

        if (params.max_positions === null || params.max_positions === undefined) {
            console.log('⚠️  PROBLEMA: max_positions è null o undefined nel database!');
        } else if (params.max_positions === 0 || isNaN(params.max_positions)) {
            console.log('⚠️  PROBLEMA: max_positions è 0 o NaN nel database!');
        } else {
            console.log(`✅ max_positions ha un valore valido: ${params.max_positions}`);
        }

        console.log('\n📋 Tutte le chiavi nei parametri:');
        Object.keys(params).forEach(key => {
            console.log(`   - ${key}: ${params[key]} (${typeof params[key]})`);
        });

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await cryptoDb.close?.() || process.exit(0);
    }
}

checkDbTradeSize();
