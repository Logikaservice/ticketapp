/**
 * Script per testare i parametri RSI configurati nel database
 * e verificare che vengano correttamente utilizzati dal signalGenerator
 */

const { Pool } = require('pg');
const signalGenerator = require('../services/BidirectionalSignalGenerator');

// Configurazione database
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ticketapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

// Funzione per recuperare parametri bot (stessa logica di cryptoRoutes.js)
const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70
};

const getBotParameters = async (symbol = 'bitcoin') => {
    try {
        // Usa la stessa query di cryptoRoutes.js
        const result = await pool.query(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1 LIMIT 1",
            [symbol]
        );
        
        if (result.rows.length > 0 && result.rows[0].parameters) {
            const params = typeof result.rows[0].parameters === 'string' 
                ? JSON.parse(result.rows[0].parameters) 
                : result.rows[0].parameters;
            return { ...DEFAULT_PARAMS, ...params };
        }
    } catch (error) {
        console.error('Errore recupero parametri:', error.message);
    }
    return DEFAULT_PARAMS;
};

// Test con dati di esempio
const testRSIParams = async () => {
    console.log('🧪 TEST PARAMETRI RSI');
    console.log('='.repeat(50));
    
    try {
        // 1. Recupera parametri dal database per bitcoin
        console.log('\n📊 1. Recupero parametri dal database...');
        const params = await getBotParameters('bitcoin');
        console.log('   Parametri configurati:');
        console.log(`   - rsi_period: ${params.rsi_period}`);
        console.log(`   - rsi_oversold: ${params.rsi_oversold}`);
        console.log(`   - rsi_overbought: ${params.rsi_overbought}`);
        
        // 2. Crea dati di test (simula price history)
        console.log('\n📈 2. Creazione dati di test...');
        const testPrices = [];
        let basePrice = 50000;
        for (let i = 0; i < 100; i++) {
            // Simula movimento di prezzo con RSI variabile
            const variation = (Math.random() - 0.5) * 0.02; // ±1% variazione
            basePrice = basePrice * (1 + variation);
            testPrices.push({
                price: basePrice,
                close: basePrice,
                high: basePrice * 1.01,
                low: basePrice * 0.99,
                timestamp: new Date(Date.now() - (100 - i) * 15 * 60 * 1000).toISOString()
            });
        }
        console.log(`   Creati ${testPrices.length} punti di prezzo`);
        
        // 3. Test senza parametri (usa default hardcoded - vecchio comportamento)
        console.log('\n🔴 3. Test SENZA parametri RSI (vecchio comportamento - hardcoded):');
        const signalOld = signalGenerator.generateSignal(testPrices, 'bitcoin');
        console.log(`   Direction: ${signalOld.direction}`);
        console.log(`   Strength: ${signalOld.strength}`);
        if (signalOld.indicators && signalOld.indicators.rsi) {
            console.log(`   RSI calcolato: ${signalOld.indicators.rsi.toFixed(2)}`);
        }
        
        // 4. Test CON parametri (nuovo comportamento)
        console.log('\n🟢 4. Test CON parametri RSI configurati (nuovo comportamento):');
        const signalNew = signalGenerator.generateSignal(testPrices, 'bitcoin', {
            rsi_period: params.rsi_period,
            rsi_oversold: params.rsi_oversold,
            rsi_overbought: params.rsi_overbought
        });
        console.log(`   Direction: ${signalNew.direction}`);
        console.log(`   Strength: ${signalNew.strength}`);
        if (signalNew.indicators && signalNew.indicators.rsi) {
            console.log(`   RSI calcolato: ${signalNew.indicators.rsi.toFixed(2)}`);
            console.log(`   RSI Period usato: ${params.rsi_period}`);
            console.log(`   Soglia Oversold: ${params.rsi_oversold} (RSI < ${params.rsi_oversold} = LONG signal)`);
            console.log(`   Soglia Overbought: ${params.rsi_overbought} (RSI > ${params.rsi_overbought} = SHORT signal)`);
        }
        
        // 5. Verifica differenze
        console.log('\n📊 5. Confronto risultati:');
        if (signalOld.direction !== signalNew.direction) {
            console.log(`   ⚠️  DIREZIONE DIVERSA: Vecchio=${signalOld.direction}, Nuovo=${signalNew.direction}`);
        } else {
            console.log(`   ✅ Direzione identica: ${signalNew.direction}`);
        }
        if (Math.abs(signalOld.strength - signalNew.strength) > 5) {
            console.log(`   ⚠️  FORZA DIVERSA: Vecchio=${signalOld.strength}, Nuovo=${signalNew.strength}`);
        } else {
            console.log(`   ✅ Forza simile: ${signalNew.strength}`);
        }
        
        // 6. Test con RSI estremi per verificare soglie
        console.log('\n🎯 6. Test soglie RSI:');
        console.log(`   Se RSI < ${params.rsi_oversold}: dovrebbe generare segnale LONG`);
        console.log(`   Se RSI > ${params.rsi_overbought}: dovrebbe generare segnale SHORT`);
        
        // Simula RSI oversold
        const oversoldPrices = [];
        let oversoldPrice = 50000;
        for (let i = 0; i < 50; i++) {
            oversoldPrice = oversoldPrice * 0.98; // Calo costante
            oversoldPrices.push({
                price: oversoldPrice,
                close: oversoldPrice,
                high: oversoldPrice * 1.01,
                low: oversoldPrice * 0.99,
                timestamp: new Date(Date.now() - (50 - i) * 15 * 60 * 1000).toISOString()
            });
        }
        const oversoldSignal = signalGenerator.generateSignal(oversoldPrices, 'bitcoin', {
            rsi_period: params.rsi_period,
            rsi_oversold: params.rsi_oversold,
            rsi_overbought: params.rsi_overbought
        });
        if (oversoldSignal.indicators && oversoldSignal.indicators.rsi) {
            console.log(`   Test OVERSOLD: RSI=${oversoldSignal.indicators.rsi.toFixed(2)}, Direction=${oversoldSignal.direction}`);
        }
        
        // Simula RSI overbought
        const overboughtPrices = [];
        let overboughtPrice = 50000;
        for (let i = 0; i < 50; i++) {
            overboughtPrice = overboughtPrice * 1.02; // Salita costante
            overboughtPrices.push({
                price: overboughtPrice,
                close: overboughtPrice,
                high: overboughtPrice * 1.01,
                low: overboughtPrice * 0.99,
                timestamp: new Date(Date.now() - (50 - i) * 15 * 60 * 1000).toISOString()
            });
        }
        const overboughtSignal = signalGenerator.generateSignal(overboughtPrices, 'bitcoin', {
            rsi_period: params.rsi_period,
            rsi_oversold: params.rsi_oversold,
            rsi_overbought: params.rsi_overbought
        });
        if (overboughtSignal.indicators && overboughtSignal.indicators.rsi) {
            console.log(`   Test OVERBOUGHT: RSI=${overboughtSignal.indicators.rsi.toFixed(2)}, Direction=${overboughtSignal.direction}`);
        }
        
        console.log('\n✅ Test completato!');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Errore durante il test:', error);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
};

// Esegui test
testRSIParams();

