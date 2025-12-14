/**
 * 🔍 ANALISI DETTAGLIATA GAP RECENTI
 * 
 * Analizza i gap recenti per capire quando e perché si sono verificati
 */

const { dbAll, dbGet } = require('../crypto_db');

const KLINE_INTERVAL = '15m';
const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti in millisecondi

async function analyzeGaps(symbol) {
    try {
        // Ottieni tutte le klines ordinate per tempo
        const klines = await dbAll(
            `SELECT open_time, close_time, open_price, close_price 
             FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time ASC`,
            [symbol, KLINE_INTERVAL]
        );

        if (klines.length < 2) {
            return { gaps: [], totalMissing: 0 };
        }

        const gaps = [];
        let totalMissing = 0;

        for (let i = 1; i < klines.length; i++) {
            const prevTime = parseInt(klines[i - 1].open_time);
            const currTime = parseInt(klines[i].open_time);
            const expectedTime = prevTime + KLINE_INTERVAL_MS;
            
            // Gap se differenza > 1.5x l'intervallo
            if (currTime - expectedTime > KLINE_INTERVAL_MS * 1.5) {
                const missingCount = Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS);
                const gapDuration = currTime - expectedTime;
                const gapHours = gapDuration / (1000 * 60 * 60);
                
                gaps.push({
                    from: prevTime,
                    to: currTime,
                    fromDate: new Date(prevTime).toISOString(),
                    toDate: new Date(currTime).toISOString(),
                    missing: missingCount,
                    durationHours: gapHours.toFixed(1),
                    isRecent: (Date.now() - currTime) < (7 * 24 * 60 * 60 * 1000) // Ultimi 7 giorni
                });
                totalMissing += missingCount;
            }
        }

        return { gaps, totalMissing };
    } catch (error) {
        console.error(`Errore analisi gap ${symbol}:`, error.message);
        return { gaps: [], totalMissing: 0 };
    }
}

async function checkLastUpdate(symbol) {
    try {
        const lastKline = await dbGet(
            `SELECT open_time, close_time, close_price 
             FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time DESC LIMIT 1`,
            [symbol, KLINE_INTERVAL]
        );

        if (!lastKline) {
            return null;
        }

        const lastTime = parseInt(lastKline.open_time);
        const now = Date.now();
        const hoursAgo = (now - lastTime) / (1000 * 60 * 60);
        const daysAgo = hoursAgo / 24;

        return {
            lastTime,
            lastDate: new Date(lastTime).toISOString(),
            hoursAgo: hoursAgo.toFixed(1),
            daysAgo: daysAgo.toFixed(2),
            isStale: hoursAgo > 24 // Considera "stale" se > 24 ore
        };
    } catch (error) {
        return null;
    }
}

async function checkPriceHistoryUpdates(symbol) {
    try {
        const lastPrice = await dbGet(
            `SELECT timestamp, price 
             FROM price_history 
             WHERE symbol = $1 
             ORDER BY timestamp DESC LIMIT 1`,
            [symbol]
        );

        if (!lastPrice) {
            return null;
        }

        const lastTime = new Date(lastPrice.timestamp).getTime();
        const now = Date.now();
        const hoursAgo = (now - lastTime) / (1000 * 60 * 60);

        return {
            lastTime,
            lastDate: lastPrice.timestamp,
            hoursAgo: hoursAgo.toFixed(1),
            price: parseFloat(lastPrice.price)
        };
    } catch (error) {
        return null;
    }
}

async function checkWebSocketActivity() {
    try {
        // Verifica se ci sono aggiornamenti recenti in price_history (indica WebSocket attivo)
        const recentUpdates = await dbGet(
            `SELECT COUNT(*) as count 
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '1 hour'`
        );
        
        const veryRecentUpdates = await dbGet(
            `SELECT COUNT(*) as count 
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '10 minutes'`
        );

        return {
            updatesLastHour: parseInt(recentUpdates?.count || 0),
            updatesLast10Min: parseInt(veryRecentUpdates?.count || 0),
            isActive: parseInt(veryRecentUpdates?.count || 0) > 0
        };
    } catch (error) {
        return { updatesLastHour: 0, updatesLast10Min: 0, isActive: false };
    }
}

