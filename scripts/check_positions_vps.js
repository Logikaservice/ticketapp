/**
 * Script per verificare i valori delle posizioni sulla VPS e confrontarli con Binance
 */

const https = require('https');
const http = require('http');

const VPS_URL = 'https://ticket.logikaservice.it';
const API_BASE_URL = `${VPS_URL}/api/crypto`;

// Funzione helper per fare richieste HTTP/HTTPS
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
            },
            rejectUnauthorized: false
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
                        reject(new Error(`HTTP ${res.statusCode}: ${jsonData.error || data}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                }
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

// Funzione per recuperare prezzo da Binance
async function getBinancePrice(symbol) {
    const symbolMap = {
        'polkadot': 'DOTUSDT',
        'bitcoin': 'BTCUSDT',
        'ethereum': 'ETHUSDT',
        'solana': 'SOLUSDT',
        'cardano': 'ADAUSDT'
    };
    
    const binanceSymbol = symbolMap[symbol.toLowerCase()] || `${symbol.toUpperCase()}USDT`;
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`;
    return makeRequest(url);
}

async function checkPositions() {
    try {
        console.log('🔍 Verifica posizioni sulla VPS e confronto con Binance...\n');
        console.log(`📍 VPS URL: ${VPS_URL}\n`);
        
        // 1. Recupera posizioni aperte dalla VPS
        console.log('📊 Recupero posizioni aperte dalla VPS...');
        const positionsRes = await makeRequest(`${API_BASE_URL}/positions?status=open`);
        const positions = positionsRes.positions || [];
        
        if (positions.length === 0) {
            console.log('⚠️  Nessuna posizione aperta trovata sulla VPS');
            return;
        }
        
        console.log(`✅ Trovate ${positions.length} posizione/i aperta/e:\n`);
        
        // 2. Per ogni posizione, confronta con Binance
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            console.log(`${i + 1}. Ticket ID: ${pos.ticket_id}`);
            console.log(`   Symbol: ${pos.symbol}`);
            console.log(`   Type: ${pos.type.toUpperCase()}`);
            console.log(`   Volume: ${parseFloat(pos.volume).toFixed(8)}`);
            console.log(`   Entry Price: $${parseFloat(pos.entry_price).toFixed(6)} USDT`);
            console.log(`   Current Price (DB VPS): $${parseFloat(pos.current_price || 0).toFixed(6)} USDT`);
            console.log(`   P&L (DB VPS): $${parseFloat(pos.profit_loss || 0).toFixed(2)} USDT`);
            console.log(`   P&L % (DB VPS): ${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%`);
            console.log(`   Stop Loss: ${pos.stop_loss ? '$' + parseFloat(pos.stop_loss).toFixed(6) : '-'}`);
            console.log(`   Take Profit: ${pos.take_profit ? '$' + parseFloat(pos.take_profit).toFixed(6) : '-'}`);
            console.log(`   Aperta il: ${new Date(pos.opened_at).toLocaleString()}`);
            
            // 3. Recupera prezzo attuale da Binance
            try {
                const binanceData = await getBinancePrice(pos.symbol);
                const binancePrice = parseFloat(binanceData.price);
                
                console.log(`   🌐 Prezzo Binance LIVE: $${binancePrice.toFixed(6)} USDT`);
                
                // Confronta con DB
                const dbPrice = parseFloat(pos.current_price || 0);
                const diff = Math.abs(binancePrice - dbPrice);
                
                if (diff > 0.001) {
                    console.log(`   ⚠️  DISCREPANZA: DB=$${dbPrice.toFixed(6)} vs Binance=$${binancePrice.toFixed(6)} (diff: $${diff.toFixed(6)})`);
                    console.log(`   ❌ Il prezzo nel database NON è aggiornato!`);
                } else {
                    console.log(`   ✅ Prezzo DB aggiornato correttamente (diff: $${diff.toFixed(6)})`);
                }
                
                // Calcola P&L teorico con prezzo Binance
                const entryPrice = parseFloat(pos.entry_price);
                const volume = parseFloat(pos.volume);
                let theoreticalPnL = 0;
                let theoreticalPnLPct = 0;
                
                if (pos.type === 'buy') {
                    theoreticalPnL = (binancePrice - entryPrice) * volume;
                    theoreticalPnLPct = ((binancePrice - entryPrice) / entryPrice) * 100;
                } else {
                    theoreticalPnL = (entryPrice - binancePrice) * volume;
                    theoreticalPnLPct = ((entryPrice - binancePrice) / entryPrice) * 100;
                }
                
                console.log(`   📈 P&L Teorico (con prezzo Binance): $${theoreticalPnL.toFixed(2)} USDT (${theoreticalPnLPct >= 0 ? '+' : ''}${theoreticalPnLPct.toFixed(2)}%)`);
                
                const dbPnL = parseFloat(pos.profit_loss || 0);
                const dbPnLPct = parseFloat(pos.profit_loss_pct || 0);
                
                if (Math.abs(theoreticalPnL - dbPnL) > 0.1 || Math.abs(theoreticalPnLPct - dbPnLPct) > 0.1) {
                    console.log(`   ⚠️  DISCREPANZA P&L: DB=$${dbPnL.toFixed(2)} (${dbPnLPct.toFixed(2)}%) vs Teorico=$${theoreticalPnL.toFixed(2)} (${theoreticalPnLPct.toFixed(2)}%)`);
                    console.log(`   ❌ Il P&L nel database NON è aggiornato!`);
                } else {
                    console.log(`   ✅ P&L DB aggiornato correttamente`);
                }
                
            } catch (error) {
                console.log(`   ❌ Errore recupero prezzo Binance: ${error.message}`);
            }
            
            console.log('');
        }
        
        // 4. Forza aggiornamento P&L e verifica di nuovo dopo 2 secondi
        console.log('\n🔄 Forzo aggiornamento P&L sulla VPS...');
        try {
            await makeRequest(`${API_BASE_URL}/positions/update-pnl`);
            console.log('✅ Aggiornamento P&L inviato');
            
            console.log('\n⏳ Attendo 2 secondi e ricontrollo...\n');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const updatedRes = await makeRequest(`${API_BASE_URL}/positions?status=open`);
            const updatedPositions = updatedRes.positions || [];
            
            if (updatedPositions.length > 0) {
                const latestPos = updatedPositions[0];
                console.log('📊 Dopo aggiornamento:');
                console.log(`   Current Price (DB): $${parseFloat(latestPos.current_price || 0).toFixed(6)} USDT`);
                console.log(`   P&L (DB): $${parseFloat(latestPos.profit_loss || 0).toFixed(2)} USDT`);
                console.log(`   P&L % (DB): ${parseFloat(latestPos.profit_loss_pct || 0).toFixed(2)}%`);
            }
        } catch (error) {
            console.log(`⚠️  Errore aggiornamento P&L: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

checkPositions();

