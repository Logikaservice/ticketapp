/**
 * UNIT TESTS - MACD (Moving Average Convergence Divergence)
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('MACD Calculation', () => {
    test('MACD returns null with insufficient data', () => {
        const prices = Array(20).fill(80000);
        const macd = signalGenerator.calculateMACD(prices, 12, 26, 9);
        expect(macd).toBeNull();
    });

    test('MACD calculation with sufficient data', () => {
        // Genera serie di prezzi sufficientemente lunga
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const macd = signalGenerator.calculateMACD(prices, 12, 26, 9);
        
        expect(macd).not.toBeNull();
        expect(macd).toHaveProperty('macdLine');
        expect(macd).toHaveProperty('signalLine');
        expect(macd).toHaveProperty('histogram');
        expect(macd).toHaveProperty('macdAboveSignal');
        expect(macd).toHaveProperty('macdAboveZero');
    });

    test('MACD structure is correct', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const macd = signalGenerator.calculateMACD(prices);
        
        expect(typeof macd.macdLine).toBe('number');
        expect(typeof macd.signalLine).toBe('number');
        expect(typeof macd.histogram).toBe('number');
        expect(typeof macd.macdAboveSignal).toBe('boolean');
        expect(typeof macd.macdAboveZero).toBe('boolean');
    });

    test('Histogram equals MACD - Signal', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const macd = signalGenerator.calculateMACD(prices);
        
        const expectedHistogram = macd.macdLine - macd.signalLine;
        expect(macd.histogram).toBeCloseTo(expectedHistogram, 2);
    });
});