async function main() {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 ANALISI DETTAGLIATA GAP RECENTI');
        console.log('='.repeat(80) + '\n');

        // 1. Verifica attività WebSocket
        console.log('📡 VERIFICA ATTIVITÀ WEBSOCKET:');
        const wsActivity = await checkWebSocketActivity();
        if (wsActivity.isActive) {
            console.log(`   ✅ WebSocket ATTIVO`);
            console.log(`      • Aggiornamenti ultimi 10 minuti: ${wsActivity.updatesLast10Min}`);
            console.log(`      • Aggiornamenti ultima ora: ${wsActivity.updatesLastHour}`);
        } else {
            console.log(`   ❌ WebSocket NON ATTIVO o dati non aggiornati`);
            console.log(`      • Aggiornamenti ultimi 10 minuti: ${wsActivity.updatesLast10Min}`);
            console.log(`      • Aggiornamenti ultima ora: ${wsActivity.updatesLastHour}`);
        }

        // 2. Analizza simboli principali
        const mainSymbols = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink'];
        
        console.log(`\n📊 ANALISI SIMBOLI PRINCIPALI:\n`);

        for (const symbol of mainSymbols) {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`🔍 ${symbol.toUpperCase()}`);
            console.log('─'.repeat(80));

            // Ultimo aggiornamento klines
            const lastUpdate = await checkLastUpdate(symbol);
            if (lastUpdate) {
                console.log(`\n📅 Ultimo aggiornamento klines:`);
                console.log(`   • Data: ${lastUpdate.lastDate}`);
                console.log(`   • ${lastUpdate.hoursAgo} ore fa (${lastUpdate.daysAgo} giorni fa)`);
                if (lastUpdate.isStale) {
                    console.log(`   ⚠️  DATI OBSOLETI (> 24 ore)`);
                }
            } else {
                console.log(`\n❌ Nessuna kline trovata per ${symbol}`);
            }

            // Ultimo aggiornamento price_history
            const lastPrice = await checkPriceHistoryUpdates(symbol);
            if (lastPrice) {
                console.log(`\n💰 Ultimo aggiornamento price_history:`);
                console.log(`   • Data: ${lastPrice.lastDate}`);
                console.log(`   • ${lastPrice.hoursAgo} ore fa`);
                console.log(`   • Prezzo: $${lastPrice.price.toFixed(2)}`);
                
                if (lastUpdate && lastPrice) {
                    const klineTime = lastUpdate.lastTime;
                    const priceTime = lastPrice.lastTime;
                    const diff = Math.abs(klineTime - priceTime) / (1000 * 60 * 60);
                    if (diff > 1) {
                        console.log(`   ⚠️  DISALLINEAMENTO: klines e price_history differiscono di ${diff.toFixed(1)} ore`);
                    }
                }
            } else {
                console.log(`\n⚠️  Nessun price_history trovato per ${symbol}`);
            }

            // Analizza gap
            const gapAnalysis = await analyzeGaps(symbol);
            const recentGaps = gapAnalysis.gaps.filter(g => g.isRecent);
            
            console.log(`\n🔍 Analisi gap:`);
            console.log(`   • Gap totali: ${gapAnalysis.gaps.length}`);
            console.log(`   • Gap recenti (ultimi 7 giorni): ${recentGaps.length}`);
            console.log(`   • Candele mancanti totali: ${gapAnalysis.totalMissing}`);
            
            if (recentGaps.length > 0) {
                console.log(`\n   ⚠️  GAP RECENTI TROVATI:`);
                recentGaps.forEach((gap, idx) => {
                    console.log(`\n   Gap #${idx + 1}:`);
                    console.log(`      • Da: ${gap.fromDate}`);
                    console.log(`      • A: ${gap.toDate}`);
                    console.log(`      • Durata: ${gap.durationHours} ore`);
                    console.log(`      • Candele mancanti: ~${gap.missing}`);
                    
                    // Calcola quando si è verificato il gap
                    const gapEndTime = gap.to;
                    const now = Date.now();
                    const hoursSinceGap = (now - gapEndTime) / (1000 * 60 * 60);
                    console.log(`      • Si è verificato: ${hoursSinceGap.toFixed(1)} ore fa`);
                });
            } else if (gapAnalysis.gaps.length > 0) {
                console.log(`\n   ℹ️  Gap trovati ma non recenti (più di 7 giorni fa)`);
                const oldestGap = gapAnalysis.gaps[0];
                console.log(`      • Gap più vecchio: ${oldestGap.fromDate}`);
            } else {
                console.log(`\n   ✅ Nessun gap rilevato`);
            }

            // Verifica se ci sono dati dopo l'ultimo gap
            if (recentGaps.length > 0) {
                const lastGap = recentGaps[recentGaps.length - 1];
                const dataAfterGap = await dbGet(
                    `SELECT COUNT(*) as count 
                     FROM klines 
                     WHERE symbol = $1 AND interval = $2 AND open_time > $3`,
                    [symbol, KLINE_INTERVAL, lastGap.to]
                );
                const countAfter = parseInt(dataAfterGap?.count || 0);
                
                if (countAfter > 0) {
                    console.log(`\n   ✅ Ci sono ${countAfter} candele DOPO l'ultimo gap (il sistema si è ripreso)`);
                } else {
                    console.log(`\n   ❌ NESSUN dato dopo l'ultimo gap (il sistema NON si è ripreso)`);
                }
            }
        }

        // 3. Analisi generale
        console.log(`\n\n${'='.repeat(80)}`);
        console.log('📋 CONCLUSIONI E DIAGNOSI');
        console.log('='.repeat(80) + '\n');

        // Verifica pattern comune
        let allRecentGaps = [];
        for (const symbol of mainSymbols) {
            const gapAnalysis = await analyzeGaps(symbol);
            const recentGaps = gapAnalysis.gaps.filter(g => g.isRecent);
            allRecentGaps.push(...recentGaps.map(g => ({ symbol, ...g })));
        }

        if (allRecentGaps.length > 0) {
            // Trova il gap più recente
            const mostRecentGap = allRecentGaps.reduce((prev, curr) => 
                curr.to > prev.to ? curr : prev
            );

            console.log(`🔴 PROBLEMA PRINCIPALE:`);
            console.log(`   • Gap più recente: ${mostRecentGap.symbol} - ${mostRecentGap.toDate}`);
            console.log(`   • Si è verificato: ${((Date.now() - mostRecentGap.to) / (1000 * 60 * 60)).toFixed(1)} ore fa`);
            
            // Verifica se tutti i simboli hanno gap nello stesso periodo
            const gapTimeWindow = 24 * 60 * 60 * 1000; // 24 ore
            const gapsInSameWindow = allRecentGaps.filter(g => 
                Math.abs(g.to - mostRecentGap.to) < gapTimeWindow
            );
            
            if (gapsInSameWindow.length >= 3) {
                console.log(`\n   ⚠️  PATTERN RILEVATO: ${gapsInSameWindow.length} simboli hanno gap nello stesso periodo`);
                console.log(`      Questo suggerisce un problema sistemico (non specifico di un simbolo)`);
                console.log(`      Possibili cause:`);
                console.log(`      • Sistema di download interrotto`);
                console.log(`      • Problema connessione Binance`);
                console.log(`      • WebSocket disconnesso`);
                console.log(`      • Backend crashato o riavviato`);
            }

            // Verifica se il sistema si è ripreso
            const symbolsRecovered = [];
            const symbolsNotRecovered = [];
            
            for (const symbol of mainSymbols) {
                const gapAnalysis = await analyzeGaps(symbol);
                const recentGaps = gapAnalysis.gaps.filter(g => g.isRecent);
                if (recentGaps.length > 0) {
                    const lastGap = recentGaps[recentGaps.length - 1];
                    const dataAfter = await dbGet(
                        `SELECT COUNT(*) as count 
                         FROM klines 
                         WHERE symbol = $1 AND interval = $2 AND open_time > $3`,
                        [symbol, KLINE_INTERVAL, lastGap.to]
                    );
                    if (parseInt(dataAfter?.count || 0) > 0) {
                        symbolsRecovered.push(symbol);
                    } else {
                        symbolsNotRecovered.push(symbol);
                    }
                }
            }

            if (symbolsRecovered.length > 0) {
                console.log(`\n   ✅ Simboli che si sono ripresi: ${symbolsRecovered.join(', ')}`);
            }
            if (symbolsNotRecovered.length > 0) {
                console.log(`\n   ❌ Simboli che NON si sono ripresi: ${symbolsNotRecovered.join(', ')}`);
                console.log(`      → Il sistema di download/WebSocket potrebbe essere ancora interrotto`);
            }
        }

        // 4. Raccomandazioni
        console.log(`\n💡 RACCOMANDAZIONI:`);
        
        if (!wsActivity.isActive) {
            console.log(`   1. ⚠️  WebSocket non attivo - verifica che il backend sia in esecuzione`);
            console.log(`      → Controlla: pm2 status`);
            console.log(`      → Riavvia se necessario: pm2 restart ticketapp-backend`);
        }
        
        if (allRecentGaps.length > 0) {
            console.log(`   2. 🔄 Recupera i gap mancanti:`);
            console.log(`      → Esegui: node backend/scripts/repopulate-from-websocket.js`);
            console.log(`      → Oppure: node backend/klines_recovery_daemon.js`);
            console.log(`      → O scarica manualmente da Binance per i periodi mancanti`);
        }

        console.log('\n' + '='.repeat(80) + '\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

main();

