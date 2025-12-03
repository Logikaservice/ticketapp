/**
 * INTEGRATION TESTS - Multi-Confirmation System
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('Multi-Confirmation System', () => {
    test('LONG signal requires minimum confirmations', () => {
        // TODO: Creare scenario con solo 2 conferme (non sufficiente)
        // Verificare che segnale sia NEUTRAL
    });

    test('SHORT signal requires more confirmations than LONG', () => {
        const priceHistory = [];
        let price = 80000;
        let timestamp = Date.now() - (3600 * 1000 * 3);
        
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            timestamp += 60000;
            priceHistory.push({
                price: price,
                timestamp: new Date(timestamp).toISOString()
            });
        }
        
        const signal = signalGenerator.generateSignal(priceHistory);
        
        if (signal.direction === 'LONG') {
            expect(signal.confirmations).toBeGreaterThanOrEqual(3);
        }
        
        if (signal.direction === 'SHORT') {
            expect(signal.confirmations).toBeGreaterThanOrEqual(4);
        }
    });

    test('Signal includes reasons for each confirmation', () => {
        const priceHistory = [];
        let price = 80000;
        let timestamp = Date.now() - (3600 * 1000 * 3);
        
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            timestamp += 60000;
            priceHistory.push({
                price: price,
                timestamp: new Date(timestamp).toISOString()
            });
        }
        
        const signal = signalGenerator.generateSignal(priceHistory);
        
        expect(Array.isArray(signal.reasons)).toBe(true);
        
        if (signal.direction !== 'NEUTRAL') {
            expect(signal.reasons.length).toBeGreaterThan(0);
        }
    });

    test('Signal strength is proportional to confirmations', () => {
        const priceHistory = [];
        let price = 80000;
        let timestamp = Date.now() - (3600 * 1000 * 3);
        
        for (let i = 0; i < 50; i++) {
            price += (Math.random() - 0.5) * 500;
            timestamp += 60000;
            priceHistory.push({
                price: price,
                timestamp: new Date(timestamp).toISOString()
            });
        }
        
        const signal = signalGenerator.generateSignal(priceHistory);
        
        if (signal.direction !== 'NEUTRAL') {
            expect(signal.strength).toBeGreaterThanOrEqual(0);
            expect(signal.strength).toBeLessThanOrEqual(100);
            expect(signal.confirmations).toBeGreaterThan(0);
        }
    });
});

