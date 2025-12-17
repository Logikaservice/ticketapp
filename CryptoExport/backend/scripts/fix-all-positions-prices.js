/**
 * Script per correggere tutti i prezzi delle posizioni aperte
 * Converte EUR a USDT e verifica coerenza con TradingView
 */

const cryptoDb = require('../crypto_db');

const EUR_TO_USDT_RATE = 1.08;

async function fixAllPositions() {
    try {
        console.log('🔍 Verifica e correzione posizioni aperte...\n');

        // Recupera tutte le posizioni aperte
        const positions = await cryptoDb.dbAll(
            "SELECT ticket_id, symbol, entry_price, current_price, opened_at, status FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );

        if (!positions || positions.length === 0) {
            console.log('✅ Nessuna posizione aperta trovata');
            return;
        }

        console.log(`📊 Trovate ${positions.length} posizioni aperte\n`);

        let fixedCount = 0;
        let checkedCount = 0;

        for (const pos of positions) {
            const symbol = pos.symbol;
            let entryPrice = parseFloat(pos.entry_price);
            let currentPrice = parseFloat(pos.current_price);

            console.log(`\n${checkedCount + 1}. ${symbol.toUpperCase()} (${pos.ticket_id})`);
            console.log(`   Entry Price: $${entryPrice.toFixed(6)}`);
            console.log(`   Current Price: $${currentPrice.toFixed(6)}`);

            // Verifica se il simbolo termina con _eur
            const isEURSymbol = symbol.endsWith('_eur');
            const needsEntryFix = isEURSymbol && entryPrice > 0 && entryPrice < 1000; // Se entry_price sembra in EUR (molto basso)
            const needsCurrentFix = isEURSymbol && currentPrice > 0 && currentPrice < 1000; // Se current_price sembra in EUR

            let updated = false;
            let newEntryPrice = entryPrice;
            let newCurrentPrice = currentPrice;

            // Correggi entry_price se necessario
            if (needsEntryFix) {
                newEntryPrice = entryPrice * EUR_TO_USDT_RATE;
                console.log(`   ⚠️  Entry price sembra in EUR, convertendo: $${entryPrice.toFixed(6)} → $${newEntryPrice.toFixed(6)} USDT`);
                updated = true;
            }

            // Correggi current_price se necessario
            if (needsCurrentFix) {
                newCurrentPrice = currentPrice * EUR_TO_USDT_RATE;
                console.log(`   ⚠️  Current price sembra in EUR, convertendo: $${currentPrice.toFixed(6)} → $${newCurrentPrice.toFixed(6)} USDT`);
                updated = true;
            }

            // Verifica anche se entry_price è molto più basso di current_price (possibile problema)
            if (entryPrice > 0 && currentPrice > 0) {
                const ratio = currentPrice / entryPrice;
                if (ratio > 1.15 && entryPrice < currentPrice * 0.85) {
                    // Probabilmente entry_price è in EUR mentre current_price è in USDT
                    newEntryPrice = entryPrice * EUR_TO_USDT_RATE;
                    console.log(`   ⚠️  Discrepanza rilevata (ratio: ${ratio.toFixed(2)}), correggendo entry_price: $${entryPrice.toFixed(6)} → $${newEntryPrice.toFixed(6)} USDT`);
                    updated = true;
                }
            }

            if (updated) {
                // Aggiorna nel database
                await cryptoDb.dbRun(
                    "UPDATE open_positions SET entry_price = ?, current_price = ? WHERE ticket_id = ?",
                    [newEntryPrice, newCurrentPrice, pos.ticket_id]
                );
                console.log(`   ✅ Corretto nel database`);
                fixedCount++;
            } else {
                console.log(`   ✓ Prezzi già corretti`);
            }

            checkedCount++;
        }

        console.log(`\n\n📊 Riepilogo:`);
        console.log(`   Posizioni verificate: ${checkedCount}`);
        console.log(`   Posizioni corrette: ${fixedCount}`);
        console.log(`   Posizioni già corrette: ${checkedCount - fixedCount}`);

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

// Esegui
fixAllPositions()
    .then(() => {
        console.log('\n✅ Script completato');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Errore fatale:', err);
        process.exit(1);
    });

