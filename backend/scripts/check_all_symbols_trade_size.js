#!/usr/bin/env node
/**
 * 🔍 Script per verificare trade_size_usdt per TUTTI i simboli
 * Verifica se ci sono parametri specifici per simboli che sovrascrivono i globali
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;

async function checkAllSymbolsTradeSize() {
    try {
        console.log('🔍 Verifica trade_size_usdt per TUTTI i simboli...\n');

        // 1. Recupera parametri globali
        const globalParams = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!globalParams || !globalParams.parameters) {
            console.log('❌ Parametri globali non trovati\n');
            return;
        }

        const globalParsed = typeof globalParams.parameters === 'string' 
            ? JSON.parse(globalParams.parameters) 
            : globalParams.parameters;

        const globalTradeSize = globalParsed.trade_size_usdt || globalParsed.trade_size_eur;
        const globalMaxPositions = globalParsed.max_positions;

        console.log('📊 Parametri GLOBALI:');
        console.log(`   💰 Dimensione Trade: $${globalTradeSize || 'NON CONFIGURATO'}`);
        console.log(`   📊 Max Posizioni: ${globalMaxPositions || 'NON CONFIGURATO'}\n`);

        // 2. Recupera TUTTI i simboli con parametri specifici
        const allSymbols = await dbAll(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol != 'global' ORDER BY symbol"
        );

        console.log(`📊 Simboli con parametri specifici: ${allSymbols.length}\n`);

        let symbolsWithDifferentTradeSize = [];
        let symbolsWithDifferentMaxPositions = [];

        for (const row of allSymbols) {
            if (!row.parameters) continue;

            const symbolParams = typeof row.parameters === 'string' 
                ? JSON.parse(row.parameters) 
                : row.parameters;

            const symbolTradeSize = symbolParams.trade_size_usdt || symbolParams.trade_size_eur;
            const symbolMaxPositions = symbolParams.max_positions;

            // Verifica se differisce dai globali
            if (symbolTradeSize && symbolTradeSize !== globalTradeSize) {
                symbolsWithDifferentTradeSize.push({
                    symbol: row.symbol,
                    tradeSize: symbolTradeSize,
                    globalTradeSize: globalTradeSize
                });
            }

            if (symbolMaxPositions && symbolMaxPositions !== globalMaxPositions) {
                symbolsWithDifferentMaxPositions.push({
                    symbol: row.symbol,
                    maxPositions: symbolMaxPositions,
                    globalMaxPositions: globalMaxPositions
                });
            }
        }

        // 3. Mostra risultati
        if (symbolsWithDifferentTradeSize.length > 0) {
            console.log('❌ PROBLEMA: Simboli con trade_size diverso dai globali:\n');
            for (const item of symbolsWithDifferentTradeSize) {
                console.log(`   ${item.symbol}:`);
                console.log(`      Trade Size: $${item.tradeSize} (globale: $${item.globalTradeSize})`);
            }
            console.log('');
        } else {
            console.log('✅ Tutti i simboli usano trade_size globale\n');
        }

        if (symbolsWithDifferentMaxPositions.length > 0) {
            console.log('⚠️  Simboli con max_positions diverso dai globali:\n');
            for (const item of symbolsWithDifferentMaxPositions) {
                console.log(`   ${item.symbol}:`);
                console.log(`      Max Positions: ${item.maxPositions} (globale: ${item.globalMaxPositions})`);
            }
            console.log('');
        }

        // 4. Verifica cosa viene usato quando si apre una posizione
        console.log('🔍 Verifica: Cosa viene usato quando si apre una posizione?\n');
        console.log('   Quando il bot apre una posizione, chiama:');
        console.log('   getBotParameters(symbol)');
        console.log('   Questo fa merge tra:');
        console.log('   1. Parametri globali (base)');
        console.log('   2. Parametri specifici del simbolo (sovrascrivono i globali)');
        console.log('');
        console.log('   Se un simbolo ha parametri specifici, userà quelli invece dei globali!\n');

        // 5. Test con un simbolo specifico
        if (allSymbols.length > 0) {
            const testSymbol = allSymbols[0].symbol;
            console.log(`🧪 Test: Cosa restituisce getBotParameters('${testSymbol}')?\n`);
            
            // Simula getBotParameters
            let mergedParams = { ...globalParsed };
            const symbolBot = allSymbols.find(s => s.symbol === testSymbol);
            if (symbolBot && symbolBot.parameters) {
                const symbolParams = typeof symbolBot.parameters === 'string' 
                    ? JSON.parse(symbolBot.parameters) 
                    : symbolBot.parameters;
                mergedParams = { ...mergedParams, ...symbolParams };
            }

            console.log(`   Simbolo: ${testSymbol}`);
            console.log(`   Trade Size usato: $${mergedParams.trade_size_usdt || mergedParams.trade_size_eur || 'NON CONFIGURATO'}`);
            console.log(`   Max Positions usato: ${mergedParams.max_positions || 'NON CONFIGURATO'}`);
            console.log('');
        }

        // 6. Raccomandazioni
        console.log('💡 RACCOMANDAZIONI:\n');
        if (symbolsWithDifferentTradeSize.length > 0) {
            console.log('   1. ⚠️  Alcuni simboli hanno trade_size diverso dai globali');
            console.log('      Soluzione: Aggiorna tutti i simboli con i parametri globali');
            console.log('      Oppure: Rimuovi i parametri specifici per usare solo i globali\n');
        } else {
            console.log('   1. ✅ Tutti i simboli usano i parametri globali\n');
        }
        console.log('   2. Per verificare cosa viene usato quando si apre una posizione:');
        console.log('      Controlla i log del backend quando il bot apre una posizione');
        console.log('      Cerca: "[TRADE-SIZE-STRICT]" o "[BOT-OPEN-LONG]"\n');

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

checkAllSymbolsTradeSize();
