/**
 * Script per forzare aggiornamento P&L e verificare cosa succede
 * Simula quello che fa updatePositionsPnL per vedere i risultati
 */

const https = require('https');

const VPS_URL = 'https://ticket.logikaservice.it';

function httpsGet(url) {
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
}

async function testPriceRetrieval() {
    try {
        console.log('🔍 Test recupero prezzo polkadot dalla VPS...\n');
        
        // 1. Verifica posizione attuale
        console.log('📊 1. Posizione attuale nel database:');
        const positionsRes = await httpsGet(`${VPS_URL}/api/crypto/positions?status=open`);
        const positions = positionsRes.positions || [];
        
        if (positions.length === 0) {
            console.log('⚠️  Nessuna posizione aperta');
            return;
        }
        
        const polkadotPos = positions.find(p => p.symbol === 'polkadot');
        if (!polkadotPos) {
            console.log('⚠️  Nessuna posizione polkadot trovata');
            return;
        }
        
        console.log(`   Ticket ID: ${polkadotPos.ticket_id}`);
        console.log(`   Entry Price (DB): $${parseFloat(polkadotPos.entry_price).toFixed(6)} USDT`);
        console.log(`   Current Price (DB): $${parseFloat(polkadotPos.current_price || 0).toFixed(6)} USDT`);
        console.log(`   P&L (DB): $${parseFloat(polkadotPos.profit_loss || 0).toFixed(2)} USDT`);
        console.log(`   P&L % (DB): ${parseFloat(polkadotPos.profit_loss_pct || 0).toFixed(2)}%\n`);
        
        // 2. Recupera prezzo attuale da Binance
        console.log('🌐 2. Prezzo attuale da Binance:');
        const binanceData = await httpsGet('https://api.binance.com/api/v3/ticker/price?symbol=DOTUSDT');
        const binancePrice = parseFloat(binanceData.price);
        console.log(`   Prezzo Binance: $${binancePrice.toFixed(6)} USDT\n`);
        
        // 3. Verifica prezzo tramite endpoint VPS
        console.log('🔍 3. Prezzo tramite endpoint VPS:');
        try {
            const priceRes = await httpsGet(`${VPS_URL}/api/crypto/price/polkadot`);
            const vpsPrice = parseFloat(priceRes.price || 0);
            console.log(`   Prezzo VPS: $${vpsPrice.toFixed(6)} USDT`);
            
            if (Math.abs(vpsPrice - binancePrice) > 0.01) {
                console.log(`   ⚠️  DISCREPANZA: VPS=$${vpsPrice.toFixed(6)} vs Binance=$${binancePrice.toFixed(6)} (diff: $${Math.abs(vpsPrice - binancePrice).toFixed(6)})`);
            } else {
                console.log(`   ✅ Prezzo VPS corrisponde a Binance`);
            }
        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}`);
        }
        
        console.log('\n');
        
        // 4. Calcola P&L teorico
        console.log('📈 4. P&L Teorico (con prezzo Binance):');
        const entryPrice = parseFloat(polkadotPos.entry_price);
        const volume = parseFloat(polkadotPos.volume);
        const isLong = polkadotPos.type === 'buy';
        
        let theoreticalPnL = 0;
        let theoreticalPnLPct = 0;
        
        if (isLong) {
            theoreticalPnL = (binancePrice - entryPrice) * volume;
            theoreticalPnLPct = ((binancePrice - entryPrice) / entryPrice) * 100;
        } else {
            theoreticalPnL = (entryPrice - binancePrice) * volume;
            theoreticalPnLPct = ((entryPrice - binancePrice) / entryPrice) * 100;
        }
        
        console.log(`   P&L Teorico: $${theoreticalPnL.toFixed(2)} USDT (${theoreticalPnLPct >= 0 ? '+' : ''}${theoreticalPnLPct.toFixed(2)}%)`);
        console.log(`   P&L Database: $${parseFloat(polkadotPos.profit_loss || 0).toFixed(2)} USDT (${parseFloat(polkadotPos.profit_loss_pct || 0).toFixed(2)}%)`);
        
        const dbPnL = parseFloat(polkadotPos.profit_loss || 0);
        const dbPnLPct = parseFloat(polkadotPos.profit_loss_pct || 0);
        
        if (Math.abs(theoreticalPnL - dbPnL) > 0.1 || Math.abs(theoreticalPnLPct - dbPnLPct) > 0.1) {
            console.log(`   ⚠️  DISCREPANZA P&L: Teorico vs Database`);
            console.log(`      Differenza P&L: $${Math.abs(theoreticalPnL - dbPnL).toFixed(2)}`);
            console.log(`      Differenza %: ${Math.abs(theoreticalPnLPct - dbPnLPct).toFixed(2)}%`);
        } else {
            console.log(`   ✅ P&L corrisponde`);
        }
        
        // 5. Verifica rapporto prezzo DB vs Binance
        console.log('\n🔍 5. Analisi discrepanza prezzo:');
        const dbPrice = parseFloat(polkadotPos.current_price || 0);
        const priceRatio = dbPrice > 0 ? binancePrice / dbPrice : 0;
        const priceDiff = Math.abs(binancePrice - dbPrice);
        const priceDiffPct = dbPrice > 0 ? (priceDiff / dbPrice) * 100 : 0;
        
        console.log(`   Rapporto Binance/DB: ${priceRatio.toFixed(4)}`);
        console.log(`   Differenza assoluta: $${priceDiff.toFixed(6)}`);
        console.log(`   Differenza %: ${priceDiffPct.toFixed(2)}%`);
        
        if (Math.abs(priceRatio - 1.16) < 0.05) {
            console.log(`   ⚠️  POSSIBILE CONVERSIONE EUR/USDT: Il rapporto è simile a 1.16 (tasso EUR/USD)`);
        } else if (Math.abs(priceRatio - 0.86) < 0.05) {
            console.log(`   ⚠️  POSSIBILE CONVERSIONE USDT/EUR: Il rapporto è simile a 0.86 (inverso tasso EUR/USD)`);
        }
        
        // 6. Verifica entry price vs current price DB
        console.log('\n🔍 6. Verifica entry price vs current price DB:');
        const entryVsDbRatio = dbPrice > 0 ? entryPrice / dbPrice : 0;
        console.log(`   Entry Price: $${entryPrice.toFixed(6)}`);
        console.log(`   Current Price (DB): $${dbPrice.toFixed(6)}`);
        console.log(`   Rapporto Entry/DB: ${entryVsDbRatio.toFixed(4)}`);
        
        if (Math.abs(entryPrice - dbPrice) > entryPrice * 0.1) {
            console.log(`   ⚠️  PROBLEMA: Current price DB molto diverso da entry price!`);
            console.log(`      Questo suggerisce che il prezzo nel DB è stato sovrascritto con un valore errato.`);
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error('Stack:', error.stack);
    }
}

testPriceRetrieval();

