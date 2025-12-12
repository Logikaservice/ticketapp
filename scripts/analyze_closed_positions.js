/**
 * Script per analizzare le posizioni chiuse e capire PERCHÉ sono state chiuse
 * Mostra: motivo, durata, P&L, entry/close price, ecc.
 */

const db = require('./backend/crypto_db');

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

async function analyzeClosedPositions() {
    try {
        console.log('🔍 Analizzando posizioni chiuse recentemente...\n');

        // Prima verifica se ci sono posizioni (aperte o chiuse)
        const allPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        console.log(`📊 Totale posizioni nel database: ${allPositions[0]?.count || 0}`);

        const openPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        console.log(`📊 Posizioni aperte: ${openPositions[0]?.count || 0}`);

        // Recupera le ultime 50 posizioni chiuse
        // Nota: close_reason potrebbe non esistere, quindi usiamo COALESCE
        const closedPositions = await dbAll(
            `SELECT 
                ticket_id,
                symbol,
                type,
                volume,
                entry_price,
                current_price,
                opened_at,
                closed_at,
                profit_loss,
                profit_loss_pct,
                COALESCE(close_reason, 'N/A') as close_reason,
                status,
                strategy
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken')
            ORDER BY COALESCE(closed_at, opened_at) DESC 
            LIMIT 50`
        );

        if (closedPositions.length === 0) {
            console.log('❌ Nessuna posizione chiusa trovata.');
            return;
        }

        console.log(`📊 Trovate ${closedPositions.length} posizioni chiuse\n`);
        console.log('='.repeat(100));

        // Analizza ogni posizione
        for (const pos of closedPositions) {
            const openedAt = new Date(pos.opened_at);
            const closedAt = new Date(pos.closed_at);
            const durationMs = closedAt.getTime() - openedAt.getTime();
            const durationSeconds = Math.floor(durationMs / 1000);
            const durationMinutes = Math.floor(durationMs / 60000);
            const durationHours = Math.floor(durationMs / 3600000);

            const entryPrice = parseFloat(pos.entry_price) || 0;
            const closePrice = parseFloat(pos.current_price) || entryPrice;
            const pnl = parseFloat(pos.profit_loss) || 0;
            const pnlPct = parseFloat(pos.profit_loss_pct) || 0;
            const volume = parseFloat(pos.volume) || 0;

            // Formatta durata
            let durationStr = '';
            if (durationSeconds < 60) {
                durationStr = `${durationSeconds} secondi`;
            } else if (durationMinutes < 60) {
                durationStr = `${durationMinutes} minuti`;
            } else {
                durationStr = `${durationHours} ore e ${durationMinutes % 60} minuti`;
            }

            // Determina il motivo principale
            const closeReason = pos.close_reason || 'N/A';
            let mainReason = 'Sconosciuto';
            let isSmartExit = false;
            let isImmediate = durationSeconds < 5;

            if (closeReason.includes('SmartExit') || closeReason.includes('smart exit')) {
                mainReason = 'SmartExit';
                isSmartExit = true;
            } else if (closeReason.includes('cleanup')) {
                mainReason = 'Cleanup (troppe posizioni)';
            } else if (closeReason.includes('replacement') || closeReason.includes('smart replacement')) {
                mainReason = 'Smart Replacement';
            } else if (closeReason.includes('manual')) {
                mainReason = 'Chiusura Manuale';
            } else if (closeReason.includes('stop') || closeReason.includes('Stop Loss')) {
                mainReason = 'Stop Loss';
            } else if (closeReason.includes('take') || closeReason.includes('Take Profit')) {
                mainReason = 'Take Profit';
            } else if (closeReason) {
                mainReason = closeReason.substring(0, 50); // Primi 50 caratteri
            }

            // Calcola differenza prezzo
            const priceDiff = closePrice - entryPrice;
            const priceDiffPct = entryPrice > 0 ? ((priceDiff / entryPrice) * 100) : 0;

            // Stampa dettagli
            console.log(`\n📌 Posizione: ${pos.ticket_id}`);
            console.log(`   Simbolo: ${pos.symbol} | Tipo: ${pos.type.toUpperCase()}`);
            console.log(`   Volume: ${volume.toFixed(8)}`);
            console.log(`   Entry Price: €${entryPrice.toFixed(6)}`);
            console.log(`   Close Price: €${closePrice.toFixed(6)} (${priceDiffPct >= 0 ? '+' : ''}${priceDiffPct.toFixed(2)}%)`);
            console.log(`   P&L: ${pnl >= 0 ? '+' : ''}€${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
            console.log(`   Durata: ${durationStr} (${durationMs}ms)`);
            console.log(`   Aperta: ${openedAt.toLocaleString('it-IT')}`);
            console.log(`   Chiusa: ${closedAt.toLocaleString('it-IT')}`);
            console.log(`   Status: ${pos.status}`);
            console.log(`   Strategia: ${pos.strategy || 'N/A'}`);
            console.log(`   Motivo: ${mainReason}`);
            if (closeReason && closeReason.length > 50) {
                console.log(`   Dettagli: ${closeReason}`);
            }

            // Avvisi speciali
            if (isImmediate) {
                console.log(`   ⚠️  ATTENZIONE: Chiusura IMMEDIATA (< 5 secondi)!`);
            }
            if (pnl < -10) {
                console.log(`   🚨 PERDITA ELEVATA: €${Math.abs(pnl).toFixed(2)}`);
            }
            if (isSmartExit && isImmediate) {
                console.log(`   ⚠️  SmartExit ha chiuso IMMEDIATAMENTE dopo apertura!`);
            }
            if (Math.abs(priceDiffPct) > 20) {
                console.log(`   ⚠️  Differenza prezzo ANOMALA: ${priceDiffPct.toFixed(2)}%`);
            }

            console.log('-'.repeat(100));
        }

        // Statistiche aggregate
        console.log('\n\n📊 STATISTICHE AGGREGATE:\n');
        
        const immediateCloses = closedPositions.filter(p => {
            const duration = new Date(p.closed_at).getTime() - new Date(p.opened_at).getTime();
            return duration < 5000; // < 5 secondi
        });

        const smartExitCloses = closedPositions.filter(p => {
            const reason = (p.close_reason || '').toLowerCase();
            return reason.includes('smarte') || reason.includes('smart exit');
        });

        const losses = closedPositions.filter(p => (parseFloat(p.profit_loss) || 0) < 0);
        const bigLosses = closedPositions.filter(p => (parseFloat(p.profit_loss) || 0) < -10);

        const avgDuration = closedPositions.reduce((sum, p) => {
            const duration = new Date(p.closed_at).getTime() - new Date(p.opened_at).getTime();
            return sum + duration;
        }, 0) / closedPositions.length;

        const totalPnL = closedPositions.reduce((sum, p) => sum + (parseFloat(p.profit_loss) || 0), 0);

        console.log(`   Totale posizioni analizzate: ${closedPositions.length}`);
        console.log(`   Chiusure immediate (< 5s): ${immediateCloses.length} (${((immediateCloses.length / closedPositions.length) * 100).toFixed(1)}%)`);
        console.log(`   Chiusure da SmartExit: ${smartExitCloses.length} (${((smartExitCloses.length / closedPositions.length) * 100).toFixed(1)}%)`);
        console.log(`   Posizioni in perdita: ${losses.length} (${((losses.length / closedPositions.length) * 100).toFixed(1)}%)`);
        console.log(`   Perdite elevate (>€10): ${bigLosses.length}`);
        console.log(`   Durata media: ${Math.floor(avgDuration / 1000)} secondi (${(avgDuration / 60000).toFixed(1)} minuti)`);
        console.log(`   P&L totale: ${totalPnL >= 0 ? '+' : ''}€${totalPnL.toFixed(2)}`);

        // Analisi chiusure immediate
        if (immediateCloses.length > 0) {
            console.log('\n\n🚨 ANALISI CHIUSURE IMMEDIATE (< 5 secondi):\n');
            for (const pos of immediateCloses.slice(0, 10)) {
                const duration = new Date(pos.closed_at).getTime() - new Date(pos.opened_at).getTime();
                const seconds = (duration / 1000).toFixed(2);
                console.log(`   ${pos.ticket_id} | ${pos.symbol} | ${seconds}s | P&L: €${(parseFloat(pos.profit_loss) || 0).toFixed(2)} | Motivo: ${pos.close_reason || 'N/A'}`);
            }
        }

        // Analisi perdite elevate
        if (bigLosses.length > 0) {
            console.log('\n\n💰 ANALISI PERDITE ELEVATE (>€10):\n');
            for (const pos of bigLosses.slice(0, 10)) {
                const duration = new Date(pos.closed_at).getTime() - new Date(pos.opened_at).getTime();
                const seconds = Math.floor(duration / 1000);
                console.log(`   ${pos.ticket_id} | ${pos.symbol} | ${seconds}s | P&L: €${(parseFloat(pos.profit_loss) || 0).toFixed(2)} | Motivo: ${pos.close_reason || 'N/A'}`);
            }
        }

    } catch (error) {
        console.error('❌ Errore nell\'analisi:', error);
    } finally {
        db.close();
    }
}

// Esegui analisi
analyzeClosedPositions();

