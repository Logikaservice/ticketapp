/**
 * Script di Diagnostica Balance
 * Analizza il calcolo del Total Balance e identifica problemi
 */

const db = require('../crypto_db');
const https = require('https');

// Helper per chiamate HTTP
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Helper per ottenere prezzo simbolo (semplificato, senza cache)
async function getSymbolPrice(symbol) {
    try {
        const SYMBOL_TO_COINGECKO = {
            'bitcoin': 'bitcoin',
            'bitcoin_usdt': 'bitcoin',
            'solana': 'solana',
            'ethereum': 'ethereum',
            'sand': 'the-sandbox',
            'mana': 'decentraland',
            // Aggiungi altri se necessario
        };
        
        const coingeckoId = SYMBOL_TO_COINGECKO[symbol] || symbol.toLowerCase();
        const geckoData = await httpsGet(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=eur`);
        
        if (geckoData && geckoData[coingeckoId] && geckoData[coingeckoId].eur) {
            return parseFloat(geckoData[coingeckoId].eur);
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Promise-based database helpers
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
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

async function diagnoseBalance() {
    console.log('🔍 [DIAGNOSTICA BALANCE] Inizio analisi...\n');
    
    try {
        // 1. Leggi balance attuale
        const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
        const currentBalance = parseFloat(portfolio?.balance_usd || 0);
        console.log(`💰 Balance attuale nel DB: €${currentBalance.toFixed(2)}\n`);
        
        // 2. Analizza posizioni aperte
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        console.log(`📊 Posizioni aperte: ${openPositions.length}`);
        
        let totalInvestedOpen = 0;
        const openIssues = [];
        
        for (const pos of openPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const invested = remainingVolume * entryPrice;
            totalInvestedOpen += invested;
            
            // Verifica anomalie
            try {
                const currentPrice = await getSymbolPrice(pos.symbol);
                if (currentPrice > 0) {
                    const priceRatio = entryPrice > 0 ? entryPrice / currentPrice : 0;
                    if (priceRatio > 10 || (priceRatio < 0.1 && priceRatio > 0)) {
                        openIssues.push({
                            ticket_id: pos.ticket_id,
                            symbol: pos.symbol,
                            issue: `entryPrice (€${entryPrice.toFixed(6)}) molto diverso da currentPrice (€${currentPrice.toFixed(6)}) - ratio: ${priceRatio.toFixed(2)}x`,
                            entry_price: entryPrice,
                            current_price: currentPrice,
                            ratio: priceRatio
                        });
                    }
                }
            } catch (e) {
                // Skip se errore
            }
        }
        
        console.log(`   Capitale investito in posizioni aperte: €${totalInvestedOpen.toFixed(2)}`);
        if (openIssues.length > 0) {
            console.log(`   ⚠️ Trovate ${openIssues.length} anomalie nelle posizioni aperte:`);
            openIssues.forEach(issue => {
                console.log(`      - ${issue.symbol} (${issue.ticket_id}): ${issue.issue}`);
            });
        }
        console.log('');
        
        // 3. Analizza posizioni chiuse
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 50");
        console.log(`📊 Posizioni chiuse (ultime 50): ${closedPositions.length}`);
        
        let totalInvestedClosed = 0;
        let totalReturnedClosed = 0;
        let totalPnLClosed = 0;
        const closedIssues = [];
        
        for (const pos of closedPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const closePrice = parseFloat(pos.current_price) || 0;
            const pnl = parseFloat(pos.profit_loss) || 0;
            
            const invested = volume * entryPrice;
            const returned = volume * closePrice;
            
            totalInvestedClosed += invested;
            totalReturnedClosed += returned;
            totalPnLClosed += pnl;
            
            // Verifica anomalie
            if (entryPrice > 0 && closePrice > 0) {
                const priceRatio = closePrice / entryPrice;
                if (priceRatio > 100 || priceRatio < 0.01) {
                    closedIssues.push({
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        issue: `entryPrice (€${entryPrice.toFixed(6)}) vs closePrice (€${closePrice.toFixed(6)}) - ratio: ${priceRatio.toFixed(2)}x`,
                        entry_price: entryPrice,
                        close_price: closePrice,
                        ratio: priceRatio,
                        pnl: pnl,
                        closed_at: pos.closed_at
                    });
                }
            }
        }
        
        console.log(`   Capitale investito (quando erano aperte): €${totalInvestedClosed.toFixed(2)}`);
        console.log(`   Capitale tornato (alla chiusura): €${totalReturnedClosed.toFixed(2)}`);
        console.log(`   P&L totale: €${totalPnLClosed.toFixed(2)}`);
        if (closedIssues.length > 0) {
            console.log(`   ⚠️ Trovate ${closedIssues.length} anomalie nelle posizioni chiuse:`);
            closedIssues.slice(0, 10).forEach(issue => {
                console.log(`      - ${issue.symbol} (${issue.ticket_id}) chiusa ${issue.closed_at}: ${issue.issue}`);
            });
        }
        console.log('');
        
        // 4. Calcolo teorico
        const totalInvested = totalInvestedOpen + totalInvestedClosed;
        const totalReturned = totalReturnedClosed;
        
        // Se assumiamo che il balance iniziale fosse X:
        // Balance finale = X - Investito + Tornato
        // X = Balance finale + Investito - Tornato
        const theoreticalInitial = currentBalance + totalInvestedOpen - totalReturnedClosed;
        const expectedBalance = theoreticalInitial - totalInvestedOpen + totalReturnedClosed;
        const difference = currentBalance - expectedBalance;
        
        console.log('📐 CALCOLO TEORICO:');
        console.log(`   Capitale iniziale teorico: €${theoreticalInitial.toFixed(2)}`);
        console.log(`   Balance atteso: €${expectedBalance.toFixed(2)}`);
        console.log(`   Balance reale: €${currentBalance.toFixed(2)}`);
        console.log(`   Differenza: €${difference.toFixed(2)}`);
        console.log(`   ${Math.abs(difference) < 0.01 ? '✅ Coerente' : '❌ INCOERENTE'}`);
        console.log('');
        
        // 5. Riepilogo problemi
        console.log('🔍 RIEPILOGO PROBLEMI:');
        if (openIssues.length > 0 || closedIssues.length > 0) {
            console.log(`   ⚠️ Trovate ${openIssues.length + closedIssues.length} anomalie nei prezzi`);
            console.log(`   → Potrebbero essere causate da conversione USDT/EUR mancante`);
        } else {
            console.log(`   ✅ Nessuna anomalia nei prezzi trovata`);
        }
        
        if (Math.abs(difference) > 0.01) {
            console.log(`   ❌ Balance incoerente: differenza di €${difference.toFixed(2)}`);
            console.log(`   → Possibili cause:`);
            console.log(`      - Prezzi in valute diverse (USDT vs EUR)`);
            console.log(`      - Doppio aggiornamento del balance`);
            console.log(`      - Errori nella conversione valuta`);
        } else {
            console.log(`   ✅ Balance coerente`);
        }
        
        // 6. Suggerimenti
        console.log('\n💡 SUGGERIMENTI:');
        if (closedIssues.length > 0) {
            console.log(`   - Correggi le ${closedIssues.length} posizioni chiuse con prezzi anomali`);
            console.log(`   - Usa endpoint: POST /api/crypto/fix-closed-positions-pnl`);
        }
        if (Math.abs(difference) > 100) {
            console.log(`   - Differenza significativa (€${difference.toFixed(2)})`);
            console.log(`   - Verifica se ci sono posizioni vecchie con entryPrice in USDT`);
            console.log(`   - Considera di resettare il balance a un valore corretto`);
        }
        
    } catch (error) {
        console.error('❌ Errore nella diagnostica:', error);
    }
}

// Esegui diagnostica
diagnoseBalance().then(() => {
    console.log('\n✅ Diagnostica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
