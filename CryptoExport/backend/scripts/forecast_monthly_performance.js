const cryptoDb = require('../crypto_db');

const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;

async function runForecast() {
    try {
        console.log('🔍 Generazione proiezione efficacia mensile...\n');

        // 1. Ottieni capitale attuale
        const portfolio = await dbGet("SELECT balance_usd FROM portfolio LIMIT 1");
        const currentBalance = parseFloat(portfolio ? portfolio.balance_usd : 0);

        console.log(`💰 Capitale Attuale: $${currentBalance.toFixed(2)}`);

        // 2. Ottieni tutte le posizioni chiuse
        const closedPositions = await dbAll(`
            SELECT 
                profit_loss,
                closed_at,
                opened_at,
                type,
                symbol
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken')
            AND closed_at IS NOT NULL
            ORDER BY closed_at ASC
        `);

        if (closedPositions.length === 0) {
            console.log('⚠️ Nessuna posizione chiusa trovata per generare una proiezione.');
            return;
        }

        console.log(`📊 Totale posizioni analizzate: ${closedPositions.length}`);

        // 3. Calcola metriche
        let totalPnL = 0;
        let winningTrades = 0;
        let losingTrades = 0;

        const firstTradeDate = new Date(closedPositions[0].closed_at);
        const lastTradeDate = new Date(closedPositions[closedPositions.length - 1].closed_at);

        // Se c'è solo un giorno di trading o meno, considera almeno 1 giorno per evitare divisioni strane
        const timeDiff = Math.max(1, (new Date() - firstTradeDate) / (1000 * 60 * 60 * 24)); // Giorni trascorsi (minimo 1)

        closedPositions.forEach(pos => {
            const pnl = parseFloat(pos.profit_loss);
            totalPnL += pnl;
            if (pnl > 0) winningTrades++;
            else losingTrades++;
        });

        const winRate = (winningTrades / closedPositions.length) * 100;
        const avgDailyPnL = totalPnL / timeDiff;
        const projectedMonthlyPnL = avgDailyPnL * 30;
        const projectedMonthlyROI = (projectedMonthlyPnL / currentBalance) * 100;

        // Calcola ROI attuale
        // Se il balance iniziale non è noto, assumiamo che currentBalance - totalPnL fosse l'iniziale approssimativo
        // o meglio, usiamo il balance attuale come base per il futuro.

        console.log(`\n--- Statistiche Attuali (basate su ${timeDiff.toFixed(1)} giorni) ---`);
        console.log(`Win Rate: ${winRate.toFixed(2)}% (${winningTrades}V - ${losingTrades}P)`);
        console.log(`P&L Totale: $${totalPnL.toFixed(2)}`);
        console.log(`Media P&L Giornaliero: $${avgDailyPnL.toFixed(2)}`);

        console.log(`\n--- 🔮 PROIEZIONE MENSILE (30 Giorni) ---`);
        console.log(`Efficacia Stimata: ${projectedMonthlyROI.toFixed(2)}% ROI mensile`);
        console.log(`Profitto Atteso: $${projectedMonthlyPnL.toFixed(2)}`);
        console.log(`Balance Proiettato (tra 30gg): $${(currentBalance + projectedMonthlyPnL).toFixed(2)}`);

        console.log('\nNOTA: Questa è una proiezione lineare basata sulle performance passate e non garantisce risultati futuri.');

    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
    }
}

// Esegui
runForecast();
