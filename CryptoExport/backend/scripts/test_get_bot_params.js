#!/usr/bin/env node
/**
 * 🧪 Script per testare direttamente il GET endpoint /api/crypto/bot/parameters
 * Simula una chiamata HTTP GET per vedere cosa restituisce il backend
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cryptoDb = require('../crypto_db');
const dbGet = cryptoDb.dbGet;

// Copia della logica del GET endpoint per testare
const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 35,
    rsi_overbought: 70,
    stop_loss_pct: 3.0,
    take_profit_pct: 5.0,
    trade_size_usdt: 100,  // ✅ FIX CRITICO: Aggiunto
    trade_size_eur: 100,
    trailing_stop_enabled: true,
    trailing_stop_distance_pct: 1.5,
    trailing_profit_protection_enabled: false,
    partial_close_enabled: true,
    take_profit_1_pct: 2.5,
    take_profit_2_pct: 5.0,
    min_signal_strength: 70,
    min_confirmations_long: 3,
    min_confirmations_short: 4,
    market_scanner_min_strength: 30,
    max_exposure_pct: 80.0,
    max_positions: 10
};

async function testGetBotParams() {
    try {
        console.log('🧪 TEST GET /api/crypto/bot/parameters\n');
        console.log('=' .repeat(60));
        
        // Leggi dal database esattamente come fa il GET endpoint
        const globalBot = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        
        console.log('\n📥 STEP 1: Lettura dal database');
        console.log('   globalBot esiste:', !!globalBot);
        console.log('   globalBot.parameters esiste:', !!globalBot?.parameters);
        
        if (!globalBot || !globalBot.parameters) {
            console.log('\n❌ Nessun parametro globale nel database');
            console.log('   Restituirò DEFAULT_PARAMS\n');
            console.log('Parametri restituiti al frontend:');
            console.log(JSON.stringify(DEFAULT_PARAMS, null, 2));
            return;
        }
        
        // Parse JSON
        const globalParams = typeof globalBot.parameters === 'string' 
            ? JSON.parse(globalBot.parameters) 
            : globalBot.parameters;
        
        console.log('\n📥 STEP 2: Parse JSON dal database');
        console.log('   globalParams.trade_size_usdt:', globalParams.trade_size_usdt, '(type:', typeof globalParams.trade_size_usdt, ')');
        console.log('   globalParams.test_trade_size:', globalParams.test_trade_size, '(type:', typeof globalParams.test_trade_size, ')');
        console.log('   globalParams.max_positions:', globalParams.max_positions, '(type:', typeof globalParams.max_positions, ')');
        console.log('   "trade_size_usdt" in globalParams:', 'trade_size_usdt' in globalParams);
        
        // Merge con DEFAULT_PARAMS
        let params = { ...DEFAULT_PARAMS, ...globalParams };
        
        console.log('\n📥 STEP 3: Merge con DEFAULT_PARAMS');
        console.log('   DEFAULT_PARAMS.trade_size_usdt:', DEFAULT_PARAMS.trade_size_usdt);
        console.log('   globalParams.trade_size_usdt:', globalParams.trade_size_usdt);
        console.log('   params.trade_size_usdt (dopo merge):', params.trade_size_usdt, '(type:', typeof params.trade_size_usdt, ')');
        
        // Fix per trade_size_usdt perso durante merge
        if (globalParams.trade_size_usdt !== undefined && globalParams.trade_size_usdt !== null && params.trade_size_usdt === undefined) {
            console.log('\n⚠️  RILEVATO: trade_size_usdt perso durante il merge!');
            params.trade_size_usdt = globalParams.trade_size_usdt;
            console.log('   Ripristinato:', params.trade_size_usdt);
        }
        
        // Validazione finale
        console.log('\n📥 STEP 4: Validazione finale');
        const tradeSizeValue = params.trade_size_usdt || params.trade_size_eur;
        console.log('   tradeSizeValue:', tradeSizeValue, '(type:', typeof tradeSizeValue, ')');
        
        if (tradeSizeValue === null || tradeSizeValue === undefined || 
            tradeSizeValue === '' || isNaN(Number(tradeSizeValue)) || 
            Number(tradeSizeValue) < 10 || Number(tradeSizeValue) > 1000) {
            params.trade_size_usdt = DEFAULT_PARAMS.trade_size_usdt;
            console.log('   ⚠️  Valore non valido, uso default:', params.trade_size_usdt);
        } else {
            params.trade_size_usdt = Number(tradeSizeValue);
            console.log('   ✅ Valore valido:', params.trade_size_usdt);
        }
        
        const maxPosValue = params.max_positions;
        if (maxPosValue === null || maxPosValue === undefined || 
            maxPosValue === '' || isNaN(Number(maxPosValue)) || 
            Number(maxPosValue) < 1 || Number(maxPosValue) > 20) {
            params.max_positions = DEFAULT_PARAMS.max_positions;
            console.log('   ⚠️  max_positions non valido, uso default:', params.max_positions);
        } else {
            params.max_positions = Number(maxPosValue);
            console.log('   ✅ max_positions valido:', params.max_positions);
        }
        
        // Risultato finale
        console.log('\n' + '='.repeat(60));
        console.log('📤 RISPOSTA CHE VERREBBE INVIATA AL FRONTEND:\n');
        console.log(JSON.stringify({
            success: true,
            parameters: params
        }, null, 2));
        
        console.log('\n📊 VERIFICA CHIAVI CRITICHE:');
        console.log('   trade_size_usdt:', params.trade_size_usdt, '(presente:', 'trade_size_usdt' in params, ')');
        console.log('   test_trade_size:', params.test_trade_size, '(presente:', 'test_trade_size' in params, ')');
        console.log('   max_positions:', params.max_positions, '(presente:', 'max_positions' in params, ')');
        console.log('\n');

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

testGetBotParams();
