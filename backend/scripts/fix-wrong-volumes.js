#!/usr/bin/env node

/**
 * 🔧 FIX WRONG VOLUMES IN OPEN POSITIONS
 * 
 * Problema: Alcune posizioni hanno volume sbagliato perché il bot ha usato un prezzo errato.
 * 
 * Questo script:
 * 1. Trova posizioni con volume che non corrisponde a trade_size_usdt / entry_price
 * 2. Calcola il volume corretto
 * 3. Aggiorna il database
 * 4. Ricalcola il P&L corretto
 */

const db = require('../crypto_db');

async function fixWrongVolumes() {
    console.log('🔍 Analisi posizioni aperte per volumi sbagliati...\n');
    
    try {
        // 1. Leggi tutte le posizioni aperte
        const positions = await db.dbAll(
            `SELECT ticket_id, symbol, type, volume, entry_price, current_price, 
                    trade_size_usdt, profit_loss, profit_loss_pct, opened_at
             FROM open_positions 
             WHERE status = 'open'
             ORDER BY opened_at DESC`
        );
        
        if (positions.length === 0) {
            console.log('✅ Nessuna posizione aperta trovata.');
            return;
        }
        
        console.log(`📊 Trovate ${positions.length} posizioni aperte\n`);
        console.log('='.repeat(100));
        
        let fixed = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const pos of positions) {
            const tradeSize = parseFloat(pos.trade_size_usdt) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentVolume = parseFloat(pos.volume) || 0;
            const currentPrice = parseFloat(pos.current_price) || entryPrice;
            
            // Verifica che abbiamo i dati necessari
            if (tradeSize === 0 || entryPrice === 0) {
                console.log(`⚠️  ${pos.symbol.padEnd(15)} | Skipped: trade_size_usdt=${tradeSize}, entry_price=${entryPrice}`);
                skipped++;
                continue;
            }
            
            // Calcola volume CORRETTO: trade_size_usdt / entry_price
            const correctVolume = tradeSize / entryPrice;
            
            // Calcola la differenza percentuale
            const volumeDiffPct = ((currentVolume - correctVolume) / correctVolume) * 100;
            
            // Se la differenza è > 5%, c'è un problema
            if (Math.abs(volumeDiffPct) > 5) {
                console.log(`\n🐛 ${pos.symbol.toUpperCase()} (${pos.type.toUpperCase()}) - Ticket: ${pos.ticket_id}`);
                console.log(`   Entry Price:        $${entryPrice.toFixed(8)}`);
                console.log(`   Trade Size:         $${tradeSize.toFixed(2)}`);
                console.log(`   Volume SBAGLIATO:   ${currentVolume.toLocaleString(undefined, {maximumFractionDigits: 8})} (DATABASE)`);
                console.log(`   Volume CORRETTO:    ${correctVolume.toLocaleString(undefined, {maximumFractionDigits: 8})} (CALCOLATO)`);
                console.log(`   Differenza:         ${volumeDiffPct.toFixed(2)}% 🚨`);
                
                // Calcola P&L CORRETTO con il volume giusto
                let correctPnL = 0;
                let correctPnLPct = 0;
                
                if (pos.type === 'buy') {
                    // LONG: profit quando prezzo sale
                    correctPnL = (currentPrice - entryPrice) * correctVolume;
                    correctPnLPct = ((currentPrice - entryPrice) / entryPrice) * 100;
                } else {
                    // SHORT: profit quando prezzo scende
                    correctPnL = (entryPrice - currentPrice) * correctVolume;
                    correctPnLPct = ((entryPrice - currentPrice) / entryPrice) * 100;
                }
                
                const oldPnL = parseFloat(pos.profit_loss) || 0;
                
                console.log(`   P&L VECCHIO:        $${oldPnL.toFixed(2)} (${(parseFloat(pos.profit_loss_pct) || 0).toFixed(2)}%)`);
                console.log(`   P&L CORRETTO:       $${correctPnL.toFixed(2)} (${correctPnLPct.toFixed(2)}%)`);
                
                try {
                    // Aggiorna nel database
                    await db.dbRun(
                        `UPDATE open_positions 
                         SET volume = $1, 
                             profit_loss = $2, 
                             profit_loss_pct = $3,
                             current_price = $4
                         WHERE ticket_id = $5`,
                        [correctVolume, correctPnL, correctPnLPct, currentPrice, pos.ticket_id]
                    );
                    
                    console.log(`   ✅ CORRETTO nel database!`);
                    fixed++;
                    
                } catch (updateError) {
                    console.log(`   ❌ ERRORE update: ${updateError.message}`);
                    errors++;
                }
                
            } else {
                // Volume OK, solo log in modalità verbose
                if (process.argv.includes('--verbose')) {
                    console.log(`✅ ${pos.symbol.padEnd(15)} | Volume OK (diff: ${volumeDiffPct.toFixed(2)}%)`);
                }
                skipped++;
            }
        }
        
        // Riepilogo
        console.log('\n' + '='.repeat(100));
        console.log('\n📊 RIEPILOGO:');
        console.log(`   ✅ Corrette:  ${fixed} posizioni`);
        console.log(`   ⏭️  Skipped:   ${skipped} posizioni (volume corretto o dati mancanti)`);
        console.log(`   ❌ Errori:    ${errors} posizioni`);
        
        if (fixed > 0) {
            console.log('\n🎉 Volumi corretti con successo!');
            console.log('   Ricarica il frontend per vedere i P&L aggiornati.');
        } else {
            console.log('\n✅ Tutti i volumi sono già corretti!');
        }
        
    } catch (error) {
        console.error('\n❌ Errore durante l\'analisi:', error.message);
        process.exit(1);
    }
}

// Esegui lo script
if (require.main === module) {
    console.log('🔧 FIX WRONG VOLUMES - Script di correzione volumi errati\n');
    
    fixWrongVolumes()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Errore fatale:', error);
            process.exit(1);
        });
}

module.exports = { fixWrongVolumes };
