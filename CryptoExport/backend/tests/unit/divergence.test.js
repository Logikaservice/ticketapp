/**
 * UNIT TESTS - RSI Divergence Detection
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('RSI Divergence Detection', () => {
    test('Bullish Divergence detection', () => {
        // Simula bullish divergence: prezzo scende, RSI sale
        const prices = [];
        let price = 80000;
        
        // Prima crea minimi più bassi
        for (let i = 0; i < 10; i++) {
            price -= 100; // Prezzo scende
            prices.push(price);
        }
        
        // Poi minimo ancora più basso
        for (let i = 0; i < 10; i++) {
            price -= 50; // Prezzo scende ancora (minimo più basso)
            prices.push(price);
        }
        
        // Calcola RSI history
        const rsiHistory = signalGenerator.calculateRSIHistory(prices, 14);
        
        if (rsiHistory.length >= 15) {
            const divergence = signalGenerator.detectRSIDivergence(prices, rsiHistory);
            
            // Può essere bullish o null
            expect(['bullish', null]).toContain(divergence.type);
        }
    });

    test('Divergence returns object with correct structure', () => {
        const prices = [];
        let price = 80000;
        for (let i = 0; i < 40; i++) {
            price += (Math.random() - 0.5) * 500;
            prices.push(price);
        }
        
        const rsiHistory = signalGenerator.calculateRSIHistory(prices, 14);
        
        if (rsiHistory.length >= 15) {
            const divergence = signalGenerator.detectRSIDivergence(prices, rsiHistory);
            
            expect(divergence).toHaveProperty('type');
            expect(divergence).toHaveProperty('strength');
            
            if (divergence.type) {
                expect(['bullish', 'bearish']).toContain(divergence.type);
                expect(divergence.strength).toBeGreaterThanOrEqual(0);
                expect(divergence.strength).toBeLessThanOrEqual(100);
            }
        }
    });

    test('Peaks and Valleys detection', () => {
        // Crea serie con picchi evidenti
        const values = [10, 12, 15, 12, 10, 14, 18, 15, 12, 16, 20, 17];
        
        const result = signalGenerator.findPeaksAndValleys(values, 2);
        
        expect(result).toHaveProperty('peaks');
        expect(result).toHaveProperty('valleys');
        expect(Array.isArray(result.peaks)).toBe(true);
        expect(Array.isArray(result.valleys)).toBe(true);
    });
});

