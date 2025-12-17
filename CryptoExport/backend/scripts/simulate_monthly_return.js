const https = require('https');
// Il modulo esporta già un'istanza singleton
const signalGenerator = require('../services/BidirectionalSignalGenerator');

// Configurazione simulazione
const SYMBOL = 'BTCUSDT';
const INTERVAL = '15m'; // Timeframe bot
const DAYS = 30;
const TP_PCT = 0.04; // 4%
const SL_PCT = 0.025; // 2.5%
const TRADE_AMOUNT = 100; // USDT per trade

// Helper per scaricare klines
function getKlines(symbol, interval, limit, endTime = null) {
    return new Promise((resolve, reject) => {
        let path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        if (endTime) path += `&endTime=${endTime}`;

        const options = {
            hostname: 'api.binance.com',
            port: 443,
            path: path,
            method: 'GET'
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', error => reject(error));
        req.end();
    });
}

async function fetchHistory() {
    console.log(`📥 Scaricamento dati storici ultimi ${DAYS} giorni per ${SYMBOL}...`);

    let allKlines = [];
    let endTime = Date.now();
    const candlesPerDay = 24 * 4; // 96 candles (15m)
    const totalCandles = DAYS * candlesPerDay;
    const batchSize = 1000;

    while (allKlines.length < totalCandles) {
        const klines = await getKlines(SYMBOL, INTERVAL, batchSize, endTime);
        if (!klines || klines.length === 0) break;

        // Binance restituisce dal più vecchio al più nuovo
        // Aggiungiamo all'inizio dell'array per mantenere ordine cronologico corretto globalmente?
        // No, le chiamate con endTime scaricano "indietro". 
        // Se chiedo limit 1000 ed endTime X, mi da le 1000 candele che finiscono a X.

        allKlines = klines.concat(allKlines); // Aggiungi in testa (più vecchie) se stiamo andando indietro? No.
        // Wait. If I request endTime=Now. I get [Now-1000 ... Now].
        // Next request endTime = FirstTimestamp - 1.
        // So I should prepend.

        endTime = klines[0][0] - 1; // Timestamp della prima candela (più vecchia) - 1ms

        if (allKlines.length >= totalCandles) break;
        console.log(`   ...scaricate ${allKlines.length} candele...`);
    }

    // Taglia l'eccesso e formatta
    if (allKlines.length > totalCandles) {
        allKlines = allKlines.slice(allKlines.length - totalCandles);
    }

    return allKlines.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        price: parseFloat(k[4])
    }));
}

