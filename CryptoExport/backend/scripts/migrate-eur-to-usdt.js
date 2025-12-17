/**
 * Script di migrazione: Converti tutte le posizioni e il portfolio da EUR a USDT
 * 
 * Questo script:
 * 1. Converte entry_price, current_price, stop_loss, take_profit da EUR a USDT
 * 2. Converte il portfolio balance da EUR a USDT
 * 3. Converte i trades da EUR a USDT
 * 
 * Tasso di conversione: 1 EUR = 1.08 USDT (o 1 USDT = 0.92 EUR)
 */

const db = require('../crypto_db');
const https = require('https');

// Tasso di conversione EUR → USDT
const EUR_TO_USDT_RATE = 1.08;

// Helper per ottenere tasso di cambio reale da Binance
const getUSDTtoEURRate = async () => {
    try {
        const eurUsdData = await new Promise((resolve, reject) => {
            const req = https.get('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });

        if (eurUsdData && eurUsdData.price) {
            const rate = 1 / parseFloat(eurUsdData.price); // 1 USDT = X EUR
            return 1 / rate; // 1 EUR = X USDT
        }
    } catch (e) {
        console.warn('⚠️ Impossibile ottenere tasso da Binance, uso fallback:', e.message);
    }
    return EUR_TO_USDT_RATE; // Fallback
};

// Helper per eseguire query SQL
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
};

async function migrate() {
    try {
        console.log('🔄 [MIGRAZIONE] Inizio conversione da EUR a USDT...\n');

        // 1. Ottieni tasso di conversione reale
        console.log('📊 [MIGRAZIONE] Recupero tasso di conversione EUR/USDT...');
        const conversionRate = await getUSDTtoEURRate();
        console.log(`✅ [MIGRAZIONE] Tasso di conversione: 1 EUR = ${conversionRate.toFixed(4)} USDT\n`);

        // 2. Converti portfolio balance
        console.log('💰 [MIGRAZIONE] Conversione portfolio balance...');
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        if (portfolio) {
            const oldBalance = parseFloat(portfolio.balance_usd) || 0;
            const newBalance = oldBalance * conversionRate;
            
            await dbRun("UPDATE portfolio SET balance_usd = ? WHERE id = 1", [newBalance]);
            console.log(`   ✅ Portfolio: €${oldBalance.toFixed(2)} → $${newBalance.toFixed(2)} USDT`);
        } else {
            console.log('   ⚠️ Portfolio non trovato, creo default...');
            await dbRun("INSERT OR IGNORE INTO portfolio (id, balance_usd, holdings) VALUES (1, ?, '{}')", [10000 * conversionRate]);
        }

        // 3. Converti posizioni aperte
        console.log('\n📈 [MIGRAZIONE] Conversione posizioni aperte...');
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        let openCount = 0;
        
        for (const pos of openPositions) {
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentPrice = parseFloat(pos.current_price) || 0;
            const stopLoss = pos.stop_loss != null ? parseFloat(pos.stop_loss) : null;
            const takeProfit = pos.take_profit != null ? parseFloat(pos.take_profit) : null;
            const takeProfit1 = pos.take_profit_1 != null ? parseFloat(pos.take_profit_1) : null;
            const takeProfit2 = pos.take_profit_2 != null ? parseFloat(pos.take_profit_2) : null;
            const highestPrice = pos.highest_price != null ? parseFloat(pos.highest_price) : null;
            const profitLoss = pos.profit_loss != null ? parseFloat(pos.profit_loss) : null;

            await dbRun(
                `UPDATE open_positions SET 
                    entry_price = ?,
                    current_price = ?,
                    stop_loss = ?,
                    take_profit = ?,
                    take_profit_1 = ?,
                    take_profit_2 = ?,
                    highest_price = ?,
                    profit_loss = ?
                WHERE ticket_id = ?`,
                [
                    entryPrice * conversionRate,
                    currentPrice * conversionRate,
                    stopLoss != null ? stopLoss * conversionRate : null,
                    takeProfit != null ? takeProfit * conversionRate : null,
                    takeProfit1 != null ? takeProfit1 * conversionRate : null,
                    takeProfit2 != null ? takeProfit2 * conversionRate : null,
                    highestPrice != null ? highestPrice * conversionRate : null,
                    profitLoss != null ? profitLoss * conversionRate : null,
                    pos.ticket_id
                ]
            );
            
            openCount++;
            console.log(`   ✅ ${pos.symbol} (${pos.ticket_id}): Entry €${entryPrice.toFixed(4)} → $${(entryPrice * conversionRate).toFixed(4)} USDT`);
        }
        console.log(`\n   📊 Totale posizioni aperte convertite: ${openCount}`);

        // 4. Converti posizioni chiuse
        console.log('\n📉 [MIGRAZIONE] Conversione posizioni chiuse...');
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");
        let closedCount = 0;
        
        for (const pos of closedPositions) {
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentPrice = parseFloat(pos.current_price) || 0;
            const stopLoss = pos.stop_loss != null ? parseFloat(pos.stop_loss) : null;
            const takeProfit = pos.take_profit != null ? parseFloat(pos.take_profit) : null;
            const profitLoss = pos.profit_loss != null ? parseFloat(pos.profit_loss) : null;
            const closedPrice = pos.closed_price != null ? parseFloat(pos.closed_price) : null;

            await dbRun(
                `UPDATE open_positions SET 
                    entry_price = ?,
                    current_price = ?,
                    stop_loss = ?,
                    take_profit = ?,
                    profit_loss = ?,
                    closed_price = ?
                WHERE ticket_id = ?`,
                [
                    entryPrice * conversionRate,
                    currentPrice * conversionRate,
                    stopLoss != null ? stopLoss * conversionRate : null,
                    takeProfit != null ? takeProfit * conversionRate : null,
                    profitLoss != null ? profitLoss * conversionRate : null,
                    closedPrice != null ? closedPrice * conversionRate : null,
                    pos.ticket_id
                ]
            );
            
            closedCount++;
        }
        console.log(`   📊 Totale posizioni chiuse convertite: ${closedCount}`);

        // 5. Converti trades
        console.log('\n💱 [MIGRAZIONE] Conversione trades...');
        const trades = await dbAll("SELECT * FROM trades");
        let tradeCount = 0;
        
        for (const trade of trades) {
            const price = parseFloat(trade.price) || 0;
            const profitLoss = trade.profit_loss != null ? parseFloat(trade.profit_loss) : null;

            await dbRun(
                `UPDATE trades SET 
                    price = ?,
                    profit_loss = ?
                WHERE id = ?`,
                [
                    price * conversionRate,
                    profitLoss != null ? profitLoss * conversionRate : null,
                    trade.id
                ]
            );
            
            tradeCount++;
        }
        console.log(`   📊 Totale trades convertiti: ${tradeCount}`);

        // 6. Riepilogo
        console.log('\n✅ [MIGRAZIONE] Migrazione completata con successo!');
        console.log(`\n📊 Riepilogo:`);
        console.log(`   - Tasso di conversione: 1 EUR = ${conversionRate.toFixed(4)} USDT`);
        console.log(`   - Portfolio: convertito`);
        console.log(`   - Posizioni aperte: ${openCount}`);
        console.log(`   - Posizioni chiuse: ${closedCount}`);
        console.log(`   - Trades: ${tradeCount}`);
        console.log('\n🎉 Tutti i dati sono stati convertiti da EUR a USDT!');
        console.log('\n⚠️ IMPORTANTE: Esegui anche normalize-klines-to-usdt.js per normalizzare klines e price_history!');

        // Chiudi connessione database
        db.close((err) => {
            if (err) {
                console.error('❌ Errore chiusura database:', err.message);
            } else {
                console.log('\n✅ Database chiuso correttamente');
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ [MIGRAZIONE] Errore durante la migrazione:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Esegui migrazione
migrate();
