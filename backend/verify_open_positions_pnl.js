/**
 * Script per verificare i prezzi e P&L delle posizioni aperte
 */

const { dbAll } = require('./crypto_db');

async function verifyOpenPositions() {
    try {
        console.log('🔍 VERIFICA PREZZI E P&L POSIZIONI APERTE\n');

        // Recupera tutte le posizioni aperte
        const openPositions = await dbAll(`
            SELECT 
                ticket_id,
                symbol,
                type,
                volume,
                volume_closed,
                entry_price,
                current_price,
                profit_loss,
                profit_loss_pct,
                opened_at
            FROM open_positions 
            WHERE status = 'open'
            ORDER BY symbol, opened_at
        `);

        console.log(`Trovate ${openPositions.length} posizioni aperte\n`);

        let anomalies = 0;

        for (const pos of openPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentPrice = parseFloat(pos.current_price) || 0;
            const dbPnL = parseFloat(pos.profit_loss) || 0;
            const dbPnLPct = parseFloat(pos.profit_loss_pct) || 0;

            // Calcola P&L corretto
            let calculatedPnL = 0;
            let calculatedPnLPct = 0;

            if (pos.type === 'buy') {
                calculatedPnL = (currentPrice - entryPrice) * remainingVolume;
                calculatedPnLPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
            } else {
                calculatedPnL = (entryPrice - currentPrice) * remainingVolume;
                calculatedPnLPct = entryPrice > 0 ? ((entryPrice - currentPrice) / entryPrice) * 100 : 0;
            }

            // Verifica discrepanze
            const pnlDiff = Math.abs(calculatedPnL - dbPnL);
            const isAnomaly = pnlDiff > 0.01; // Differenza > $0.01

            if (isAnomaly) {
                anomalies++;
                console.log(`❌ ANOMALIA RILEVATA: ${pos.symbol} (${pos.type.toUpperCase()})`);
                console.log(`   Ticket ID: ${pos.ticket_id.substring(0, 20)}...`);
                console.log(`   Entry Price:     $${entryPrice.toFixed(8)}`);
                console.log(`   Current Price:   $${currentPrice.toFixed(8)}`);
                console.log(`   Volume:          ${volume.toFixed(8)}`);
                console.log(`   Volume Closed:   ${volumeClosed.toFixed(8)}`);
                console.log(`   Remaining Vol:   ${remainingVolume.toFixed(8)}`);
                console.log(`   P&L Database:    $${dbPnL.toFixed(8)} (${dbPnLPct.toFixed(2)}%)`);
                console.log(`   P&L Calcolato:   $${calculatedPnL.toFixed(8)} (${calculatedPnLPct.toFixed(2)}%)`);
                console.log(`   Differenza:      $${pnlDiff.toFixed(8)}`);
                console.log('');
            } else {
                console.log(`✅ ${pos.symbol} (${pos.type.toUpperCase()}) - P&L corretto: $${dbPnL.toFixed(4)}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`📊 RIEPILOGO:`);
        console.log(`   Posizioni totali:  ${openPositions.length}`);
        console.log(`   Anomalie trovate:  ${anomalies}`);
        console.log(`   Corrette:          ${openPositions.length - anomalies}`);
        console.log('='.repeat(60));

        if (anomalies > 0) {
            console.log('\n⚠️  RACCOMANDAZIONE: Esegui endpoint /api/crypto/fix-closed-positions-pnl per correggere');
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

verifyOpenPositions();
