/**
 * Script per aprire una posizione LONG di DOT/USDT
 * Usa direttamente le funzioni del backend senza dipendere dal server HTTP
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

// Funzione per recuperare il portfolio
const getPortfolio = async () => {
    try {
        const row = await dbGet("SELECT * FROM portfolio LIMIT 1");
        if (!row) {
            return { balance_usd: 10800.0, holdings: '{}' };
        }
        return {
            balance_usd: parseFloat(row.balance_usd) || 0,
            holdings: row.holdings || '{}'
        };
    } catch (error) {
        console.error('❌ Errore nel recuperare il portfolio:', error.message);
        throw error;
    }
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

// Funzione per generare un ticket ID
const generateTicketId = () => {
    return `T${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

// Funzione per aprire la posizione
const openPosition = async (symbol, type, volume, entryPrice, stopLoss = null, takeProfit = null, strategy = 'Manual') => {
    try {
        // 1. Recupera il portfolio
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');
        const cost = volume * entryPrice;

        console.log(`💰 Balance attuale: $${balance.toFixed(2)} USDT`);
        console.log(`💵 Costo posizione: $${cost.toFixed(2)} USDT`);

        // 2. Verifica fondi sufficienti per LONG
        if (type === 'buy') {
            if (balance < cost) {
                throw new Error(`Balance insufficiente: $${balance.toFixed(2)} < $${cost.toFixed(2)} USDT`);
            }
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + volume;
        }

        // 3. Genera ticket ID
        const ticketId = generateTicketId();

        // 4. Aggiorna portfolio
        await dbRun(
            "UPDATE portfolio SET balance_usd = $1, holdings = $2",
            [balance, JSON.stringify(holdings)]
        );

        // 5. Crea posizione
        await dbRun(
            `INSERT INTO open_positions 
            (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, strategy, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')`,
            [ticketId, symbol, type, volume, entryPrice, entryPrice, stopLoss || null, takeProfit || null, strategy]
        );

        // 6. Registra trade
        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy) VALUES ($1, $2, $3, $4, $5)",
            [symbol, type, volume, entryPrice, strategy]
        );

        console.log(`\n✅ Posizione aperta con successo!`);
        console.log(`   Ticket ID: ${ticketId}`);
        console.log(`   Balance aggiornato: $${balance.toFixed(2)} USDT`);
        console.log(`   Holdings ${symbol}: ${holdings[symbol].toFixed(8)}`);

        return {
            ticket_id: ticketId,
            balance_after: balance,
            holdings: holdings[symbol]
        };
    } catch (error) {
        console.error('❌ Errore nell\'aprire la posizione:', error.message);
        throw error;
    }
};

// Funzione principale
async function main() {
    try {
        const SYMBOL = 'polkadot'; // Il sistema usa 'polkadot' come simbolo interno
        const POSITION_SIZE_PERCENT = 5; // 5% del balance

        console.log('🚀 Apertura posizione LONG di DOT/USDT\n');

        // 1. Recupera il prezzo attuale
        console.log('📊 Recupero prezzo attuale di DOT/USDT...');
        const currentPrice = await getDOTPrice();
        console.log(`✅ Prezzo attuale: $${currentPrice.toFixed(6)} USDT\n`);

        // 2. Recupera il portfolio
        console.log('💰 Recupero informazioni portfolio...');
        const portfolio = await getPortfolio();
        console.log(`✅ Balance disponibile: $${portfolio.balance_usd.toFixed(2)} USDT\n`);

        // 3. Calcola la dimensione della posizione
        const positionValue = (portfolio.balance_usd * POSITION_SIZE_PERCENT) / 100;
        const volume = positionValue / currentPrice;

        console.log(`📏 Calcolo dimensione posizione:`);
        console.log(`   Percentuale del balance: ${POSITION_SIZE_PERCENT}%`);
        console.log(`   Valore posizione: $${positionValue.toFixed(2)} USDT`);
        console.log(`   Volume: ${volume.toFixed(8)} DOT\n`);

        // 4. Calcola Stop Loss e Take Profit
        const stopLoss = currentPrice * 0.98; // -2%
        const takeProfit = currentPrice * 1.05; // +5%

        console.log('📈 Parametri di gestione rischio:');
        console.log(`   Stop Loss: $${stopLoss.toFixed(6)} USDT (-2%)`);
        console.log(`   Take Profit: $${takeProfit.toFixed(6)} USDT (+5%)\n`);

        // 5. Apri la posizione
        const result = await openPosition(
            SYMBOL,
            'buy',
            volume,
            currentPrice,
            stopLoss,
            takeProfit,
            'Manual - Script Direct'
        );

        console.log(`\n🎉 Posizione LONG di DOT/USDT aperta con successo!\n`);

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

