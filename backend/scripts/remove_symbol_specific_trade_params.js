#!/usr/bin/env node
/**
 * 🧹 Script per rimuovere trade_size_usdt, trade_size_eur e max_positions
 * dai parametri specifici di tutti i simboli, lasciando solo i parametri globali
 * 
 * Questo script:
 * 1. Legge tutti i simboli (escluso 'global')
 * 2. Per ogni simbolo, rimuove trade_size_usdt, trade_size_eur, max_positions dai parametri
 * 3. Aggiorna il database con i parametri puliti
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

async function removeSymbolSpecificTradeParams() {
    try {
        console.log('🧹 Rimozione parametri specifici trade_size e max_positions da tutti i simboli...\n');

        // 1. Verifica parametri globali
        const globalParams = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!globalParams || !globalParams.parameters) {
            console.log('❌ Parametri globali non trovati. Impossibile procedere.\n');
            return;
        }

        const globalParsed = typeof globalParams.parameters === 'string' 
            ? JSON.parse(globalParams.parameters) 
            : globalParams.parameters;

        const globalTradeSize = globalParsed.trade_size_usdt || globalParsed.trade_size_eur;
        const globalMaxPositions = globalParsed.max_positions;

        console.log('📊 Parametri GLOBALI (questi verranno usati per tutti i simboli):');
        console.log(`   💰 Dimensione Trade: $${globalTradeSize || 'NON CONFIGURATO'}`);
        console.log(`   📊 Max Posizioni: ${globalMaxPositions || 'NON CONFIGURATO'}\n`);

        // 2. Recupera TUTTI i simboli con parametri specifici
        const allSymbols = await dbAll(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol != 'global' ORDER BY symbol"
        );

        console.log(`📊 Simboli trovati: ${allSymbols.length}\n`);

        if (allSymbols.length === 0) {
            console.log('✅ Nessun simbolo con parametri specifici da pulire.\n');
            return;
        }

        let updated = 0;
        let skipped = 0;
        let removedParams = [];

        // 3. Per ogni simbolo, rimuovi trade_size_usdt, trade_size_eur, max_positions
        for (const row of allSymbols) {
            try {
                if (!row.parameters) {
                    // Nessun parametro specifico, salta
                    skipped++;
                    continue;
                }

                const symbolParams = typeof row.parameters === 'string' 
                    ? JSON.parse(row.parameters) 
                    : row.parameters;

                // Verifica se ha i parametri da rimuovere
                const hasTradeSize = symbolParams.trade_size_usdt || symbolParams.trade_size_eur;
                const hasMaxPositions = symbolParams.max_positions;

                if (!hasTradeSize && !hasMaxPositions) {
                    // Non ha parametri da rimuovere, salta
                    skipped++;
                    continue;
                }

                // Crea una copia dei parametri senza trade_size_usdt, trade_size_eur, max_positions
                const { trade_size_usdt, trade_size_eur, max_positions, ...cleanedParams } = symbolParams;

                // Aggiorna il database
                const parametersJson = JSON.stringify(cleanedParams);
                const result = await dbRun(
                    "UPDATE bot_settings SET parameters = $1::text WHERE strategy_name = 'RSI_Strategy' AND symbol = $2",
                    [parametersJson, row.symbol]
                );

                const rowsAffected = result.rowCount || 0;
                if (rowsAffected > 0) {
                    updated++;
                    const removed = [];
                    if (trade_size_usdt) removed.push(`trade_size_usdt=$${trade_size_usdt}`);
                    if (trade_size_eur) removed.push(`trade_size_eur=$${trade_size_eur}`);
                    if (max_positions) removed.push(`max_positions=${max_positions}`);
                    
                    removedParams.push({
                        symbol: row.symbol,
                        removed: removed.join(', ')
                    });

                    console.log(`✅ ${row.symbol}: Rimossi ${removed.join(', ')}`);
                } else {
                    skipped++;
                    console.log(`⚠️  ${row.symbol}: Nessuna riga aggiornata (possibile errore)`);
                }
            } catch (err) {
                console.error(`❌ Errore processando ${row.symbol}:`, err.message);
                skipped++;
            }
        }

        // 4. Riepilogo
        console.log('\n📊 RIEPILOGO:\n');
        console.log(`   ✅ Simboli aggiornati: ${updated}`);
        console.log(`   ⏭️  Simboli saltati: ${skipped}`);
        console.log(`   📊 Totale simboli: ${allSymbols.length}\n`);

        if (removedParams.length > 0) {
            console.log('📋 Parametri rimossi per simbolo:\n');
            for (const item of removedParams) {
                console.log(`   ${item.symbol}: ${item.removed}`);
            }
            console.log('');
        }

        // 5. Verifica finale
        console.log('🔍 Verifica finale: Simboli con parametri specifici rimanenti...\n');
        const remainingSymbols = await dbAll(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol != 'global' ORDER BY symbol"
        );

        let stillHasTradeParams = [];
        for (const row of remainingSymbols) {
            if (!row.parameters) continue;
            const symbolParams = typeof row.parameters === 'string' 
                ? JSON.parse(row.parameters) 
                : row.parameters;
            
            if (symbolParams.trade_size_usdt || symbolParams.trade_size_eur || symbolParams.max_positions) {
                stillHasTradeParams.push(row.symbol);
            }
        }

        if (stillHasTradeParams.length > 0) {
            console.log('⚠️  ATTENZIONE: Alcuni simboli hanno ancora parametri trade_size/max_positions:');
            for (const symbol of stillHasTradeParams) {
                console.log(`   - ${symbol}`);
            }
            console.log('');
        } else {
            console.log('✅ Tutti i simboli ora usano solo i parametri globali per trade_size e max_positions!\n');
        }

        console.log('✅ Pulizia completata!\n');
        console.log('💡 Ora tutti i simboli useranno i parametri globali:');
        console.log(`   - trade_size_usdt: $${globalTradeSize || 'NON CONFIGURATO'}`);
        console.log(`   - max_positions: ${globalMaxPositions || 'NON CONFIGURATO'}\n`);

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        // Chiudi connessione database
        await cryptoDb.close();
    }
}

removeSymbolSpecificTradeParams();
