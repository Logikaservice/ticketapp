/**
 * Script per verificare e chiudere posizioni EUR corrotte
 * Queste posizioni hanno entry_price in USDT ma sono state aperte su coppie EUR
 */

const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

async function fixEURPositions() {
    console.log('🔍 [FIX EUR] Inizio verifica posizioni EUR corrotte...\n');

    try {
        // 1. Trova tutte le posizioni aperte
        const openPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );

        console.log(`📊 Trovate ${openPositions.length} posizioni aperte\n`);

        // 2. Identifica posizioni potenzialmente corrotte
        const corruptedPositions = [];
        const SYMBOL_TO_PAIR = {
            'bitcoin': 'BTCUSDT',
            'ethereum': 'ETHUSDT',
            'cardano': 'ADAUSDT',
            'polkadot': 'DOTUSDT',
            'chainlink': 'LINKUSDT',
            'ripple': 'XRPUSDT',
            'binance_coin': 'BNBUSDT'
        };

        for (const pos of openPositions) {
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentPrice = parseFloat(pos.current_price) || 0;
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;

            // Verifica se il simbolo è mappato a una coppia USDT
            const tradingPair = SYMBOL_TO_PAIR[pos.symbol];

            console.log(`\n📍 Posizione #${pos.ticket_id}:`);
            console.log(`   Symbol: ${pos.symbol} → ${tradingPair || 'N/A'}`);
            console.log(`   Type: ${pos.type.toUpperCase()}`);
            console.log(`   Entry Price: $${entryPrice.toFixed(6)}`);
            console.log(`   Current Price: $${currentPrice.toFixed(6)}`);
            console.log(`   Volume: ${remainingVolume.toFixed(8)}`);
            console.log(`   Opened: ${pos.opened_at}`);
            console.log(`   P&L: $${(parseFloat(pos.profit_loss) || 0).toFixed(2)}`);

            // Verifica se il prezzo sembra anomalo (troppo basso per crypto comuni)
            const MIN_REASONABLE_PRICES = {
                'bitcoin': 20000,    // BTC non può essere sotto $20k
                'ethereum': 1000,    // ETH non può essere sotto $1k
                'cardano': 0.20,     // ADA non può essere sotto $0.20
                'polkadot': 3,       // DOT non può essere sotto $3
                'chainlink': 5,      // LINK non può essere sotto $5
                'binance_coin': 200  // BNB non può essere sotto $200
            };

            const minPrice = MIN_REASONABLE_PRICES[pos.symbol];
            if (minPrice && entryPrice < minPrice) {
                console.log(`   ⚠️ ANOMALIA: Entry price $${entryPrice.toFixed(6)} < minimo ragionevole $${minPrice}`);
                corruptedPositions.push({
                    ...pos,
                    reason: `Entry price troppo basso ($${entryPrice.toFixed(6)} < $${minPrice})`,
                    minReasonablePrice: minPrice
                });
            }
        }

        // 3. Riepilogo posizioni corrotte
        console.log(`\n\n${'='.repeat(60)}`);
        console.log(`📊 RIEPILOGO POSIZIONI CORROTTE`);
        console.log(`${'='.repeat(60)}\n`);

        if (corruptedPositions.length === 0) {
            console.log('✅ Nessuna posizione corrotta trovata!\n');
            return;
        }

        console.log(`🚨 Trovate ${corruptedPositions.length} posizioni corrotte:\n`);

        let totalPnL = 0;
        for (const pos of corruptedPositions) {
            const pnl = parseFloat(pos.profit_loss) || 0;
            totalPnL += pnl;

            console.log(`\n📍 #${pos.ticket_id} - ${pos.symbol.toUpperCase()}`);
            console.log(`   Motivo: ${pos.reason}`);
            console.log(`   Entry: $${parseFloat(pos.entry_price).toFixed(6)}`);
            console.log(`   Current: $${parseFloat(pos.current_price).toFixed(6)}`);
            console.log(`   P&L: $${pnl.toFixed(2)}`);
            console.log(`   Opened: ${pos.opened_at}`);
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`💰 P&L Totale Posizioni Corrotte: $${totalPnL.toFixed(2)}`);
        console.log(`${'='.repeat(60)}\n`);

        // 4. Chiedi conferma per chiudere
        console.log('⚠️  AZIONE RICHIESTA:');
        console.log('   Queste posizioni hanno dati corrotti (entry price in USDT ma coppia EUR).');
        console.log('   È consigliato chiuderle per evitare calcoli P&L errati.\n');
        console.log('   Per chiuderle automaticamente, esegui:');
        console.log('   node backend/scripts/fix-eur-positions.js --close\n');

        // 5. Se flag --close, chiudi le posizioni
        if (process.argv.includes('--close')) {
            console.log('🔄 Chiusura posizioni corrotte in corso...\n');

            for (const pos of corruptedPositions) {
                try {
                    const closeReason = `Posizione corrotta: ${pos.reason}. Sistema convertito a USDT-only.`;

                    await dbRun(
                        `UPDATE open_positions 
                         SET status = 'closed', 
                             closed_at = NOW(), 
                             close_reason = ? 
                         WHERE ticket_id = ?`,
                        [closeReason, pos.ticket_id]
                    );

                    console.log(`✅ Chiusa posizione #${pos.ticket_id} - ${pos.symbol}`);
                } catch (err) {
                    console.error(`❌ Errore chiusura #${pos.ticket_id}:`, err.message);
                }
            }

            console.log(`\n✅ Chiuse ${corruptedPositions.length} posizioni corrotte`);
        }

    } catch (error) {
        console.error('❌ Errore durante fix EUR positions:', error);
        throw error;
    }
}

// Esegui lo script
fixEURPositions()
    .then(() => {
        console.log('\n✅ Script completato');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Script fallito:', err);
        process.exit(1);
    });
