#!/usr/bin/env node
/**
 * Script per identificare e correggere valori anomali di profit_loss nel database
 * 
 * Questo script:
 * 1. Identifica posizioni chiuse con profit_loss anomali (> ±1 milione EUR)
 * 2. Identifica trades con profit_loss anomali
 * 3. Fornisce report dettagliato
 * 4. Permette di correggere/resettare i valori anomali
 * 
 * Uso:
 *   node backend/scripts/fix-anomalous-profit-loss.js --dry-run  (solo report, nessuna modifica)
 *   node backend/scripts/fix-anomalous-profit-loss.js --fix      (corregge i valori anomali)
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Percorso database
const DB_PATH = path.join(__dirname, '../../crypto.db');

// Limiti ragionevoli per profit_loss
const MAX_REASONABLE_PNL = 1000000; // ±1 milione EUR
const MAX_REASONABLE_PERCENT = 1000; // ±1000% è già estremo

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('--report');
const fix = args.includes('--fix') || args.includes('--corrige');
const verbose = args.includes('--verbose') || args.includes('-v');

if (!dryRun && !fix) {
    console.log('⚠️  Nessuna azione specificata. Uso:');
    console.log('   --dry-run  : Solo report (nessuna modifica)');
    console.log('   --fix      : Corregge i valori anomali');
    console.log('');
    console.log('Eseguo in modalità --dry-run...\n');
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('❌ Errore apertura database:', err.message);
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

function dbAll(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function analyzeClosedPositions(db) {
    console.log('\n📊 Analisi Posizioni Chiuse...');
    const positions = await dbAll(db, 
        "SELECT ticket_id, symbol, type, entry_price, current_price, volume, profit_loss, closed_at, status FROM open_positions WHERE status != 'open'"
    );

    const anomalous = [];
    let totalAnomalousValue = 0;

    positions.forEach(pos => {
        const pnl = parseFloat(pos.profit_loss) || 0;
        if (Math.abs(pnl) > MAX_REASONABLE_PNL) {
            const entryValue = (parseFloat(pos.entry_price) || 0) * (parseFloat(pos.volume) || 0);
            const pnlPercent = entryValue > 0 ? ((pnl / entryValue) * 100) : 0;
            
            anomalous.push({
                type: 'closed_position',
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                entry_price: pos.entry_price,
                volume: pos.volume,
                entry_value: entryValue,
                profit_loss: pnl,
                profit_loss_percent: pnlPercent,
                closed_at: pos.closed_at,
                status: pos.status
            });
            
            totalAnomalousValue += Math.abs(pnl);
        }
    });

    console.log(`   ✅ Totale posizioni chiuse: ${positions.length}`);
    console.log(`   ⚠️  Posizioni anomale: ${anomalous.length}`);
    if (anomalous.length > 0) {
        console.log(`   💰 Valore anomalo totale: €${totalAnomalousValue.toFixed(2)}`);
        console.log(`   📋 Dettagli:`);
        anomalous.slice(0, 10).forEach(pos => {
            console.log(`      - ${pos.ticket_id.substring(0, 8)}... | ${pos.symbol} | P&L: €${pos.profit_loss.toFixed(2)} (${pos.profit_loss_percent.toFixed(2)}%) | ${pos.closed_at}`);
        });
        if (anomalous.length > 10) {
            console.log(`      ... e altre ${anomalous.length - 10} posizioni`);
        }
    }

    return anomalous;
}

async function analyzeTrades(db) {
    console.log('\n📊 Analisi Trades...');
    const trades = await dbAll(db,
        "SELECT id, ticket_id, symbol, type, amount, price, profit_loss, timestamp FROM trades WHERE profit_loss IS NOT NULL"
    );

    const anomalous = [];
    let totalAnomalousValue = 0;

    trades.forEach(trade => {
        const pnl = parseFloat(trade.profit_loss) || 0;
        if (Math.abs(pnl) > MAX_REASONABLE_PNL) {
            const tradeValue = (parseFloat(trade.amount) || 0) * (parseFloat(trade.price) || 0);
            const pnlPercent = tradeValue > 0 ? ((pnl / tradeValue) * 100) : 0;
            
            anomalous.push({
                type: 'trade',
                id: trade.id,
                ticket_id: trade.ticket_id,
                symbol: trade.symbol,
                type: trade.type,
                amount: trade.amount,
                price: trade.price,
                trade_value: tradeValue,
                profit_loss: pnl,
                profit_loss_percent: pnlPercent,
                timestamp: trade.timestamp
            });
            
            totalAnomalousValue += Math.abs(pnl);
        }
    });

    console.log(`   ✅ Totale trades con profit_loss: ${trades.length}`);
    console.log(`   ⚠️  Trades anomali: ${anomalous.length}`);
    if (anomalous.length > 0) {
        console.log(`   💰 Valore anomalo totale: €${totalAnomalousValue.toFixed(2)}`);
        console.log(`   📋 Dettagli:`);
        anomalous.slice(0, 10).forEach(trade => {
            console.log(`      - Trade #${trade.id} | ${trade.symbol} | ${trade.type} | P&L: €${trade.profit_loss.toFixed(2)} (${trade.profit_loss_percent.toFixed(2)}%) | ${trade.timestamp}`);
        });
        if (anomalous.length > 10) {
            console.log(`      ... e altri ${anomalous.length - 10} trades`);
        }
    }

    return anomalous;
}

function calculateCorrectPnL(position) {
    // Calcola il P&L corretto basandosi su entry_price, volume, e un prezzo di chiusura ragionevole
    // Se non possiamo calcolarlo, restituiamo 0
    const entryPrice = parseFloat(position.entry_price) || 0;
    const volume = parseFloat(position.volume) || 0;
    const currentPrice = parseFloat(position.current_price) || entryPrice;
    
    if (entryPrice <= 0 || volume <= 0) {
        return 0; // Dati insufficienti, resetta a 0
    }

    let correctPnL = 0;
    if (position.type === 'buy') {
        correctPnL = (currentPrice - entryPrice) * volume;
    } else if (position.type === 'sell') {
        correctPnL = (entryPrice - currentPrice) * volume;
    }

    // Se anche il P&L calcolato è anomalo, probabilmente il prezzo di chiusura è errato
    if (Math.abs(correctPnL) > MAX_REASONABLE_PNL) {
        return 0; // Resetta a 0 se il calcolo dà ancora valori anomali
    }

    return correctPnL;
}

async function fixClosedPositions(db, anomalous) {
    console.log('\n🔧 Correzione Posizioni Chiuse...');
    let fixed = 0;
    let reset = 0;

    for (const pos of anomalous) {
        try {
            // Prova a calcolare P&L corretto
            const correctPnL = calculateCorrectPnL(pos);
            
            if (Math.abs(correctPnL) <= MAX_REASONABLE_PNL && correctPnL !== 0) {
                // Correggi con il valore calcolato
                await dbRun(db,
                    "UPDATE open_positions SET profit_loss = ? WHERE ticket_id = ?",
                    [correctPnL, pos.ticket_id]
                );
                fixed++;
                if (verbose) {
                    console.log(`   ✅ Corretto ${pos.ticket_id.substring(0, 8)}...: €${pos.profit_loss.toFixed(2)} → €${correctPnL.toFixed(2)}`);
                }
            } else {
                // Resetta a 0 se non possiamo calcolarlo
                await dbRun(db,
                    "UPDATE open_positions SET profit_loss = 0 WHERE ticket_id = ?",
                    [pos.ticket_id]
                );
                reset++;
                if (verbose) {
                    console.log(`   🔄 Resettato ${pos.ticket_id.substring(0, 8)}...: €${pos.profit_loss.toFixed(2)} → €0.00`);
                }
            }
        } catch (err) {
            console.error(`   ❌ Errore correzione ${pos.ticket_id}:`, err.message);
        }
    }

    console.log(`   ✅ Corrette: ${fixed}`);
    console.log(`   🔄 Resettate: ${reset}`);
    console.log(`   📊 Totale processate: ${anomalous.length}`);
}

async function fixTrades(db, anomalous) {
    console.log('\n🔧 Correzione Trades...');
    let fixed = 0;
    let reset = 0;

    for (const trade of anomalous) {
        try {
            // Per i trades, se il profit_loss è anomalo, resettiamo a 0
            // (i trades di chiusura dovrebbero già avere il profit_loss corretto dalla posizione)
            await dbRun(db,
                "UPDATE trades SET profit_loss = NULL WHERE id = ?",
                [trade.id]
            );
            reset++;
            if (verbose) {
                console.log(`   🔄 Resettato Trade #${trade.id}: €${trade.profit_loss.toFixed(2)} → NULL`);
            }
        } catch (err) {
            console.error(`   ❌ Errore correzione trade #${trade.id}:`, err.message);
        }
    }

    console.log(`   🔄 Resettati: ${reset}`);
    console.log(`   📊 Totale processati: ${anomalous.length}`);
}

async function main() {
    console.log('🔍 Analisi Database per Valori Anomali di Profit/Loss\n');
    console.log(`📁 Database: ${DB_PATH}`);
    console.log(`📊 Limite ragionevole: ±€${MAX_REASONABLE_PNL.toLocaleString()}\n`);

    let db;
    try {
        db = await openDatabase();
        
        // Analisi
        const anomalousPositions = await analyzeClosedPositions(db);
        const anomalousTrades = await analyzeTrades(db);

        const totalAnomalous = anomalousPositions.length + anomalousTrades.length;

        console.log('\n' + '='.repeat(60));
        console.log(`📊 REPORT RIEPILOGATIVO`);
        console.log('='.repeat(60));
        console.log(`⚠️  Posizioni chiuse anomale: ${anomalousPositions.length}`);
        console.log(`⚠️  Trades anomali: ${anomalousTrades.length}`);
        console.log(`⚠️  TOTALE RECORD ANOMALI: ${totalAnomalous}`);
        
        if (totalAnomalous > 0) {
            const totalAnomalousValue = anomalousPositions.reduce((sum, p) => sum + Math.abs(p.profit_loss), 0) +
                                      anomalousTrades.reduce((sum, t) => sum + Math.abs(t.profit_loss), 0);
            console.log(`💰 Valore anomalo totale: €${totalAnomalousValue.toFixed(2)}`);
        }

        // Correzione se richiesta
        if (fix && totalAnomalous > 0) {
            console.log('\n' + '='.repeat(60));
            console.log(`🔧 MODALITÀ CORREZIONE`);
            console.log('='.repeat(60));
            
            if (anomalousPositions.length > 0) {
                await fixClosedPositions(db, anomalousPositions);
            }
            
            if (anomalousTrades.length > 0) {
                await fixTrades(db, anomalousTrades);
            }

            console.log('\n✅ Correzione completata!');
            console.log('💡 Suggerimento: Ricarica le statistiche nel frontend per vedere i valori corretti.');
        } else if (dryRun && totalAnomalous > 0) {
            console.log('\n💡 Per correggere i valori anomali, esegui:');
            console.log('   node backend/scripts/fix-anomalous-profit-loss.js --fix');
        } else if (totalAnomalous === 0) {
            console.log('\n✅ Nessun valore anomalo trovato! Il database è pulito.');
        }

    } catch (err) {
        console.error('\n❌ Errore durante l\'analisi:', err.message);
        if (verbose) {
            console.error(err.stack);
        }
        process.exit(1);
    } finally {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('❌ Errore chiusura database:', err.message);
                }
            });
        }
    }
}

// Esegui
main().catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});
