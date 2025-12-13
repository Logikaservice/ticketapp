/**
 * 💰 Script per analizzare simboli con guadagno minimo troppo basso
 * 
 * Con $100 per posizione, identifica simboli dove:
 * - Il guadagno assoluto minimo (non percentuale) sarebbe troppo piccolo
 * - Le commissioni/spread renderebbero il trade non profittevole
 * - Il prezzo è troppo basso per generare un guadagno significativo
 * 
 * Esegui con: node backend/scripts/analyze-low-profit-symbols.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { dbAll, dbGet } = require('../crypto_db');

// Configurazione
const CONFIG = {
    TRADE_SIZE_USDT: 100,           // $100 per posizione
    TAKE_PROFIT_PCT: 4.0,           // 4% take profit
    MIN_PROFIT_ABSOLUTE: 0.50,      // Minimo $0.50 di guadagno assoluto (non percentuale)
    COMMISSION_PCT: 0.1,            // 0.1% commissione (tipica Binance)
    MIN_PRICE_FOR_PROFIT: null      // Calcolato automaticamente
};

// Calcola prezzo minimo per avere guadagno significativo
// Con $100, 4% TP, vogliamo almeno $0.50 di guadagno
// Profit = TradeSize * TP% - Commissioni
// $0.50 = $100 * 4% - ($100 * 0.1% * 2) = $4 - $0.20 = $3.80 netto
// Ma consideriamo anche spread e arrotondamenti, quindi minimo $0.50 netto
// Se prezzo è troppo basso, anche con 4% il guadagno assoluto è piccolo
CONFIG.MIN_PRICE_FOR_PROFIT = CONFIG.MIN_PROFIT_ABSOLUTE / (CONFIG.TAKE_PROFIT_PCT / 100);

async function analyzeSymbols() {
    console.log('\n' + '='.repeat(80));
    console.log('💰 ANALISI SIMBOLI CON GUADAGNO MINIMO TROPPO BASSO');
    console.log('='.repeat(80) + '\n');

    console.log('📊 CONFIGURAZIONE:');
    console.log('─'.repeat(80));
    console.log(`   • Trade size: $${CONFIG.TRADE_SIZE_USDT}`);
    console.log(`   • Take profit: ${CONFIG.TAKE_PROFIT_PCT}%`);
    console.log(`   • Guadagno minimo richiesto: $${CONFIG.MIN_PROFIT_ABSOLUTE}`);
    console.log(`   • Commissione: ${CONFIG.COMMISSION_PCT}%`);
    console.log(`   • Prezzo minimo consigliato: $${CONFIG.MIN_PRICE_FOR_PROFIT.toFixed(6)}`);
    console.log('');

    try {
        // 1. Ottieni tutti i simboli attivi
        const activeSymbols = await dbAll(
            `SELECT DISTINCT symbol 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
               AND is_active = 1 
               AND symbol != 'global'
             ORDER BY symbol`
        );

        console.log(`📊 Simboli attivi trovati: ${activeSymbols.length}\n`);

        const symbolsToRemove = [];
        const symbolsToKeep = [];
        const analysis = [];

        // 2. Analizza ogni simbolo
        for (const { symbol } of activeSymbols) {
            const symbolAnalysis = await analyzeSymbolProfit(symbol);
            analysis.push(symbolAnalysis);

            if (symbolAnalysis.shouldRemove) {
                symbolsToRemove.push(symbolAnalysis);
            } else {
                symbolsToKeep.push(symbolAnalysis);
            }
        }

        // 3. Ordina per priorità (prezzo più basso = più prioritario da rimuovere)
        symbolsToRemove.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));

        // 4. Mostra risultati
        console.log('📋 RISULTATI ANALISI:');
        console.log('─'.repeat(80));
        console.log(`   ✅ Simboli da MANTENERE: ${symbolsToKeep.length}`);
        console.log(`   ❌ Simboli da RIMUOVERE: ${symbolsToRemove.length}`);
        console.log('');

        // 5. Mostra simboli da rimuovere
        if (symbolsToRemove.length > 0) {
            console.log('❌ SIMBOLI DA RIMUOVERE (guadagno minimo troppo basso):');
            console.log('─'.repeat(80));
            
            symbolsToRemove.forEach((symbol, idx) => {
                console.log(`\n${idx + 1}. ${symbol.symbol}`);
                console.log(`   Problemi: ${symbol.issues.length}`);
                symbol.issues.forEach((issue, i) => {
                    console.log(`      ${i + 1}. ${issue}`);
                });
                
                // Mostra calcoli dettagliati
                if (symbol.currentPrice !== null) {
                    console.log(`   Prezzo: $${symbol.currentPrice.toFixed(8)}`);
                    console.log(`   Volume acquistabile: ${symbol.volume.toFixed(2)} unità`);
                    console.log(`   Take profit: ${CONFIG.TAKE_PROFIT_PCT}% = $${symbol.takeProfitPrice.toFixed(8)}`);
                    console.log(`   Guadagno assoluto: $${symbol.absoluteProfit.toFixed(4)}`);
                    console.log(`   Commissioni (entry+exit): $${symbol.commissions.toFixed(4)}`);
                    console.log(`   Guadagno netto: $${symbol.netProfit.toFixed(4)}`);
                    console.log(`   ⚠️  Guadagno netto < $${CONFIG.MIN_PROFIT_ABSOLUTE} (minimo richiesto)`);
                }
            });
            console.log('');
        }

        // 6. Mostra top simboli da mantenere (migliori per guadagno)
        if (symbolsToKeep.length > 0) {
            const topSymbols = symbolsToKeep
                .filter(s => s.netProfit && s.netProfit > CONFIG.MIN_PROFIT_ABSOLUTE * 2)
                .sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0))
                .slice(0, 10);

            console.log('✅ TOP 10 SIMBOLI DA MANTENERE (per guadagno netto):');
            console.log('─'.repeat(80));
            topSymbols.forEach((symbol, idx) => {
                console.log(`   ${idx + 1}. ${symbol.symbol}: $${symbol.netProfit.toFixed(4)} guadagno netto (prezzo: $${symbol.currentPrice.toFixed(6)})`);
            });
            console.log('');
        }

        // 7. Statistiche
        console.log('📊 STATISTICHE:');
        console.log('─'.repeat(80));
        const profitableSymbols = symbolsToKeep.filter(s => s.netProfit && s.netProfit > CONFIG.MIN_PROFIT_ABSOLUTE);
        const avgProfit = profitableSymbols.reduce((sum, s) => sum + (s.netProfit || 0), 0) / profitableSymbols.length;
        const minProfit = Math.min(...profitableSymbols.map(s => s.netProfit || 0));
        const maxProfit = Math.max(...profitableSymbols.map(s => s.netProfit || 0));
        
        console.log(`   Simboli profittevoli (>$${CONFIG.MIN_PROFIT_ABSOLUTE}): ${profitableSymbols.length}`);
        console.log(`   Guadagno netto medio: $${avgProfit.toFixed(4)}`);
        console.log(`   Guadagno netto minimo: $${minProfit.toFixed(4)}`);
        console.log(`   Guadagno netto massimo: $${maxProfit.toFixed(4)}`);
        console.log('');

        // 8. Genera comando SQL per disattivare simboli
        if (symbolsToRemove.length > 0) {
            console.log('💾 COMANDO SQL PER DISATTIVARE SIMBOLI:');
            console.log('─'.repeat(80));
            const symbolsList = symbolsToRemove.map(s => `'${s.symbol}'`).join(', ');
            console.log(`
UPDATE bot_settings 
SET is_active = 0 
WHERE strategy_name = 'RSI_Strategy' 
  AND symbol IN (${symbolsList});
            `.trim());
            console.log('');
        }

        // 9. Genera lista semplice
        console.log('📝 LISTA SIMBOLI DA RIMUOVERE (per copia/incolla):');
        console.log('─'.repeat(80));
        console.log(symbolsToRemove.map(s => s.symbol).join(', '));
        console.log('');

        console.log('='.repeat(80));
        console.log(`✅ Analisi completata: ${symbolsToRemove.length} simboli da rimuovere su ${activeSymbols.length} totali`);
        console.log('='.repeat(80) + '\n');

        return {
            total: activeSymbols.length,
            toRemove: symbolsToRemove.length,
            toKeep: symbolsToKeep.length,
            symbolsToRemove: symbolsToRemove.map(s => s.symbol),
            analysis
        };
    } catch (error) {
        console.error('❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function analyzeSymbolProfit(symbol) {
    const issues = [];
    const analysis = {
        symbol,
        currentPrice: null,
        volume: null,
        takeProfitPrice: null,
        absoluteProfit: null,
        commissions: null,
        netProfit: null,
        issues,
        shouldRemove: false
    };

    try {
        // 1. Recupera prezzo corrente
        const priceData = await dbGet(
            `SELECT price 
             FROM price_history 
             WHERE symbol = $1 
             ORDER BY timestamp DESC LIMIT 1`,
            [symbol]
        );
        
        if (!priceData || !priceData.price) {
            issues.push('Prezzo corrente non disponibile');
            analysis.shouldRemove = true;
            return analysis;
        }

        analysis.currentPrice = parseFloat(priceData.price);
        
        // 2. Calcola volume acquistabile con $100
        analysis.volume = CONFIG.TRADE_SIZE_USDT / analysis.currentPrice;
        
        // 3. Calcola prezzo take profit (4% sopra)
        analysis.takeProfitPrice = analysis.currentPrice * (1 + CONFIG.TAKE_PROFIT_PCT / 100);
        
        // 4. Calcola guadagno assoluto (non percentuale)
        analysis.absoluteProfit = analysis.volume * (analysis.takeProfitPrice - analysis.currentPrice);
        
        // 5. Calcola commissioni (entry + exit)
        const entryCommission = CONFIG.TRADE_SIZE_USDT * (CONFIG.COMMISSION_PCT / 100);
        const exitValue = analysis.volume * analysis.takeProfitPrice;
        const exitCommission = exitValue * (CONFIG.COMMISSION_PCT / 100);
        analysis.commissions = entryCommission + exitCommission;
        
        // 6. Calcola guadagno netto (dopo commissioni)
        analysis.netProfit = analysis.absoluteProfit - analysis.commissions;
        
        // 7. Verifica se il guadagno netto è troppo basso
        if (analysis.netProfit < CONFIG.MIN_PROFIT_ABSOLUTE) {
            issues.push(`Guadagno netto troppo basso: $${analysis.netProfit.toFixed(4)} < $${CONFIG.MIN_PROFIT_ABSOLUTE}`);
            analysis.shouldRemove = true;
        }
        
        // 8. Verifica se il prezzo è troppo basso (anche con 4% il guadagno è minimo)
        if (analysis.currentPrice < CONFIG.MIN_PRICE_FOR_PROFIT) {
            issues.push(`Prezzo troppo basso: $${analysis.currentPrice.toFixed(8)} < $${CONFIG.MIN_PRICE_FOR_PROFIT.toFixed(6)} (guadagno minimo non garantito)`);
            // Non rimuovere solo per questo, ma segnala
        }
        
        // 9. Verifica se le commissioni mangiano troppo il guadagno
        const commissionRatio = analysis.commissions / analysis.absoluteProfit;
        if (commissionRatio > 0.2) { // Se commissioni > 20% del guadagno
            issues.push(`Commissioni troppo alte: ${(commissionRatio * 100).toFixed(1)}% del guadagno`);
            // Non rimuovere solo per questo, ma segnala
        }

    } catch (error) {
        issues.push(`Errore analisi: ${error.message}`);
        analysis.shouldRemove = true;
    }

    return analysis;
}

// Esegui
analyzeSymbols()
    .then((result) => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    });
