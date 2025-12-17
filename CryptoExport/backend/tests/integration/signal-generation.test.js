/**
 * INTEGRATION TESTS - Signal Generation Logic
 */

const signalGenerator = require('../../services/BidirectionalSignalGenerator');

describe('Signal Generation - SHORT Blocking', () => {
    test('SHORT signal blocked when price is rising', () => {
        // Crea dati con prezzo in costante crescita
        const priceHistory = [];
        let price = 80000;
        let timestamp = Date.now() - (3600 * 1000 * 3); // 3 ore fa
        
        for (let i = 0; i < 30; i++) {
            price += 100; // Prezzo sale costantemente
            timestamp += 60000; // +1 minuto
            priceHistory.push({
                price: price,
                timestamp: new Date(timestamp).toISOString()
            });
        }
        
        const signal = signalGenerator.generateSignal(priceHistory);
        
        // Anche con RSI alto, SHORT NON deve essere generato se prezzo sale
        expect(signal.direction).not.toBe('SHORT');
        
        if (signal.direction === 'NEUTRAL') {
            // Dovrebbe contenere motivo del blocco
            const reasons = signal.reasons.join(' ').toLowerCase();
            expect(reasons).toMatch(/rising|salendo|blocked/);
        }
    });

    test('Signal returns NEUTRAL with insufficient data', () => {
        const priceHistory = Array(5).fill({ price: 80000, timestamp: new Date().toISOString() });
        
        const signal = signalGenerator.generateSignal(priceHistory);
        
        expect(signal.direction).toBe('NEUTRAL');
        expect(signal.reasons).toContain('Insufficient data');
    });
});

describe('Signal Generation - Multi-Confirmation System', () => {
    test('Signal includes confirmations count', () => {
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
        
        // Ogni segnale dovrebbe avere un contatore di conferme
        if (signal.direction !== 'NEUTRAL') {
            expect(signal).toHaveProperty('confirmations');
            expect(typeof signal.confirmations).toBe('number');
            expect(signal.confirmations).toBeGreaterThanOrEqual(0);
        }
    });

    test('LONG signal requires minimum 3 confirmations', () => {
        // TODO: Creare dati che generano segnale LONG debole
        // e verificare che non venga generato
    });

    test('SHORT signal requires minimum 4 confirmations', () => {
        // TODO: Creare dati che generano segnale SHORT debole
        // e verificare che non venga generato
    });
});

describe('Signal Generation - Indicators Included', () => {
    test('Signal includes all calculated indicators', () => {
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
        
        // Verifica che tutti gli indicatori siano presenti
        expect(signal).toHaveProperty('indicators');
        expect(signal.indicators).toHaveProperty('rsi');
        expect(signal.indicators).toHaveProperty('trend');
        expect(signal.indicators).toHaveProperty('macd');
        expect(signal.indicators).toHaveProperty('bollinger');
        expect(signal.indicators).toHaveProperty('ema10');
        expect(signal.indicators).toHaveProperty('ema20');
    });
});

