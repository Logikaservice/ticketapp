/**
 * UNIT TESTS - RSI (Relative Strength Index)
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('RSI Calculation', () => {
    test('RSI returns null with insufficient data', () => {
        const prices = [100, 102];
        const rsi = signalGenerator.calculateRSI(prices, 14);
        expect(rsi).toBeNull();
    });

    test('RSI calculation with known data', () => {
        // Dati di test: serie di prezzi con guadagni e perdite
        const prices = [
            100, 102, 101, 103, 105, 104, 106,
            107, 106, 108, 110, 109, 111, 112,
            110, 113, 115, 114, 116, 118
        ];
        
        const rsi = signalGenerator.calculateRSI(prices, 14);
        
        // RSI dovrebbe essere un numero tra 0 e 100
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
        expect(typeof rsi).toBe('number');
    });

    test('RSI handles all gains (should be 100)', () => {
        const prices = [];
        let price = 100;
        for (let i = 0; i < 20; i++) {
            price += 1; // Solo guadagni
            prices.push(price);
        }
        
        const rsi = signalGenerator.calculateRSI(prices, 14);
        expect(rsi).toBe(100);
    });

    test('RSI calculation produces consistent results', () => {
        const prices = [
            80000, 80100, 80050, 80200, 80300, 80250, 80400,
            80500, 80400, 80600, 80800, 80700, 80900, 81000,
            80800, 81100, 81300, 81200, 81400, 81600
        ];
        
        const rsi1 = signalGenerator.calculateRSI(prices, 14);
        const rsi2 = signalGenerator.calculateRSI(prices, 14);
        
        // Dovrebbe essere consistente
        expect(rsi1).toBe(rsi2);
    });
});

describe('RSI History Calculation', () => {
    test('RSI History returns array', () => {
        const prices = [];
        for (let i = 0; i < 30; i++) {
            prices.push(80000 + (Math.random() * 1000));
        }
        
        const rsiHistory = signalGenerator.calculateRSIHistory(prices, 14);
        
        expect(Array.isArray(rsiHistory)).toBe(true);
        expect(rsiHistory.length).toBeGreaterThan(0);
    });

    test('RSI History with insufficient data returns empty array', () => {
        const prices = [100, 102, 103];
        const rsiHistory = signalGenerator.calculateRSIHistory(prices, 14);
        
        expect(rsiHistory.length).toBe(0);
    });
});

