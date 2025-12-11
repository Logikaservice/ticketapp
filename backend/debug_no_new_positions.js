/**
 * 🔍 Debug: Perché il Bot Non Apre Nuove Posizioni?
 * 
 * Analizza tutti i controlli che bloccano l'apertura di nuove posizioni
 * quando ci sono già posizioni aperte
 */

const { dbAll, dbGet } = require('./crypto_db');
const riskManager = require('./services/RiskManager');

// Importa configurazioni
const HYBRID_STRATEGY_CONFIG = {
    MAX_POSITIONS_PER_GROUP: 10,
    MAX_TOTAL_POSITIONS: 30,
    getMaxPositionsForWinRate: (winRate) => {
        if (winRate >= 0.90) return 30;
        if (winRate >= 0.80) return 25;
        if (winRate >= 0.70) return 20;
        return 15;
    }
};

const CORRELATION_GROUPS = {
    'BTC_MAJOR': ['bitcoin', 'bitcoin_usdt', 'ethereum', 'ethereum_usdt', 'solana', 'solana_eur', 'cardano', 'cardano_usdt', 'polkadot', 'polkadot_usdt'],
    'DEFI': ['chainlink', 'chainlink_usdt', 'uniswap', 'uniswap_eur', 'avalanche', 'avalanche_eur', 'aave', 'crv', 'ldo', 'mkr', 'comp', 'snx'],
    'LAYER1_ALT': ['near', 'near_eur', 'atom', 'atom_eur', 'sui', 'sui_eur', 'apt', 'sei', 'ton', 'inj', 'algo', 'vet', 'icp'],
    'PAYMENTS': ['trx', 'trx_eur', 'xlm', 'xlm_eur'],
    'LAYER2': ['arb', 'arb_eur', 'op', 'op_eur', 'matic', 'matic_eur'],
    'GAMING': ['sand', 'mana', 'axs', 'imx', 'gala', 'enj', 'enj_eur'],
    'STORAGE': ['fil', 'ar'],
    'MEME': ['dogecoin', 'dogecoin_eur', 'shiba', 'shiba_eur', 'pepe', 'pepe_eur', 'floki', 'bonk'],
    'AI_DATA': ['fet', 'render', 'grt'],
    'STABLECOINS': ['usdc'],
    'INDEPENDENT': ['ripple', 'ripple_eur', 'litecoin', 'litecoin_usdt', 'binance_coin', 'binance_coin_eur', 'pol_polygon', 'pol_polygon_eur']
};

function getCorrelationGroup(symbol) {
    for (const [group, symbols] of Object.entries(CORRELATION_GROUPS)) {
        if (symbols.includes(symbol)) {
            return group;
        }
    }
    return null;
}

