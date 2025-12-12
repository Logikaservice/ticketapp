/**
 * Script per aprire una posizione LONG di DOT/USDT
 * Utilizza l'API del backend per aprire la posizione
 */

const https = require('https');
const http = require('http');

// Configurazione
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const SYMBOL = 'polkadot'; // Il sistema accetta anche 'polkadot_usdt' o 'dot'
const POSITION_SIZE_PERCENT = 5; // Percentuale del balance da usare (5% = conservativo)

// Funzione helper per fare richieste HTTP
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = protocol.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonData);
                    } else {
                        const errorMsg = jsonData.error || jsonData.message || data || 'Unknown error';
                        console.error(`❌ Errore HTTP ${res.statusCode}:`, errorMsg);
                        reject(new Error(`HTTP ${res.statusCode}: ${errorMsg}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        console.error(`❌ Errore HTTP ${res.statusCode}, risposta non JSON:`, data.substring(0, 200));
                        reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                    }
                }
            });
        });

        req.on('error', (err) => {
            console.error(`❌ Errore di connessione HTTP:`, err.message);
            reject(err);
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// Funzione per recuperare il prezzo attuale di DOT/USDT da Binance
async function getDOTPrice() {
    try {
        const url = 'https://api.binance.com/api/v3/ticker/price?symbol=DOTUSDT';
        const data = await makeRequest(url);
        return parseFloat(data.price);
    } catch (error) {
        console.error('❌ Errore nel recuperare il prezzo di DOT/USDT:', error.message);
        throw error;
    }
}

// Funzione per recuperare il portfolio e il balance
async function getPortfolio() {
    try {
        // Usa l'endpoint dashboard che contiene le info del portfolio
        const url = `${API_BASE_URL}/api/crypto/dashboard`;
        const data = await makeRequest(url);
        return {
            balance: parseFloat(data.portfolio?.balance_usd || data.balance_usd || 0),
            holdings: data.portfolio?.holdings || data.holdings || {}
        };
    } catch (error) {
        console.error('❌ Errore nel recuperare il portfolio:', error.message);
        // Prova a usare un approccio alternativo - usa solo il prezzo e lascia che l'API gestisca il balance
        console.log('⚠️  Non posso recuperare il portfolio, procedo con una dimensione fissa');
        return null;
    }
}

// Funzione per aprire la posizione
async function openPosition(symbol, type, volume, entryPrice, stopLoss = null, takeProfit = null) {
    try {
        const url = `${API_BASE_URL}/api/crypto/positions/open`;
        const body = {
            symbol: symbol,
            type: type,
            volume: volume,
            entry_price: entryPrice,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            strategy: 'Manual - Script'
        };

        console.log('\n📤 Invio richiesta per aprire posizione...');
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Type: ${type}`);
        console.log(`   Volume: ${volume.toFixed(8)} DOT`);
        console.log(`   Entry Price: $${entryPrice.toFixed(6)} USDT`);
        console.log(`   Size: $${(volume * entryPrice).toFixed(2)} USDT`);
        
        if (stopLoss) console.log(`   Stop Loss: $${stopLoss.toFixed(6)} USDT`);
        if (takeProfit) console.log(`   Take Profit: $${takeProfit.toFixed(6)} USDT`);

        const data = await makeRequest(url, {
            method: 'POST',
            body: body
        });

        return data;
    } catch (error) {
        console.error('❌ Errore nell\'aprire la posizione:', error.message);
        throw error;
    }
}

// Funzione principale
async function main() {
    try {
        console.log('🚀 Apertura posizione LONG di DOT/USDT\n');
        console.log(`📍 API Base URL: ${API_BASE_URL}\n`);

        // 1. Recupera il prezzo attuale
        console.log('📊 Recupero prezzo attuale di DOT/USDT...');
        const currentPrice = await getDOTPrice();
        console.log(`✅ Prezzo attuale: $${currentPrice.toFixed(6)} USDT\n`);

        // 2. Recupera il portfolio (opzionale)
        console.log('💰 Recupero informazioni portfolio...');
        const portfolio = await getPortfolio();
        
        let positionValue, volume;
        
        if (portfolio && portfolio.balance > 0) {
            console.log(`✅ Balance disponibile: $${portfolio.balance.toFixed(2)} USDT\n`);
            
            // Calcola la dimensione della posizione basata sul balance
            positionValue = (portfolio.balance * POSITION_SIZE_PERCENT) / 100;
            volume = positionValue / currentPrice;

            console.log(`📏 Calcolo dimensione posizione:`);
            console.log(`   Percentuale del balance: ${POSITION_SIZE_PERCENT}%`);
            console.log(`   Valore posizione: $${positionValue.toFixed(2)} USDT`);
            console.log(`   Volume: ${volume.toFixed(8)} DOT\n`);

            // Verifica che ci siano fondi sufficienti
            if (portfolio.balance < positionValue) {
                throw new Error(`Balance insufficiente: $${portfolio.balance.toFixed(2)} < $${positionValue.toFixed(2)} USDT`);
            }
        } else {
            // Usa una dimensione fissa se non posso recuperare il portfolio
            // $100 USDT è una dimensione ragionevole per un test
            positionValue = 100;
            volume = positionValue / currentPrice;
            
            console.log(`⚠️  Portfolio non disponibile, uso dimensione fissa:`);
            console.log(`   Valore posizione: $${positionValue.toFixed(2)} USDT`);
            console.log(`   Volume: ${volume.toFixed(8)} DOT\n`);
        }

        // 5. Calcola Stop Loss e Take Profit (opzionale)
        // Stop Loss: -2% dal prezzo di entrata
        const stopLoss = currentPrice * 0.98;
        // Take Profit: +5% dal prezzo di entrata
        const takeProfit = currentPrice * 1.05;

        console.log('📈 Parametri di gestione rischio:');
        console.log(`   Stop Loss: $${stopLoss.toFixed(6)} USDT (-2%)`);
        console.log(`   Take Profit: $${takeProfit.toFixed(6)} USDT (+5%)\n`);

        // 6. Apri la posizione
        const result = await openPosition(
            SYMBOL,
            'buy', // 'buy' per posizione long
            volume,
            currentPrice,
            stopLoss,
            takeProfit
        );

        console.log('\n✅ Posizione aperta con successo!');
        console.log(`   Ticket ID: ${result.ticket_id}`);
        console.log(`   Messaggio: ${result.message}\n`);

    } catch (error) {
        console.error('\n❌ Errore:', error.message);
        process.exit(1);
    }
}

// Esegui lo script
main();

