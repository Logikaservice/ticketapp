/**
 * BACKTEST TESTS - Test su Dati Storici
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

// Helper: Genera dati storici realistici
function generateHistoricalData(startPrice, days, volatility = 0.02) {
    const data = [];
    let price = startPrice;
    let timestamp = Date.now() - (days * 24 * 60 * 60 * 1000); // giorni fa
    
    for (let i = 0; i < days * 24; i++) { // 1 punto ogni ora
        // Movimento realistico con trend
        const trend = Math.sin(i / 100) * volatility; // Trend ondulato
        const randomMove = (Math.random() - 0.5) * volatility;
        price = price * (1 + trend + randomMove);
        
        timestamp += 60 * 60 * 1000; // +1 ora
        
        data.push({
            price: price,
            timestamp: new Date(timestamp).toISOString()
        });
    }
    
    return data;
}

// Helper: Simula trading con strategia
function simulateBacktest(historicalData, initialCapital = 250, tradeSize = 50) {
    let capital = initialCapital;
    const trades = [];
    let openPosition = null;
    
    // Analizza ogni punto (ogni ora)
    for (let i = 20; i < historicalData.length; i++) {
        const currentData = historicalData.slice(0, i + 1);
        const signal = signalGenerator.generateSignal(currentData);
        const currentPrice = historicalData[i].price;
        
        // Se abbiamo posizione aperta, controlla SL/TP
        if (openPosition) {
            const pnlPct = openPosition.type === 'buy' 
                ? ((currentPrice - openPosition.entryPrice) / openPosition.entryPrice) * 100
                : ((openPosition.entryPrice - currentPrice) / openPosition.entryPrice) * 100;
            
            // Close logic semplificata (SL 2%, TP 3%)
            if (pnlPct <= -2 || pnlPct >= 3) {
                const pnl = openPosition.type === 'buy'
                    ? (currentPrice - openPosition.entryPrice) * openPosition.amount
                    : (openPosition.entryPrice - currentPrice) * openPosition.amount;
                
                capital += pnl;
                
                trades.push({
                    type: openPosition.type,
                    entryPrice: openPosition.entryPrice,
                    exitPrice: currentPrice,
                    pnl: pnl,
                    pnlPct: pnlPct
                });
                
                openPosition = null;
            }
        }
        
        // Apri nuova posizione se segnale valido e non abbiamo già una
        if (!openPosition && signal.direction !== 'NEUTRAL') {
            const amount = tradeSize / currentPrice;
            
            openPosition = {
                type: signal.direction.toLowerCase(),
                entryPrice: currentPrice,
                amount: amount,
                timestamp: historicalData[i].timestamp
            };
        }
    }
    
    // Chiudi posizione aperta alla fine
    if (openPosition) {
        const finalPrice = historicalData[historicalData.length - 1].price;
        const pnlPct = openPosition.type === 'buy'
            ? ((finalPrice - openPosition.entryPrice) / openPosition.entryPrice) * 100
            : ((openPosition.entryPrice - finalPrice) / openPosition.entryPrice) * 100;
        const pnl = openPosition.type === 'buy'
            ? (finalPrice - openPosition.entryPrice) * openPosition.amount
            : (openPosition.entryPrice - finalPrice) * openPosition.amount;
        
        capital += pnl;
        trades.push({
            type: openPosition.type,
            entryPrice: openPosition.entryPrice,
            exitPrice: finalPrice,
            pnl: pnl,
            pnlPct: pnlPct
        });
    }
    
    // Calcola metriche
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);
    
    let maxDrawdown = 0;
    let peakCapital = initialCapital;
    let currentCapital = initialCapital;
    
    // Simula drawdown
    for (const trade of trades) {
        currentCapital += trade.pnl;
        if (currentCapital > peakCapital) peakCapital = currentCapital;
        const drawdown = (peakCapital - currentCapital) / peakCapital;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return {
        initialCapital,
        finalCapital: capital,
        totalReturn: ((capital - initialCapital) / initialCapital) * 100,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: winRate,
        profitFactor: profitFactor,
        maxDrawdown: maxDrawdown,
        trades: trades
    };
}

describe('Backtest - Performance Metrics', () => {
    test('Backtest generates valid results', () => {
        const historicalData = generateHistoricalData(80000, 30); // 30 giorni
        const results = simulateBacktest(historicalData, 250, 50);
        
        expect(results).toHaveProperty('initialCapital');
        expect(results).toHaveProperty('finalCapital');
        expect(results).toHaveProperty('totalTrades');
        expect(results).toHaveProperty('winRate');
        expect(results).toHaveProperty('profitFactor');
        expect(results).toHaveProperty('maxDrawdown');
        
        expect(typeof results.winRate).toBe('number');
        expect(typeof results.profitFactor).toBe('number');
        expect(typeof results.maxDrawdown).toBe('number');
    });

    test('Backtest calculates win rate correctly', () => {
        const historicalData = generateHistoricalData(80000, 60); // 60 giorni
        const results = simulateBacktest(historicalData, 250, 50);
        
        if (results.totalTrades > 0) {
            expect(results.winRate).toBeGreaterThanOrEqual(0);
            expect(results.winRate).toBeLessThanOrEqual(1);
            
            const calculatedWinRate = results.winningTrades / results.totalTrades;
            expect(results.winRate).toBeCloseTo(calculatedWinRate, 2);
        }
    });

    test('Backtest calculates profit factor correctly', () => {
        const historicalData = generateHistoricalData(80000, 60);
        const results = simulateBacktest(historicalData, 250, 50);
        
        expect(results.profitFactor).toBeGreaterThanOrEqual(0);
        
        if (results.totalTrades > 0) {
            // Profit factor dovrebbe essere calcolato correttamente
            expect(typeof results.profitFactor).toBe('number');
        }
    });

    test('Backtest tracks max drawdown', () => {
        const historicalData = generateHistoricalData(80000, 90); // 90 giorni
        const results = simulateBacktest(historicalData, 250, 50);
        
        expect(results.maxDrawdown).toBeGreaterThanOrEqual(0);
        expect(results.maxDrawdown).toBeLessThanOrEqual(1); // Max 100% drawdown
    });
});

describe('Backtest - Strategy Validation', () => {
    test('System does not over-trade', () => {
        const historicalData = generateHistoricalData(80000, 30);
        const results = simulateBacktest(historicalData, 250, 50);
        
        // In 30 giorni, non dovremmo avere centinaia di trade
        // (sistema multi-conferma dovrebbe limitare)
        expect(results.totalTrades).toBeLessThan(100);
    });

    test('System respects multi-confirmation requirements', () => {
        // Genera dati che potrebbero generare segnali deboli
        const historicalData = [];
        let price = 80000;
        
        for (let i = 0; i < 100; i++) {
            price += (Math.random() - 0.5) * 100; // Movimenti piccoli
            historicalData.push({
                price: price,
                timestamp: new Date(Date.now() - (100 - i) * 60000).toISOString()
            });
        }
        
        let signalCount = 0;
        let neutralCount = 0;
        
        for (let i = 20; i < historicalData.length; i++) {
            const signal = signalGenerator.generateSignal(historicalData.slice(0, i + 1));
            if (signal.direction !== 'NEUTRAL') {
                signalCount++;
                // Verifica che abbia conferme sufficienti
                expect(signal.confirmations).toBeGreaterThanOrEqual(3);
            } else {
                neutralCount++;
            }
        }
        
        // Con movimenti piccoli, dovremmo avere più NEUTRAL che segnali
        expect(neutralCount).toBeGreaterThan(signalCount);
    });
});

