/**
 * 📋 Script per elencare i simboli da MANTENERE
 * 
 * Mostra quali simboli sono OK per il trading con $100 per posizione
 * Esegui con: node backend/scripts/list-symbols-to-keep.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { dbAll, dbGet } = require('../crypto_db');

// Stessa configurazione dello script di analisi
const CONFIG = {
    TRADE_SIZE_USDT: 100,
    TAKE_PROFIT_PCT: 4.0,
    COMMISSION_PCT: 0.1,
    MIN_PRICE: 0.01,
    MAX_SPREAD_ESTIMATE: 1.0,
    MIN_VOLUME_24H: 1000000,
    SPREAD_MULTIPLIER: 0.5
};

async function listSymbolsToKeep() {
    console.log('\n' + '='.repeat(80));
    console.log('✅ SIMBOLI DA MANTENERE (OK per trading con $100/posizione)');
    console.log('='.repeat(80) + '\n');

    try {
        // 1. Ottieni tutti i simboli attivi
        const activeSymbols = await dbAll(
            `SELECT DISTINCT symbol 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
               AND is_active = 1 
               AND symbol != 'global'
             ORDER BY symbol`
        );

        console.log(`📊 Simboli attivi totali: ${activeSymbols.length}\n`);

        const symbolsToKeep = [];
        const symbolsToRemove = [];

        // 2. Analizza ogni simbolo
        for (const { symbol } of activeSymbols) {
            const analysis = await analyzeSymbol(symbol);
            
            if (analysis.shouldKeep) {
                symbolsToKeep.push(analysis);
            } else {
                symbolsToRemove.push(analysis);
            }
        }

        // 3. Ordina per guadagno reale (migliori prima)
        symbolsToKeep.sort((a, b) => (b.realProfit || 0) - (a.realProfit || 0));

        // 4. Mostra simboli da mantenere
        console.log(`✅ SIMBOLI DA MANTENERE: ${symbolsToKeep.length}`);
        console.log('─'.repeat(80));
        
        symbolsToKeep.forEach((symbol, idx) => {
            console.log(`\n${idx + 1}. ${symbol.symbol}`);
            if (symbol.currentPrice !== null) {
                console.log(`   Prezzo: $${symbol.currentPrice.toFixed(6)}`);
                if (symbol.estimatedSpread) {
                    console.log(`   Spread stimato: ${symbol.estimatedSpread.toFixed(2)}%`);
                }
                if (symbol.realProfit !== null) {
                    console.log(`   Guadagno reale: $${symbol.realProfit.toFixed(4)}`);
                }
                if (symbol.volume24h) {
                    console.log(`   Volume 24h: $${(symbol.volume24h / 1000000).toFixed(2)}M`);
                }
            }
        });

        console.log('\n' + '─'.repeat(80));
        console.log(`\n📝 LISTA COMPLETA (per copia/incolla):`);
        console.log('─'.repeat(80));
        console.log(symbolsToKeep.map(s => s.symbol).join(', '));
        console.log('');

        // 5. Statistiche
        console.log('📊 STATISTICHE SIMBOLI DA MANTENERE:');
        console.log('─'.repeat(80));
        const profitable = symbolsToKeep.filter(s => s.realProfit && s.realProfit > 0);
        const avgProfit = profitable.reduce((sum, s) => sum + (s.realProfit || 0), 0) / profitable.length;
        const minProfit = Math.min(...profitable.map(s => s.realProfit || 0));
        const maxProfit = Math.max(...profitable.map(s => s.realProfit || 0));
        
        console.log(`   Totale: ${symbolsToKeep.length} simboli`);
        console.log(`   Con guadagno positivo: ${profitable.length}`);
        console.log(`   Guadagno reale medio: $${avgProfit.toFixed(4)}`);
        console.log(`   Guadagno reale minimo: $${minProfit.toFixed(4)}`);
        console.log(`   Guadagno reale massimo: $${maxProfit.toFixed(4)}`);
        console.log('');

        // 6. Top 10 migliori
        const top10 = symbolsToKeep.slice(0, 10);
        console.log('🏆 TOP 10 SIMBOLI (per guadagno reale):');
        console.log('─'.repeat(80));
        top10.forEach((symbol, idx) => {
            console.log(`   ${idx + 1}. ${symbol.symbol}: $${symbol.realProfit?.toFixed(4) || 'N/A'} (prezzo: $${symbol.currentPrice?.toFixed(6) || 'N/A'})`);
        });
        console.log('');

        console.log('='.repeat(80));
        console.log(`✅ Totale: ${symbolsToKeep.length} simboli da mantenere su ${activeSymbols.length} totali`);
        console.log('='.repeat(80) + '\n');

        return symbolsToKeep.map(s => s.symbol);
    } catch (error) {
        console.error('❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function analyzeSymbol(symbol) {
    const analysis = {
        symbol,
        currentPrice: null,
        estimatedSpread: null,
        realProfit: null,
        volume24h: null,
        shouldKeep: true
    };

    try {
        // 1. Recupera prezzo
        const priceData = await dbGet(
            `SELECT price 
             FROM price_history 
             WHERE symbol = $1 
             ORDER BY timestamp DESC LIMIT 1`,
            [symbol]
        );
        
        if (!priceData || !priceData.price) {
            analysis.shouldKeep = false;
            return analysis;
        }

        analysis.currentPrice = parseFloat(priceData.price);
        
        // 2. Verifica prezzo minimo
        if (analysis.currentPrice < CONFIG.MIN_PRICE) {
            analysis.shouldKeep = false;
            return analysis;
        }

        // 3. Calcola spread stimato
        let estimatedSpread = 0.1;
        if (analysis.currentPrice < 1.0) {
            estimatedSpread = 0.1 + (0.5 / analysis.currentPrice);
            if (estimatedSpread > 5.0) estimatedSpread = 5.0;
        }
        analysis.estimatedSpread = estimatedSpread;

        // 4. Calcola guadagno reale
        const volume = CONFIG.TRADE_SIZE_USDT / analysis.currentPrice;
        const takeProfitPrice = analysis.currentPrice * (1 + CONFIG.TAKE_PROFIT_PCT / 100);
        const absoluteProfit = volume * (takeProfitPrice - analysis.currentPrice);
        const entryCommission = CONFIG.TRADE_SIZE_USDT * (CONFIG.COMMISSION_PCT / 100);
        const exitValue = volume * takeProfitPrice;
        const exitCommission = exitValue * (CONFIG.COMMISSION_PCT / 100);
        const commissions = entryCommission + exitCommission;
        const spreadCost = CONFIG.TRADE_SIZE_USDT * (estimatedSpread / 100);
        analysis.realProfit = absoluteProfit - commissions - spreadCost;

        // 5. Verifica spread
        if (estimatedSpread > CONFIG.MAX_SPREAD_ESTIMATE && analysis.realProfit < 1.0) {
            analysis.shouldKeep = false;
            return analysis;
        }

        // 6. Verifica guadagno reale
        if (analysis.realProfit < 1.0) {
            analysis.shouldKeep = false;
            return analysis;
        }

        // 7. Verifica volume 24h
        try {
            const volumeData = await dbGet(
                `SELECT volume_24h 
                 FROM symbol_volumes_24h 
                 WHERE symbol = $1 
                 ORDER BY updated_at DESC LIMIT 1`,
                [symbol]
            );
            
            if (volumeData && volumeData.volume_24h) {
                analysis.volume24h = parseFloat(volumeData.volume_24h);
                if (analysis.volume24h < CONFIG.MIN_VOLUME_24H) {
                    analysis.shouldKeep = false;
                    return analysis;
                }
            }
        } catch (err) {
            // Ignora errori volume (non critico se altri criteri OK)
        }

    } catch (error) {
        analysis.shouldKeep = false;
    }

    return analysis;
}

// Esegui
listSymbolsToKeep()
    .then((symbols) => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    });
