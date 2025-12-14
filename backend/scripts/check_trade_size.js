#!/usr/bin/env node
/**
 * 🔍 Script per verificare il valore di "Dimensione Trade" nel database
 * Uso: node backend/scripts/check_trade_size.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cryptoDb = require('../crypto_db');
const dbGet = cryptoDb.dbGet;

async function checkTradeSize() {
    try {
        console.log('🔍 Verifica Dimensione Trade nel database...\n');

        const result = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!result || !result.parameters) {
            console.log('❌ Nessun record trovato per strategy_name=\'RSI_Strategy\' e symbol=\'global\'');
            console.log('   Verifica che le impostazioni siano state salvate.\n');
            return;
        }

        const params = typeof result.parameters === 'string' 
            ? JSON.parse(result.parameters) 
            : result.parameters;

        console.log('✅ Parametri trovati:\n');
        console.log('   💰 Dimensione Trade (USDT):', params.trade_size_usdt ? `$${params.trade_size_usdt}` : 'NON CONFIGURATO');
        console.log('   💰 Dimensione Trade (EUR):', params.trade_size_eur ? `€${params.trade_size_eur}` : 'NON CONFIGURATO');
        console.log('   📊 Max Posizioni:', params.max_positions || 'NON CONFIGURATO');
        console.log('');

        // Mostra altri parametri importanti
        console.log('📋 Altri parametri importanti:');
        console.log('   - RSI Period:', params.rsi_period || 'N/A');
        console.log('   - RSI Oversold:', params.rsi_oversold || 'N/A');
        console.log('   - RSI Overbought:', params.rsi_overbought || 'N/A');
        console.log('   - Stop Loss (%):', params.stop_loss_pct || 'N/A');
        console.log('   - Take Profit (%):', params.take_profit_pct || 'N/A');
        console.log('   - Min Signal Strength:', params.min_signal_strength || 'N/A');
        console.log('');

        // Verifica se il valore è corretto
        const expectedTradeSize = 100;
        const actualTradeSize = params.trade_size_usdt || params.trade_size_eur;

        if (actualTradeSize && actualTradeSize !== expectedTradeSize) {
            console.log(`⚠️  ATTENZIONE: Dimensione Trade è $${actualTradeSize} invece di $${expectedTradeSize}`);
            console.log('   Le nuove posizioni useranno questo valore.\n');
        } else if (actualTradeSize === expectedTradeSize) {
            console.log(`✅ Dimensione Trade configurata correttamente: $${actualTradeSize}\n`);
        } else {
            console.log('⚠️  Dimensione Trade non configurata. Verifica le impostazioni.\n');
        }

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error('   Stack:', err.stack);
        process.exit(1);
    }
}

checkTradeSize();
