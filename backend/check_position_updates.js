/**
 * Script per verificare se i valori delle posizioni vengono aggiornati in tempo reale
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;

async function checkPositionUpdates() {
    try {
        console.log('🔍 Monitoraggio aggiornamenti posizioni in tempo reale...\n');
        
        let previousValues = {};
        let iteration = 0;
        const maxIterations = 10; // Monitora per 10 iterazioni (5 secondi)
        
        const interval = setInterval(async () => {
            iteration++;
            console.log(`\n--- Iterazione ${iteration} (${new Date().toLocaleTimeString()}) ---`);
            
            try {
                // Recupera tutte le posizioni aperte
                const positions = await dbAll("SELECT ticket_id, symbol, entry_price, current_price, profit_loss, profit_loss_pct, updated_at FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");
                
                if (positions.length === 0) {
                    console.log('⚠️  Nessuna posizione aperta trovata');
                    return;
                }
                
                positions.forEach(pos => {
                    const ticketId = pos.ticket_id;
                    const currentPrice = parseFloat(pos.current_price) || 0;
                    const profitLoss = parseFloat(pos.profit_loss) || 0;
                    const profitLossPct = parseFloat(pos.profit_loss_pct) || 0;
                    
                    console.log(`\n📊 Posizione: ${ticketId}`);
                    console.log(`   Symbol: ${pos.symbol}`);
                    console.log(`   Entry: $${parseFloat(pos.entry_price).toFixed(6)}`);
                    console.log(`   Current: $${currentPrice.toFixed(6)}`);
                    console.log(`   P&L: $${profitLoss.toFixed(2)}`);
                    console.log(`   P&L %: ${profitLossPct.toFixed(2)}%`);
                    
                    // Verifica se i valori sono cambiati
                    if (previousValues[ticketId]) {
                        const prev = previousValues[ticketId];
                        const priceChanged = Math.abs(currentPrice - prev.current_price) > 0.0001;
                        const pnlChanged = Math.abs(profitLoss - prev.profit_loss) > 0.01;
                        
                        if (priceChanged || pnlChanged) {
                            console.log(`   ✅ AGGIORNAMENTO RILEVATO:`);
                            if (priceChanged) {
                                console.log(`      Prezzo: $${prev.current_price.toFixed(6)} → $${currentPrice.toFixed(6)}`);
                            }
                            if (pnlChanged) {
                                console.log(`      P&L: $${prev.profit_loss.toFixed(2)} → $${profitLoss.toFixed(2)}`);
                            }
                        } else {
                            console.log(`   ⚠️  Nessun aggiornamento (valori identici alla volta precedente)`);
                        }
                    }
                    
                    // Salva valori correnti per confronto
                    previousValues[ticketId] = {
                        current_price: currentPrice,
                        profit_loss: profitLoss,
                        profit_loss_pct: profitLossPct
                    };
                });
                
                if (iteration >= maxIterations) {
                    clearInterval(interval);
                    console.log('\n✅ Monitoraggio completato');
                    process.exit(0);
                }
            } catch (error) {
                console.error('❌ Errore nel recuperare le posizioni:', error.message);
            }
        }, 1000); // Controlla ogni secondo
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

checkPositionUpdates();

