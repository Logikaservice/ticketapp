/**
 * Script per verificare i valori correnti di una posizione nel database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;

async function checkPosition() {
    try {
        console.log('🔍 Verifica valori posizioni nel database...\n');
        
        // Recupera tutte le posizioni aperte
        const positions = await dbAll("SELECT ticket_id, symbol, entry_price, current_price, profit_loss, profit_loss_pct, opened_at FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 5");
        
        if (positions.length === 0) {
            console.log('⚠️  Nessuna posizione aperta trovata');
            return;
        }
        
        console.log(`📊 Trovate ${positions.length} posizione/i aperta/e:\n`);
        
        positions.forEach((pos, index) => {
            console.log(`${index + 1}. Ticket ID: ${pos.ticket_id}`);
            console.log(`   Symbol: ${pos.symbol}`);
            console.log(`   Entry Price: $${parseFloat(pos.entry_price).toFixed(6)} USDT`);
            console.log(`   Current Price (DB): $${parseFloat(pos.current_price || 0).toFixed(6)} USDT`);
            console.log(`   P&L (DB): $${parseFloat(pos.profit_loss || 0).toFixed(2)} USDT`);
            console.log(`   P&L % (DB): ${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%`);
            console.log(`   Aperta il: ${new Date(pos.opened_at).toLocaleString()}`);
            console.log('');
        });
        
        // Recupera anche il prezzo attuale da Binance per confronto
        const https = require('https');
        const httpsGet = (url) => {
            return new Promise((resolve, reject) => {
                const req = https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error(`Failed to parse JSON: ${e.message}`));
                        }
                    });
                });
                req.on('error', reject);
                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
                req.end();
            });
        };
        
        // Verifica il prezzo attuale da Binance per le posizioni
        const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
        console.log('🌐 Prezzi attuali da Binance:\n');
        
        for (const symbol of uniqueSymbols) {
            try {
                // Mappa simboli interni a coppie Binance
                const symbolMap = {
                    'polkadot': 'DOTUSDT',
                    'bitcoin': 'BTCUSDT',
                    'ethereum': 'ETHUSDT',
                    'solana': 'SOLUSDT',
                    'cardano': 'ADAUSDT'
                };
                
                const binanceSymbol = symbolMap[symbol.toLowerCase()] || `${symbol.toUpperCase()}USDT`;
                const url = `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`;
                const data = await httpsGet(url);
                const binancePrice = parseFloat(data.price);
                
                console.log(`   ${symbol}: $${binancePrice.toFixed(6)} USDT`);
                
                // Confronta con il prezzo nel database
                const pos = positions.find(p => p.symbol === symbol);
                if (pos) {
                    const dbPrice = parseFloat(pos.current_price || 0);
                    const diff = Math.abs(binancePrice - dbPrice);
                    if (diff > 0.001) {
                        console.log(`   ⚠️  DISCREPANZA: DB=$${dbPrice.toFixed(6)} vs Binance=$${binancePrice.toFixed(6)} (diff: $${diff.toFixed(6)})`);
                    } else {
                        console.log(`   ✅ Prezzo DB aggiornato correttamente`);
                    }
                }
            } catch (error) {
                console.log(`   ❌ Errore recupero prezzo per ${symbol}: ${error.message}`);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

checkPosition();

