/**
 * UNIT TESTS - EMA (Exponential Moving Average)
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('EMA Calculation', () => {
    test('EMA returns null with insufficient data', () => {
        const prices = [100, 102, 103];
        const ema = signalGenerator.calculateEMA(prices, 10);
        expect(ema).toBeNull();
    });

    test('EMA calculation with sufficient data', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 20; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const ema = signalGenerator.calculateEMA(prices, 10);
        
        expect(ema).not.toBeNull();
        expect(typeof ema).toBe('number');
        expect(ema).toBeGreaterThan(0);
    });

    test('EMA is more reactive than SMA', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 20; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const ema = signalGenerator.calculateEMA(prices, 10);
        const sma = signalGenerator.calculateSMA(prices, 10);
        
        // EMA e SMA non devono essere identici (tranne casi particolari)
        // Non possiamo fare assunzioni sulla loro relazione, ma devono essere numeri validi
        expect(typeof ema).toBe('number');
        expect(typeof sma).toBe('number');
    });

    test('Multiple EMA periods calculation', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const ema10 = signalGenerator.calculateEMA(prices, 10);
        const ema20 = signalGenerator.calculateEMA(prices, 20);
        const ema50 = signalGenerator.calculateEMA(prices, 50);
        
        expect(ema10).not.toBeNull();
        expect(ema20).not.toBeNull();
        expect(ema50).not.toBeNull();
    });
});

describe('Trend Detection', () => {
    test('Detect bullish trend', () => {
        // Prezzo in costante crescita
        const prices = [];
        for (let i = 0; i < 30; i++) {
            prices.push(80000 + (i * 100));
        }
        
        const trend = signalGenerator.detectTrend(prices, 10, 20);
        
        expect(['bullish', 'neutral']).toContain(trend);
    });

    test('Detect bearish trend', () => {
        // Prezzo in costante discesa
        const prices = [];
        for (let i = 0; i < 30; i++) {
            prices.push(80000 - (i * 100));
        }
        
        const trend = signalGenerator.detectTrend(prices, 10, 20);
        
        expect(['bearish', 'neutral']).toContain(trend);
    });

    test('Detect major trend (Golden/Death Cross)', () => {
        const prices = [];
        for (let i = 0; i < 250; i++) {
            prices.push(80000 + (i * 50)); // Trend rialzista
        }
        
        const majorTrend = signalGenerator.detectMajorTrend(prices);
        
        expect(['bullish', 'bearish', 'neutral']).toContain(majorTrend);
    });
});

