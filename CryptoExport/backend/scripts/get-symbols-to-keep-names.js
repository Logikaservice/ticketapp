/**
 * 📋 Script per ottenere SOLO i nomi dei simboli da mantenere
 * 
 * Esegui con: node backend/scripts/get-symbols-to-keep-names.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { dbAll, dbGet } = require('../crypto_db');

const CONFIG = {
    MIN_PRICE: 0.01,
    MAX_SPREAD_ESTIMATE: 1.0,
    MIN_VOLUME_24H: 1000000,
    TRADE_SIZE_USDT: 100,
    TAKE_PROFIT_PCT: 4.0,
    COMMISSION_PCT: 0.1
};

async function getSymbolsToKeep() {
    try {
        const activeSymbols = await dbAll(
            `SELECT DISTINCT symbol 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
               AND is_active = 1 
               AND symbol != 'global'
             ORDER BY symbol`
        );

        const symbolsToKeep = [];

        for (const { symbol } of activeSymbols) {
            const shouldKeep = await checkSymbol(symbol);
            if (shouldKeep) {
                symbolsToKeep.push(symbol);
            }
        }

        // Output solo i nomi, uno per riga
        console.log(symbolsToKeep.join('\n'));
        
        return symbolsToKeep;
    } catch (error) {
        console.error('❌ ERRORE:', error.message);
        process.exit(1);
    }
}

async function checkSymbol(symbol) {
    try {
        // 1. Prezzo
        const priceData = await dbGet(
            `SELECT price FROM price_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`,
            [symbol]
        );
        
        if (!priceData || !priceData.price) return false;
        const price = parseFloat(priceData.price);
        if (price < CONFIG.MIN_PRICE) return false;

        // 2. Spread stimato
        let spread = 0.1;
        if (price < 1.0) {
            spread = 0.1 + (0.5 / price);
            if (spread > 5.0) spread = 5.0;
        }

        // 3. Guadagno reale
        const volume = CONFIG.TRADE_SIZE_USDT / price;
        const tpPrice = price * (1 + CONFIG.TAKE_PROFIT_PCT / 100);
        const profit = volume * (tpPrice - price);
        const commissions = CONFIG.TRADE_SIZE_USDT * (CONFIG.COMMISSION_PCT / 100) * 2;
        const spreadCost = CONFIG.TRADE_SIZE_USDT * (spread / 100);
        const realProfit = profit - commissions - spreadCost;

        if (spread > CONFIG.MAX_SPREAD_ESTIMATE && realProfit < 1.0) return false;
        if (realProfit < 1.0) return false;

        // 4. Volume 24h
        try {
            const volData = await dbGet(
                `SELECT volume_24h FROM symbol_volumes_24h WHERE symbol = $1 ORDER BY updated_at DESC LIMIT 1`,
                [symbol]
            );
            if (volData && volData.volume_24h && parseFloat(volData.volume_24h) < CONFIG.MIN_VOLUME_24H) {
                return false;
            }
        } catch (err) {
            // Ignora errori volume
        }

        return true;
    } catch (error) {
        return false;
    }
}

getSymbolsToKeep()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