async function debugNoNewPositions() {
    console.log('🔍 DEBUG: Perché il Bot Non Apre Nuove Posizioni?');
    console.log('='.repeat(100));
    console.log('');

    try {
        // 1. Verifica posizioni aperte
        console.log('1️⃣ POSIZIONI APERTE');
        console.log('-'.repeat(100));
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        
        console.log(`   Posizioni aperte totali: ${allOpenPositions.length}`);
        
        if (allOpenPositions.length === 0) {
            console.log('   ✅ Nessuna posizione aperta - il bot dovrebbe poter aprire nuove posizioni');
            console.log('   💡 Se il bot non apre, il problema è altrove (strength, conferme, filtri, ecc.)');
            return;
        }
        
        // Raggruppa per simbolo
        const positionsBySymbol = {};
        allOpenPositions.forEach(pos => {
            if (!positionsBySymbol[pos.symbol]) {
                positionsBySymbol[pos.symbol] = [];
            }
            positionsBySymbol[pos.symbol].push(pos);
        });
        
        console.log(`   Simboli con posizioni aperte: ${Object.keys(positionsBySymbol).length}`);
        Object.keys(positionsBySymbol).forEach(symbol => {
            console.log(`      - ${symbol}: ${positionsBySymbol[symbol].length} posizione/i`);
        });
        console.log('');

        // 2. Verifica limiti Hybrid Strategy
        console.log('2️⃣ LIMITI HYBRID STRATEGY');
        console.log('-'.repeat(100));
        
        // Calcola max posizioni basato su win rate
        let maxTotalPositions = HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS;
        try {
            const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
            if (stats && stats.total_trades >= 10) {
                const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
                maxTotalPositions = HYBRID_STRATEGY_CONFIG.getMaxPositionsForWinRate(winRate);
                console.log(`   Win rate: ${(winRate * 100).toFixed(1)}% → Max posizioni: ${maxTotalPositions}`);
            } else {
                console.log(`   Statistiche insufficienti (<10 trade) → Max posizioni default: ${maxTotalPositions}`);
            }
        } catch (e) {
            console.log(`   Errore lettura stats → Max posizioni default: ${maxTotalPositions}`);
        }
        
        console.log(`   Posizioni attuali: ${allOpenPositions.length}`);
        console.log(`   Limite totale: ${maxTotalPositions}`);
        
        if (allOpenPositions.length >= maxTotalPositions) {
            console.log(`   ❌ LIMITE TOTALE RAGGIUNTO: ${allOpenPositions.length} >= ${maxTotalPositions}`);
            console.log(`   💡 Il bot può aprire nuove posizioni solo se chiude posizioni esistenti (Smart Replacement)`);
            console.log(`   💡 Oppure aumenta MAX_TOTAL_POSITIONS in HYBRID_STRATEGY_CONFIG`);
        } else {
            console.log(`   ✅ Limite totale OK: ${allOpenPositions.length} < ${maxTotalPositions}`);
        }
        console.log('');

        // 3. Verifica limiti per gruppo
        console.log('3️⃣ LIMITI PER GRUPPO DI CORRELAZIONE');
        console.log('-'.repeat(100));
        
        const MAX_PER_GROUP = HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP;
        console.log(`   Limite per gruppo: ${MAX_PER_GROUP}`);
        console.log('');
        
        const groupsWithPositions = {};
        allOpenPositions.forEach(pos => {
            const group = getCorrelationGroup(pos.symbol);
            if (group) {
                if (!groupsWithPositions[group]) {
                    groupsWithPositions[group] = [];
                }
                groupsWithPositions[group].push(pos);
            }
        });
        
        Object.keys(groupsWithPositions).forEach(group => {
            const count = groupsWithPositions[group].length;
            const symbols = [...new Set(groupsWithPositions[group].map(p => p.symbol))];
            console.log(`   ${group}: ${count} posizioni (${symbols.join(', ')})`);
            if (count >= MAX_PER_GROUP) {
                console.log(`      ❌ LIMITE GRUPPO RAGGIUNTO: ${count} >= ${MAX_PER_GROUP}`);
                console.log(`      💡 Il bot NON può aprire nuove posizioni per simboli in questo gruppo`);
            } else {
                console.log(`      ✅ Limite gruppo OK: ${count} < ${MAX_PER_GROUP}`);
            }
        });
        console.log('');

        // 4. Verifica Risk Manager
        console.log('4️⃣ RISK MANAGER');
        console.log('-'.repeat(100));
        
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const cashBalance = parseFloat(portfolio?.balance_usd || 0);
        
        // Calcola totalEquity
        let currentExposureValue = 0;
        for (const pos of allOpenPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            const remaining = vol - volClosed;
            const entry = parseFloat(pos.entry_price) || 0;
            currentExposureValue += remaining * entry;
        }
        const totalEquity = cashBalance + currentExposureValue;
        
        console.log(`   Cash Balance: $${cashBalance.toFixed(2)} USDT`);
        console.log(`   Current Exposure: $${currentExposureValue.toFixed(2)} USDT`);
        console.log(`   Total Equity: $${totalEquity.toFixed(2)} USDT`);
        
        const riskCheck = await riskManager.calculateMaxRisk();
        console.log(`   Trading Permesso: ${riskCheck.canTrade ? '✅ SÌ' : '❌ NO'}`);
        if (!riskCheck.canTrade) {
            console.log(`   ❌ Motivo blocco: ${riskCheck.reason}`);
        }
        console.log(`   Daily Loss: ${(riskCheck.dailyLoss * 100).toFixed(2)}% (max 5%)`);
        console.log(`   Current Exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% (max 40%)`);
        console.log(`   Available Exposure: $${riskCheck.availableExposure?.toFixed(2) || 0} USDT`);
        console.log(`   Max Position Size: $${riskCheck.maxPositionSize?.toFixed(2) || 0} USDT`);
        
        if (riskCheck.availableExposure < 80) {
            console.log(`   ⚠️ Exposure disponibile < $80 USDT - potrebbe bloccare nuove posizioni`);
        }
        console.log('');

        // 5. Verifica Portfolio Drawdown Protection
        console.log('5️⃣ PORTFOLIO DRAWDOWN PROTECTION');
        console.log('-'.repeat(100));
        
        const initialBalance = 1000;
        const portfolioPnLPct = totalEquity > 0 ? ((totalEquity - initialBalance) / initialBalance) * 100 : -100;
        
        let avgOpenPnL = 0;
        if (allOpenPositions.length > 0) {
            const totalOpenPnL = allOpenPositions.reduce((sum, p) => sum + (parseFloat(p.profit_loss_pct) || 0), 0);
            avgOpenPnL = totalOpenPnL / allOpenPositions.length;
        }
        
        console.log(`   P&L Portfolio: ${portfolioPnLPct.toFixed(2)}%`);
        console.log(`   P&L Medio Aperte: ${avgOpenPnL.toFixed(2)}%`);
        
        if (portfolioPnLPct < -5.0) {
            console.log(`   ❌ BLOCCO: Portfolio drawdown troppo alto (${portfolioPnLPct.toFixed(2)}% < -5%)`);
        } else if (avgOpenPnL < -2.0 && allOpenPositions.length >= 5) {
            console.log(`   ❌ BLOCCO: P&L medio posizioni aperte troppo negativo (${avgOpenPnL.toFixed(2)}% < -2%)`);
        } else {
            console.log(`   ✅ Portfolio Drawdown Protection: OK`);
        }
        console.log('');

        // 6. Verifica simboli con segnali forti ma non aperti
        console.log('6️⃣ SIMBOLI CON SEGNALI FORTI MA NON APERTI');
        console.log('-'.repeat(100));
        
        const allSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1 AND is_active = 1",
            ['RSI_Strategy']
        );
        
        console.log(`   Simboli attivi totali: ${allSymbols.length}`);
        console.log(`   Simboli con posizioni aperte: ${Object.keys(positionsBySymbol).length}`);
        console.log(`   Simboli senza posizioni: ${allSymbols.length - Object.keys(positionsBySymbol).length}`);
        console.log('');
        console.log('   💡 Per verificare perché un simbolo specifico non apre, usa:');
        console.log('      node debug_why_not_opening.js <simbolo>');
        console.log('');

        // 7. Riepilogo
        console.log('='.repeat(100));
        console.log('📊 RIEPILOGO');
        console.log('='.repeat(100));
        console.log('');
        
        const blockers = [];
        
        if (allOpenPositions.length >= maxTotalPositions) {
            blockers.push(`Limite totale posizioni raggiunto (${allOpenPositions.length}/${maxTotalPositions})`);
        }
        
        Object.keys(groupsWithPositions).forEach(group => {
            if (groupsWithPositions[group].length >= MAX_PER_GROUP) {
                blockers.push(`Limite gruppo ${group} raggiunto (${groupsWithPositions[group].length}/${MAX_PER_GROUP})`);
            }
        });
        
        if (!riskCheck.canTrade) {
            blockers.push(`Risk Manager blocca: ${riskCheck.reason}`);
        }
        
        if (riskCheck.availableExposure < 80) {
            blockers.push(`Exposure disponibile insufficiente ($${riskCheck.availableExposure.toFixed(2)} < $80)`);
        }
        
        if (portfolioPnLPct < -5.0) {
            blockers.push(`Portfolio drawdown troppo alto (${portfolioPnLPct.toFixed(2)}%)`);
        }
        
        if (avgOpenPnL < -2.0 && allOpenPositions.length >= 5) {
            blockers.push(`P&L medio posizioni aperte troppo negativo (${avgOpenPnL.toFixed(2)}%)`);
        }
        
        if (blockers.length === 0) {
            console.log('✅ NESSUN BLOCCO TROVATO');
            console.log('   Il bot dovrebbe poter aprire nuove posizioni se:');
            console.log('   - Strength >= 65 (o valore configurato)');
            console.log('   - Conferme sufficienti');
            console.log('   - Professional filters OK');
            console.log('   - ATR nel range');
            console.log('');
            console.log('   💡 Verifica i log del bot per vedere perché specifici simboli non aprono');
        } else {
            console.log('❌ BLOCCHI TROVATI:');
            blockers.forEach((blocker, index) => {
                console.log(`   ${index + 1}. ${blocker}`);
            });
            console.log('');
            console.log('💡 SOLUZIONI:');
            if (allOpenPositions.length >= maxTotalPositions) {
                console.log('   - Chiudi posizioni in perdita o con P&L negativo');
                console.log('   - Oppure aumenta MAX_TOTAL_POSITIONS in HYBRID_STRATEGY_CONFIG');
            }
            if (!riskCheck.canTrade) {
                console.log('   - Attendi che il Risk Manager permetta trading');
                console.log('   - Verifica daily loss e exposure');
            }
            if (riskCheck.availableExposure < 80) {
                console.log('   - Aggiungi fondi al portfolio');
                console.log('   - Oppure chiudi posizioni per liberare exposure');
            }
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante debug:', error.message);
        console.error(error.stack);
    }
}

debugNoNewPositions().catch(console.error);

