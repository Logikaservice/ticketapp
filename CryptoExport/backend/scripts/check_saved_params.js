#!/usr/bin/env node
/**
 * 🔍 Script per verificare cosa è stato salvato nel database dopo il salvataggio
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cryptoDb = require('../crypto_db');
const dbGet = cryptoDb.dbGet;

async function checkSavedParams() {
    try {
        console.log('🔍 Verifica parametri salvati nel database...\n');

        const globalBot = await dbGet(
            "SELECT id, symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!globalBot) {
            console.log('❌ Nessun record globale trovato!\n');
            return;
        }

        console.log('✅ Record globale trovato (ID:', globalBot.id, ')\n');

        if (!globalBot.parameters) {
            console.log('❌ Parameters è NULL!\n');
            return;
        }

        const params = typeof globalBot.parameters === 'string' 
            ? JSON.parse(globalBot.parameters) 
            : globalBot.parameters;

        console.log('📊 Parametri salvati nel database:\n');
        console.log('   trade_size_usdt:', params.trade_size_usdt, '(type:', typeof params.trade_size_usdt, ')');
        console.log('   test_trade_size:', params.test_trade_size, '(type:', typeof params.test_trade_size, ')');
        console.log('   max_positions:', params.max_positions, '(type:', typeof params.max_positions, ')');
        console.log('   stop_loss_pct:', params.stop_loss_pct);
        console.log('   take_profit_pct:', params.take_profit_pct);
        console.log('\n');

        console.log('🔍 Verifica presenza chiavi:\n');
        console.log('   "trade_size_usdt" in params:', 'trade_size_usdt' in params);
        console.log('   "test_trade_size" in params:', 'test_trade_size' in params);
        console.log('   "max_positions" in params:', 'max_positions' in params);
        console.log('\n');

        // ✅ TEST: Confronta
        if (params.test_trade_size && params.test_trade_size !== 999) {
            console.log('✅ test_trade_size è presente e diverso dal default:', params.test_trade_size);
            if (!params.trade_size_usdt || params.trade_size_usdt === null || params.trade_size_usdt === undefined) {
                console.log('\n❌ PROBLEMA CONFERMATO: test_trade_size funziona ma trade_size_usdt NO!');
                console.log('   Questo significa che trade_size_usdt viene rimosso da qualche logica.\n');
            } else {
                console.log('✅ Entrambi i campi sono presenti\n');
            }
        } else if (params.test_trade_size === 999) {
            console.log('ℹ️  test_trade_size ha il valore default (999) - non è stato modificato\n');
        } else {
            console.log('⚠️  test_trade_size non è presente\n');
        }

        console.log('📋 Tutte le chiavi nei parametri:');
        Object.keys(params).sort().forEach(key => {
            const value = params[key];
            const type = typeof value;
            console.log(`   - ${key}: ${value} (${type})`);
        });

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

checkSavedParams();