async function runSimulation() {
    try {
        const history = await fetchHistory();
        console.log(`✅ Analisi su ${history.length} candele (Timeframe: ${INTERVAL})`);

        let balance = 1000; // Capitale iniziale fittizio
        let position = null; // { type: 'LONG'|'SHORT', entryPrice: number, quantity: number }
        let trades = [];

        // Simulazione
        // Dobbiamo avere abbastanza storico per generare segnali (es. 50-100 candele)
        const warmupPeriod = 100;

        // 🤫 Silenzia i log del generatore durante la simulazione massiva
        const originalLog = console.log;
        console.log = function () { };

        for (let i = warmupPeriod; i < history.length; i++) {
            // ... loop ...
            const currentCandle = history[i];
            const currentPrice = currentCandle.close;
            const candleHigh = currentCandle.high;
            const candleLow = currentCandle.low;

            // 1. Check Exit Conditions (TP/SL) se in posizione
            if (position) {
                if (position.type === 'LONG') {
                    // Check SL (su Low della candela)
                    if (candleLow <= position.stopLoss) {
                        // Chiusura SL
                        const pnl = (position.stopLoss - position.entryPrice) * position.quantity;
                        balance += (position.quantity * position.stopLoss);
                        trades.push({ type: 'LONG', outcome: 'LOSS', pnl, exitPrice: position.stopLoss, reason: 'SL' });
                        position = null;
                        continue;
                    }
                    // Check TP
                    if (candleHigh >= position.takeProfit) {
                        // Chiusura TP
                        const pnl = (position.takeProfit - position.entryPrice) * position.quantity;
                        balance += (position.quantity * position.takeProfit);
                        trades.push({ type: 'LONG', outcome: 'WIN', pnl, exitPrice: position.takeProfit, reason: 'TP' });
                        position = null;
                        continue;
                    }
                } else if (position.type === 'SHORT') {
                    // Check SL (su High della candela)
                    if (candleHigh >= position.stopLoss) {
                        const pnl = (position.entryPrice - position.stopLoss) * position.quantity;
                        // Short PnL: (Entry - Exit) * Qty
                        balance += (position.entryPrice - position.stopLoss) * position.quantity + (TRADE_AMOUNT); // Restituisce margine + pnl negativo
                        // Wait, simplified balance calculation:
                        // invested 100. PnL = -10. Balance += 90.
                        const proceeds = TRADE_AMOUNT + pnl;
                        balance += pnl; // Update balance logic 
                        // Corretto: 
                        // Initial Balance: 1000
                        // Buy 100. Balance 900.
                        // Close with -10. Returns 90. Balance 990.

                        trades.push({ type: 'SHORT', outcome: 'LOSS', pnl, exitPrice: position.stopLoss, reason: 'SL' });
                        position = null;
                        continue;
                    }
                    if (candleLow <= position.takeProfit) {
                        const pnl = (position.entryPrice - position.takeProfit) * position.quantity;
                        trades.push({ type: 'SHORT', outcome: 'WIN', pnl, exitPrice: position.takeProfit, reason: 'TP' });
                        position = null;
                        continue;
                    }
                }
            }

            // 2. Check Entry Conditions (solo se flat)
            if (!position) {
                // OTTIMIZZAZIONE: Passa solo le ultime 300 candele necessarie per gli indicatori
                const startIndex = Math.max(0, i - 300);
                const signalHistory = history.slice(startIndex, i + 1);
                const signal = signalGenerator.generateSignal(signalHistory, SYMBOL);

                // Filtri base dal TradingBot
                const MIN_STRENGTH = 60;
                const MIN_CONFIRMATIONS = 3;

                // LONG ENTRY
                if (signal.direction === 'LONG' && signal.strength >= MIN_STRENGTH && signal.confirmations >= MIN_CONFIRMATIONS) {
                    const entryPrice = currentPrice; // Assumiamo ingresso a close
                    const quantity = TRADE_AMOUNT / entryPrice;
                    const stopLoss = entryPrice * (1 - SL_PCT);
                    const takeProfit = entryPrice * (1 + TP_PCT);

                    position = {
                        type: 'LONG',
                        entryPrice,
                        quantity,
                        stopLoss,
                        takeProfit
                    };
                    // Deduct trade amount from logical calc (not affecting PnL summing directly)
                }
                // SHORT ENTRY
                else if (signal.direction === 'SHORT' && signal.strength >= MIN_STRENGTH && signal.confirmations >= MIN_CONFIRMATIONS) {
                    const entryPrice = currentPrice;
                    const quantity = TRADE_AMOUNT / entryPrice;
                    const stopLoss = entryPrice * (1 + SL_PCT);
                    const takeProfit = entryPrice * (1 - TP_PCT);

                    position = {
                        type: 'SHORT',
                        entryPrice,
                        quantity,
                        stopLoss,
                        takeProfit
                    };
                }
            }
        }

        // Restore console log
        console.log = originalLog;

        // Summary
        let totalPnL = 0;
        let wins = 0;
        let losses = 0;
        trades.forEach(t => {
            totalPnL += t.pnl;
            if (t.pnl > 0) wins++; else losses++;
        });

        const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

        console.log(`\n--- 🔮 SIMULAZIONE PROIEZIONE (Ultimi ${DAYS} giorni su ${SYMBOL}) ---`);
        console.log(`Strategia: TP ${TP_PCT * 100}%, SL ${SL_PCT * 100}%`);
        console.log(`Trades Totali: ${trades.length}`);
        console.log(`Win Rate Teorico: ${winRate.toFixed(2)}% (${wins} Vinti, ${losses} Persi)`);
        console.log(`P&L Teorico (con size $${TRADE_AMOUNT}): $${totalPnL.toFixed(2)}`);

        const monthlyProjection = totalPnL; // Già su 30 giorni

        console.log(`\nRisultato Stimato Mensile: $${monthlyProjection.toFixed(2)} se avessi operato lo scorso mese con queste impostazioni.`);
        console.log(`(Nota: Questa è una simulazione basata sui dati passati e non include commissioni/slippage)`);

    } catch (e) {
        console.error('Errore simulazione:', e);
    }
}

runSimulation();
