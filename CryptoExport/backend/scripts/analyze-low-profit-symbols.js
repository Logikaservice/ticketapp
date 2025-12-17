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
    COMMISSION_PCT: 0.1,            // 0.1% commissione (tipica Binance)
    
    // Criteri per identificare simboli problematici
    MIN_PRICE: 0.01,                // Prezzo minimo consigliato (evita arrotondamenti eccessivi)
    MAX_SPREAD_ESTIMATE: 1.0,       // Spread stimato massimo (1% = spread tipico su token liquidi)
    MIN_VOLUME_24H: 1000000,        // Volume minimo 24h ($1M) per liquidità sufficiente
    
    // Con prezzo basso, lo spread reale può essere molto più alto
    // Stimiamo spread basato su prezzo: più basso = spread più alto
    SPREAD_MULTIPLIER: 0.5          // Spread stimato = SPREAD_MULTIPLIER / prezzo (es. 0.5 / 0.000004 = 125,000% - assurdo!)
};

async function analyzeSymbols() {
    console.log('\n' + '='.repeat(80));
    console.log('💰 ANALISI SIMBOLI CON GUADAGNO MINIMO TROPPO BASSO');
    console.log('='.repeat(80) + '\n');

    console.log('📊 CONFIGURAZIONE:');
    console.log('─'.repeat(80));
    console.log(`   • Trade size: $${CONFIG.TRADE_SIZE_USDT}`);
    console.log(`   • Take profit: ${CONFIG.TAKE_PROFIT_PCT}%`);
    console.log(`   • Commissione: ${CONFIG.COMMISSION_PCT}%`);
    console.log(`   • Prezzo minimo consigliato: $${CONFIG.MIN_PRICE} (evita arrotondamenti eccessivi)`);
    console.log(`   • Volume minimo 24h: $${(CONFIG.MIN_VOLUME_24H / 1000000).toFixed(1)}M (liquidità)`);
    console.log(`   • Spread massimo stimato: ${CONFIG.MAX_SPREAD_ESTIMATE}%`);
    console.log('');
    console.log('💡 NOTA: Con $100 e 4% TP, il guadagno teorico è sempre ~$3.80.');
    console.log('   Il problema con prezzi bassi è: spread alto, liquidità bassa, arrotondamenti.');
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
                    console.log(`   Guadagno teorico: $${symbol.absoluteProfit.toFixed(4)}`);
                    console.log(`   Commissioni: $${symbol.commissions.toFixed(4)}`);
                    console.log(`   Spread stimato: ${symbol.estimatedSpread?.toFixed(2) || 'N/A'}%`);
                    if (symbol.estimatedSpread) {
                        const spreadCost = CONFIG.TRADE_SIZE_USDT * (symbol.estimatedSpread / 100);
                        console.log(`   Costo spread: $${spreadCost.toFixed(4)}`);
                    }
                    console.log(`   Guadagno reale (dopo spread): $${symbol.realProfit?.toFixed(4) || symbol.netProfit.toFixed(4)}`);
                    if (symbol.volume24h) {
                        console.log(`   Volume 24h: $${(symbol.volume24h / 1000000).toFixed(2)}M`);
                    }
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
        
        // 6. Calcola guadagno netto teorico (dopo commissioni)
        analysis.netProfit = analysis.absoluteProfit - analysis.commissions;
        
        // 7. Verifica prezzo minimo (evita arrotondamenti eccessivi)
        if (analysis.currentPrice < CONFIG.MIN_PRICE) {
            issues.push(`Prezzo troppo basso: $${analysis.currentPrice.toFixed(8)} < $${CONFIG.MIN_PRICE} (rischio arrotondamenti e spread alto)`);
            analysis.shouldRemove = true;
        }
        
        // 8. Stima spread basato su prezzo (prezzo basso = spread più alto tipicamente)
        // Formula semplificata: spread stimato = 0.1% + (0.5 / prezzo) per prezzo < $1
        let estimatedSpread = 0.1; // Spread base 0.1%
        if (analysis.currentPrice < 1.0) {
            // Su token piccoli, lo spread può essere molto più alto
            estimatedSpread = 0.1 + (0.5 / analysis.currentPrice);
            if (estimatedSpread > 5.0) estimatedSpread = 5.0; // Cap a 5%
        }
        analysis.estimatedSpread = estimatedSpread;
        
        // 9. Calcola guadagno reale considerando spread
        const spreadCost = CONFIG.TRADE_SIZE_USDT * (estimatedSpread / 100);
        analysis.realProfit = analysis.netProfit - spreadCost;
        
        // 10. Verifica se lo spread mangia troppo il guadagno
        if (estimatedSpread > CONFIG.MAX_SPREAD_ESTIMATE) {
            issues.push(`Spread stimato troppo alto: ${estimatedSpread.toFixed(2)}% > ${CONFIG.MAX_SPREAD_ESTIMATE}% (guadagno reale: $${analysis.realProfit.toFixed(4)})`);
            analysis.shouldRemove = true;
        }
        
        // 11. Verifica volume 24h (liquidità)
        try {
            const volumeData = await dbGet(
                `SELECT volume_24h 
                 FROM symbol_volumes_24h 
                 WHERE symbol = $1 
                 ORDER BY updated_at DESC LIMIT 1`,
                [symbol]
            );
            
            if (volumeData && volumeData.volume_24h) {
                analysis.volume24h = parseFloat(volumeData.volume_24h);
                if (analysis.volume24h < CONFIG.MIN_VOLUME_24H) {
                    issues.push(`Volume 24h troppo basso: $${(analysis.volume24h / 1000000).toFixed(2)}M < $${CONFIG.MIN_VOLUME_24H / 1000000}M (liquidità insufficiente)`);
                    analysis.shouldRemove = true;
                }
            }
        } catch (err) {
            // Ignora errori volume
        }
        
        // 12. Verifica se il guadagno reale (dopo spread) è troppo basso
        if (analysis.realProfit < 1.0) { // Minimo $1 di guadagno reale
            issues.push(`Guadagno reale troppo basso: $${analysis.realProfit.toFixed(4)} < $1.00 (dopo spread)`);
            analysis.shouldRemove = true;
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
