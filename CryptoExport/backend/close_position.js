/**
 * Script per chiudere una posizione aperta
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

const https = require('https');

// Helper per recuperare prezzo da Binance
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

// Funzione per recuperare il prezzo di DOT/USDT
const getDOTPrice = async () => {
    try {
        const url = 'https://api.binance.com/api/v3/ticker/price?symbol=DOTUSDT';
        const data = await httpsGet(url);
        return parseFloat(data.price);
    } catch (error) {
        console.error('❌ Errore nel recuperare il prezzo di DOT/USDT:', error.message);
        throw error;
    }
};

// Funzione per chiudere una posizione
const closePosition = async (ticketId, closePrice) => {
    try {
        // 1. Recupera la posizione
        const position = await dbGet(
            "SELECT * FROM open_positions WHERE ticket_id = $1 AND status = 'open'",
            [ticketId]
        );

        if (!position) {
            throw new Error(`Posizione con ticket_id ${ticketId} non trovata o già chiusa`);
        }

        console.log(`📊 Posizione trovata:`);
        console.log(`   Symbol: ${position.symbol}`);
        console.log(`   Type: ${position.type}`);
        console.log(`   Volume: ${position.volume}`);
        console.log(`   Entry Price: $${parseFloat(position.entry_price).toFixed(6)} USDT`);
        console.log(`   Close Price: $${closePrice.toFixed(6)} USDT`);

        // 2. Calcola P&L
        const entryPrice = parseFloat(position.entry_price);
        const volume = parseFloat(position.volume);
        
        let profitLoss = 0;
        if (position.type === 'buy') {
            // Long position: profit quando il prezzo sale
            profitLoss = (closePrice - entryPrice) * volume;
        } else {
            // Short position: profit quando il prezzo scende
            profitLoss = (entryPrice - closePrice) * volume;
        }
        
        const profitLossPct = ((closePrice - entryPrice) / entryPrice) * 100;
        if (position.type === 'sell') {
            profitLossPct = -profitLossPct;
        }

        console.log(`\n💰 P&L calcolato:`);
        console.log(`   Profit/Loss: $${profitLoss.toFixed(2)} USDT`);
        console.log(`   Profit/Loss %: ${profitLossPct.toFixed(2)}%`);

        // 3. Aggiorna portfolio
        const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
        let balance = parseFloat(portfolio.balance_usd) || 0;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        if (position.type === 'buy') {
            // Long: vendiamo le holdings e aggiungiamo il profit
            balance += closePrice * volume;
            holdings[position.symbol] = (holdings[position.symbol] || 0) - volume;
        } else {
            // Short: rimuoviamo il denaro guadagnato e aggiungiamo le holdings
            balance -= closePrice * volume;
            holdings[position.symbol] = (holdings[position.symbol] || 0) + volume;
        }

        console.log(`\n💵 Balance aggiornato:`);
        console.log(`   Prima: $${parseFloat(portfolio.balance_usd).toFixed(2)} USDT`);
        console.log(`   Dopo: $${balance.toFixed(2)} USDT`);
        console.log(`   Holdings ${position.symbol}: ${(holdings[position.symbol] || 0).toFixed(8)}`);

        // 4. Aggiorna portfolio nel database
        await dbRun(
            "UPDATE portfolio SET balance_usd = $1, holdings = $2",
            [balance, JSON.stringify(holdings)]
        );

        // 5. Chiudi la posizione
        await dbRun(
            `UPDATE open_positions 
             SET status = 'closed', 
                 closed_at = CURRENT_TIMESTAMP, 
                 current_price = $1, 
                 profit_loss = $2, 
                 profit_loss_pct = $3 
             WHERE ticket_id = $4`,
            [closePrice, profitLoss, profitLossPct, ticketId]
        );

        console.log(`\n✅ Posizione chiusa con successo!`);

        return {
            ticket_id: ticketId,
            profit_loss: profitLoss,
            profit_loss_pct: profitLossPct,
            balance_after: balance
        };
    } catch (error) {
        console.error('❌ Errore nella chiusura della posizione:', error.message);
        throw error;
    }
};

// Funzione principale
async function main() {
    try {
        const ticketId = process.argv[2] || 'T1765374777885864'; // Usa il ticket ID passato come argomento o quello dell'ultima apertura

        console.log('🔒 Chiusura posizione\n');
        console.log(`📍 Ticket ID: ${ticketId}\n`);

        // Recupera il prezzo attuale
        console.log('📊 Recupero prezzo attuale di DOT/USDT...');
        const currentPrice = await getDOTPrice();
        console.log(`✅ Prezzo attuale: $${currentPrice.toFixed(6)} USDT\n`);

        // Chiudi la posizione
        const result = await closePosition(ticketId, currentPrice);

        console.log(`\n🎉 Posizione chiusa con successo!\n`);

    } catch (error) {
        console.error('\n❌ Errore:', error.message);
        process.exit(1);
    }
}

// Esegui lo script
main().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

