/**
 * Test del RiskManager per verificare se il fix funziona
 */

const riskManager = require('./backend/services/RiskManager');
const { dbGet, dbAll } = require('./backend/crypto_db');

async function testRiskManager() {
    console.log('🧪 TEST RISK MANAGER FIX\n');
    console.log('='.repeat(60));
    
    try {
        // Verifica posizioni aperte
        const openPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        
        console.log(`\n📊 Posizioni aperte: ${openPositions.length}\n`);
        
        openPositions.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.symbol} | ${pos.type.toUpperCase()}`);
            console.log(`   Entry price: $${parseFloat(pos.entry_price || 0).toFixed(6)}`);
            console.log(`   Current price: $${parseFloat(pos.current_price || 0).toFixed(6)}`);
            console.log(`   Volume: ${parseFloat(pos.volume || 0).toFixed(4)}`);
            const entryValue = parseFloat(pos.volume || 0) * parseFloat(pos.entry_price || 0);
            const currentValue = parseFloat(pos.volume || 0) * (parseFloat(pos.current_price || pos.entry_price || 0));
            console.log(`   Valore entry: $${entryValue.toFixed(2)}`);
            console.log(`   Valore attuale: $${currentValue.toFixed(2)}`);
            console.log('');
        });
        
        // Test RiskManager
        console.log('\n💰 RISK MANAGER CALCULATION\n');
        console.log('-'.repeat(60));
        
        const riskCheck = await riskManager.calculateMaxRisk();
        
        console.log(`Can Trade: ${riskCheck.canTrade ? '✅ SÌ' : '❌ NO'}`);
        console.log(`Reason: ${riskCheck.reason}`);
        console.log(`\nMax Position Size: $${riskCheck.maxPositionSize?.toFixed(2) || 0}`);
        console.log(`Available Exposure: $${riskCheck.availableExposure?.toFixed(2) || 0}`);
        console.log(`Current Exposure: ${((riskCheck.currentExposure || 0) * 100).toFixed(2)}%`);
        console.log(`Daily Loss: ${((riskCheck.dailyLoss || 0) * 100).toFixed(2)}%`);
        console.log(`Drawdown: ${((riskCheck.drawdown || 0) * 100).toFixed(2)}%`);
        
        // Calcolo manuale per verifica
        console.log('\n🔍 CALCOLO MANUALE PER VERIFICA\n');
        console.log('-'.repeat(60));
        
        const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
        const cashBalance = parseFloat(portfolio?.balance_usd || 0);
        
        let totalExposure = 0;
        let totalEquityFromPos = 0;
        
        for (const pos of openPositions) {
            const volume = parseFloat(pos.volume || 0);
            const entryPrice = parseFloat(pos.entry_price || 0);
            const currentPrice = parseFloat(pos.current_price || entryPrice);
            
            if (pos.type === 'buy') {
                const positionValue = volume * currentPrice;
                totalExposure += positionValue;
                totalEquityFromPos += positionValue;
                console.log(`${pos.symbol} LONG: $${positionValue.toFixed(2)} (${volume.toFixed(4)} × $${currentPrice.toFixed(6)})`);
            } else {
                const shortLiability = volume * entryPrice;
                totalExposure += shortLiability;
                totalEquityFromPos -= shortLiability;
                console.log(`${pos.symbol} SHORT: -$${shortLiability.toFixed(2)} (debito fisso)`);
            }
        }
        
        const totalEquity = cashBalance + totalEquityFromPos;
        const exposurePct = totalEquity > 0 ? (totalExposure / totalEquity) * 100 : 0;
        
        console.log(`\nCash Balance: $${cashBalance.toFixed(2)}`);
        console.log(`Total Equity from Positions: $${totalEquityFromPos.toFixed(2)}`);
        console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
        console.log(`Total Exposure: $${totalExposure.toFixed(2)}`);
        console.log(`Exposure %: ${exposurePct.toFixed(2)}%`);
        
        if (exposurePct >= 80) {
            console.log(`\n❌ BLOCCO: Exposure ${exposurePct.toFixed(2)}% >= 80%`);
        } else {
            console.log(`\n✅ OK: Exposure ${exposurePct.toFixed(2)}% < 80%`);
        }
        
    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
    }
}

testRiskManager().then(() => {
    console.log('\n✅ Test completato');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});

