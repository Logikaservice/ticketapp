/**
 * UNIT TESTS - Bollinger Bands
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('Bollinger Bands Calculation', () => {
    test('Bollinger Bands returns null with insufficient data', () => {
        const prices = Array(10).fill(80000);
        const bands = signalGenerator.calculateBollingerBands(prices, 20, 2);
        expect(bands).toBeNull();
    });

    test('Bollinger Bands calculation with sufficient data', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 30; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const bands = signalGenerator.calculateBollingerBands(prices, 20, 2);
        
        expect(bands).not.toBeNull();
        expect(bands).toHaveProperty('upper');
        expect(bands).toHaveProperty('middle');
        expect(bands).toHaveProperty('lower');
        expect(bands).toHaveProperty('width');
        expect(bands).toHaveProperty('percentB');
    });

    test('Bollinger Bands structure: upper > middle > lower', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 30; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const bands = signalGenerator.calculateBollingerBands(prices, 20, 2);
        
        expect(bands.upper).toBeGreaterThan(bands.middle);
        expect(bands.middle).toBeGreaterThan(bands.lower);
    });

    test('Percent B is valid (can be negative if price below lower band)', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 30; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const bands = signalGenerator.calculateBollingerBands(prices, 20, 2);
        
        // %B può essere negativo (prezzo sotto lower band) o >1 (prezzo sopra upper band)
        // Valori tipici: -0.5 a 1.5
        expect(bands.percentB).toBeGreaterThan(-2); // Permette valori negativi validi
        expect(bands.percentB).toBeLessThan(2); // Permette overflow per prezzo molto alto
        expect(typeof bands.percentB).toBe('number');
    });
});

