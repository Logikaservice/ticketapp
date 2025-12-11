/**
 * 🔍 Debug: Perché il Bot Si Ferma a 2 Posizioni?
 * 
 * Verifica specificamente perché dopo 2 posizioni il bot non apre più
 */

const { dbAll, dbGet } = require('./crypto_db');
const riskManager = require('./services/RiskManager');

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

async function debugWhyStopsAt2() {
    console.log('🔍 DEBUG: Perché il Bot Si Ferma a 2 Posizioni?');
    console.log('='.repeat(100));
    console.log('');

    try {
        // 1. Verifica posizioni aperte
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        
        console.log(`📊 Posizioni aperte: ${allOpenPositions.length}`);
        allOpenPositions.forEach((pos, idx) => {
            console.log(`   ${idx + 1}. ${pos.symbol} (${pos.type}) - Entry: $${parseFloat(pos.entry_price || 0).toFixed(2)} | Volume: ${parseFloat(pos.volume || 0).toFixed(6)}`);
        });
        console.log('');

        // 2. Verifica limite totale
        let maxTotalPositions = HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS;
        try {
            const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
            if (stats && stats.total_trades >= 10) {
                const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
                maxTotalPositions = HYBRID_STRATEGY_CONFIG.getMaxPositionsForWinRate(winRate);
                console.log(`📊 Win rate: ${(winRate * 100).toFixed(1)}% → Max posizioni: ${maxTotalPositions}`);
            } else {
                console.log(`📊 Statistiche insufficienti (<10 trade) → Max posizioni default: ${maxTotalPositions}`);
                console.log(`   Total trades: ${stats?.total_trades || 0}`);
            }
        } catch (e) {
            console.log(`📊 Errore lettura stats → Max posizioni default: ${maxTotalPositions}`);
        }
        
        console.log(`   Posizioni attuali: ${allOpenPositions.length}`);
        console.log(`   Limite totale: ${maxTotalPositions}`);
        
        if (allOpenPositions.length >= maxTotalPositions) {
            console.log(`   ❌ LIMITE TOTALE RAGGIUNTO: ${allOpenPositions.length} >= ${maxTotalPositions}`);
        } else {
            console.log(`   ✅ Limite totale OK: ${allOpenPositions.length} < ${maxTotalPositions}`);
        }
        console.log('');

        // 3. Verifica Risk Manager
        console.log('3️⃣ RISK MANAGER');
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
            const current = parseFloat(pos.current_price) || entry;
            currentExposureValue += remaining * current;
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
        
        if (riskCheck.availableExposure < 10) {
            console.log(`   ❌ Exposure disponibile < $10 USDT - BLOCCA nuove posizioni`);
        } else if (riskCheck.availableExposure < 50) {
            console.log(`   ⚠️ Exposure disponibile < $50 USDT - potrebbe limitare nuove posizioni`);
        } else {
            console.log(`   ✅ Exposure disponibile sufficiente`);
        }
        console.log('');

        // 4. Verifica Portfolio Drawdown Protection
        console.log('4️⃣ PORTFOLIO DRAWDOWN PROTECTION');
        console.log('-'.repeat(100));
        
        const initialBalance = 1000; // Default dopo reset
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

        // 5. Verifica se c'è un limite hardcoded a 2
        console.log('5️⃣ VERIFICA LIMITI HARDCODED');
        console.log('-'.repeat(100));
        console.log(`   MAX_TOTAL_POSITIONS config: ${HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS}`);
        console.log(`   MAX_POSITIONS_PER_GROUP config: ${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP}`);
        console.log(`   Posizioni attuali: ${allOpenPositions.length}`);
        
        if (allOpenPositions.length === 2) {
            console.log(`   ⚠️ ATTENZIONE: Esattamente 2 posizioni - potrebbe essere un limite hardcoded`);
            console.log(`   💡 Verifica se c'è un controllo specifico per 2 posizioni nel codice`);
        }
        console.log('');

        // 6. Riepilogo
        console.log('='.repeat(100));
        console.log('📊 RIEPILOGO');
        console.log('='.repeat(100));
        console.log('');
        
        const blockers = [];
        
        if (allOpenPositions.length >= maxTotalPositions) {
            blockers.push(`Limite totale posizioni raggiunto (${allOpenPositions.length}/${maxTotalPositions})`);
        }
        
        if (!riskCheck.canTrade) {
            blockers.push(`Risk Manager blocca: ${riskCheck.reason}`);
        }
        
        if (riskCheck.availableExposure < 10) {
            blockers.push(`Exposure disponibile insufficiente ($${riskCheck.availableExposure.toFixed(2)} < $10)`);
        }
        
        if (portfolioPnLPct < -5.0) {
            blockers.push(`Portfolio drawdown troppo alto (${portfolioPnLPct.toFixed(2)}%)`);
        }
        
        if (blockers.length === 0) {
            console.log('✅ NESSUN BLOCCO TROVATO');
            console.log('   Il bot dovrebbe poter aprire più di 2 posizioni.');
            console.log('   Possibili cause:');
            console.log('   - Nessun segnale forte disponibile');
            console.log('   - Professional filters bloccano');
            console.log('   - ATR fuori range');
            console.log('   - Cooldown attivo');
            console.log('');
            console.log('   💡 Verifica i log del bot per vedere perché specifici simboli non aprono');
        } else {
            console.log('❌ BLOCCHI TROVATI:');
            blockers.forEach((blocker, index) => {
                console.log(`   ${index + 1}. ${blocker}`);
            });
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante debug:', error.message);
        console.error(error.stack);
    }
}

debugWhyStopsAt2().catch(console.error);

