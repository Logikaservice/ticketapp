/**
 * 🔍 Script per analizzare simboli da rimuovere
 * 
 * Identifica simboli con:
 * - Volume 24h basso
 * - Volatilità insufficiente
 * - Dati insufficienti
 * - Altri indicatori che li rendono inadatti al trading
 * 
 * Esegui con: node backend/scripts/analyze-symbols-to-remove.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { dbAll, dbGet } = require('../crypto_db');

// Criteri per identificare simboli da rimuovere
const CRITERIA = {
    // Volume minimo 24h (in USDT) - più alto del minimo del bot per essere selettivi
    MIN_VOLUME_24H: 1000000,  // 1M USDT (più alto del minimo 500k del bot)
    
    // Klines minimi richiesti
    MIN_KLINES_15M: 100,      // Almeno 100 klines 15m (circa 1 giorno)
    MIN_KLINES_1H: 50,        // Almeno 50 klines 1h (circa 2 giorni)
    MIN_KLINES_4H: 30,        // Almeno 30 klines 4h (circa 5 giorni)
    
    // Volatilità minima (ATR %)
    MIN_ATR_PCT: 0.5,         // Almeno 0.5% di volatilità media
    
    // Prezzo minimo (per evitare token troppo piccoli)
    MIN_PRICE: 0.001,         // Almeno $0.001
    
    // Gap temporale massimo accettabile (ore)
    MAX_GAP_HOURS: 4          // Max 4 ore di gap dall'ultima kline
};

async function analyzeSymbols() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ANALISI SIMBOLI DA RIMUOVERE');
    console.log('='.repeat(80) + '\n');

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
            const symbolAnalysis = await analyzeSymbol(symbol);
            analysis.push(symbolAnalysis);

            if (symbolAnalysis.shouldRemove) {
                symbolsToRemove.push(symbolAnalysis);
            } else {
                symbolsToKeep.push(symbolAnalysis);
            }
        }

        // 3. Ordina per priorità di rimozione (più problemi = più prioritario)
        symbolsToRemove.sort((a, b) => {
            const aScore = a.issues.length + (a.volume24h || 0) / 1000000;
            const bScore = b.issues.length + (b.volume24h || 0) / 1000000;
            return bScore - aScore; // Più alto = più problemi
        });

        // 4. Mostra risultati
        console.log('📋 RISULTATI ANALISI:');
        console.log('─'.repeat(80));
        console.log(`   ✅ Simboli da MANTENERE: ${symbolsToKeep.length}`);
        console.log(`   ❌ Simboli da RIMUOVERE: ${symbolsToRemove.length}`);
        console.log('');

        // 5. Mostra simboli da rimuovere
        if (symbolsToRemove.length > 0) {
            console.log('❌ SIMBOLI DA RIMUOVERE:');
            console.log('─'.repeat(80));
            
            symbolsToRemove.forEach((symbol, idx) => {
                console.log(`\n${idx + 1}. ${symbol.symbol}`);
                console.log(`   Problemi: ${symbol.issues.length}`);
                symbol.issues.forEach((issue, i) => {
                    console.log(`      ${i + 1}. ${issue}`);
                });
                
                // Mostra metriche
                if (symbol.volume24h !== null) {
                    const volumeM = (symbol.volume24h / 1000000).toFixed(2);
                    console.log(`   Volume 24h: $${volumeM}M (minimo: $${CRITERIA.MIN_VOLUME_24H / 1000000}M)`);
                }
                if (symbol.klines15m !== null) {
                    console.log(`   Klines 15m: ${symbol.klines15m} (minimo: ${CRITERIA.MIN_KLINES_15M})`);
                }
                if (symbol.klines1h !== null) {
                    console.log(`   Klines 1h: ${symbol.klines1h} (minimo: ${CRITERIA.MIN_KLINES_1H})`);
                }
                if (symbol.klines4h !== null) {
                    console.log(`   Klines 4h: ${symbol.klines4h} (minimo: ${CRITERIA.MIN_KLINES_4H})`);
                }
                if (symbol.currentPrice !== null) {
                    console.log(`   Prezzo: $${symbol.currentPrice.toFixed(6)}`);
                }
            });
            console.log('');
        }

        // 6. Mostra top simboli da mantenere (migliori)
        if (symbolsToKeep.length > 0) {
            const topSymbols = symbolsToKeep
                .filter(s => s.volume24h && s.volume24h > CRITERIA.MIN_VOLUME_24H * 2)
                .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
                .slice(0, 10);

            console.log('✅ TOP 10 SIMBOLI DA MANTENERE (per volume):');
            console.log('─'.repeat(80));
            topSymbols.forEach((symbol, idx) => {
                const volumeM = (symbol.volume24h / 1000000).toFixed(2);
                console.log(`   ${idx + 1}. ${symbol.symbol}: $${volumeM}M volume 24h`);
            });
            console.log('');
        }

        // 7. Statistiche
        console.log('📊 STATISTICHE:');
        console.log('─'.repeat(80));
        const avgVolume = symbolsToKeep
            .filter(s => s.volume24h)
            .reduce((sum, s) => sum + (s.volume24h || 0), 0) / symbolsToKeep.filter(s => s.volume24h).length;
        console.log(`   Volume medio (simboli da mantenere): $${(avgVolume / 1000000).toFixed(2)}M`);
        console.log(`   Volume minimo (simboli da mantenere): $${Math.min(...symbolsToKeep.filter(s => s.volume24h).map(s => s.volume24h || 0)) / 1000000}M`);
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

async function analyzeSymbol(symbol) {
    const issues = [];
    const analysis = {
        symbol,
        volume24h: null,
        currentPrice: null,
        klines15m: null,
        klines1h: null,
        klines4h: null,
        gapHours: null,
        issues,
        shouldRemove: false
    };

    try {
        // 1. Verifica volume 24h
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
                if (analysis.volume24h < CRITERIA.MIN_VOLUME_24H) {
                    issues.push(`Volume 24h troppo basso: $${(analysis.volume24h / 1000000).toFixed(2)}M < $${CRITERIA.MIN_VOLUME_24H / 1000000}M`);
                }
            } else {
                issues.push('Volume 24h non disponibile');
            }
        } catch (err) {
            issues.push(`Errore recupero volume: ${err.message}`);
        }

        // 2. Verifica prezzo corrente
        try {
            const priceData = await dbGet(
                `SELECT price 
                 FROM price_history 
                 WHERE symbol = $1 
                 ORDER BY timestamp DESC LIMIT 1`,
                [symbol]
            );
            
            if (priceData && priceData.price) {
                analysis.currentPrice = parseFloat(priceData.price);
                if (analysis.currentPrice < CRITERIA.MIN_PRICE) {
                    issues.push(`Prezzo troppo basso: $${analysis.currentPrice.toFixed(6)} < $${CRITERIA.MIN_PRICE}`);
                }
            } else {
                issues.push('Prezzo corrente non disponibile');
            }
        } catch (err) {
            // Ignora errori prezzo
        }

        // 3. Verifica klines 15m
        try {
            const klines15m = await dbGet(
                `SELECT COUNT(*) as count, MAX(open_time) as last_time
                 FROM klines 
                 WHERE symbol = $1 AND interval = '15m'`,
                [symbol]
            );
            
            if (klines15m) {
                analysis.klines15m = parseInt(klines15m.count || 0);
                if (analysis.klines15m < CRITERIA.MIN_KLINES_15M) {
                    issues.push(`Klines 15m insufficienti: ${analysis.klines15m} < ${CRITERIA.MIN_KLINES_15M}`);
                }
                
                // Verifica gap temporale
                if (klines15m.last_time) {
                    const lastTime = parseInt(klines15m.last_time);
                    const gapMs = Date.now() - lastTime;
                    analysis.gapHours = gapMs / (1000 * 60 * 60);
                    if (analysis.gapHours > CRITERIA.MAX_GAP_HOURS) {
                        issues.push(`Gap temporale troppo grande: ${analysis.gapHours.toFixed(1)}h > ${CRITERIA.MAX_GAP_HOURS}h`);
                    }
                }
            } else {
                issues.push('Klines 15m non disponibili');
            }
        } catch (err) {
            issues.push(`Errore verifica klines 15m: ${err.message}`);
        }

        // 4. Verifica klines 1h
        try {
            const klines1h = await dbGet(
                `SELECT COUNT(*) as count
                 FROM klines 
                 WHERE symbol = $1 AND interval = '1h'`,
                [symbol]
            );
            
            if (klines1h) {
                analysis.klines1h = parseInt(klines1h.count || 0);
                if (analysis.klines1h < CRITERIA.MIN_KLINES_1H) {
                    issues.push(`Klines 1h insufficienti: ${analysis.klines1h} < ${CRITERIA.MIN_KLINES_1H}`);
                }
            }
        } catch (err) {
            // Ignora errori klines 1h (meno critico)
        }

        // 5. Verifica klines 4h
        try {
            const klines4h = await dbGet(
                `SELECT COUNT(*) as count
                 FROM klines 
                 WHERE symbol = $1 AND interval = '4h'`,
                [symbol]
            );
            
            if (klines4h) {
                analysis.klines4h = parseInt(klines4h.count || 0);
                if (analysis.klines4h < CRITERIA.MIN_KLINES_4H) {
                    issues.push(`Klines 4h insufficienti: ${analysis.klines4h} < ${CRITERIA.MIN_KLINES_4H}`);
                }
            }
        } catch (err) {
            // Ignora errori klines 4h (meno critico)
        }

        // 6. Determina se rimuovere
        // Rimuovi se ha almeno 2 problemi critici o volume molto basso
        const criticalIssues = issues.filter(i => 
            i.includes('Volume') || 
            i.includes('Klines 15m') || 
            i.includes('Gap temporale')
        );
        
        analysis.shouldRemove = criticalIssues.length >= 2 || 
                                (analysis.volume24h && analysis.volume24h < CRITERIA.MIN_VOLUME_24H * 0.5);

    } catch (error) {
        issues.push(`Errore analisi: ${error.message}`);
        analysis.shouldRemove = true; // In caso di errore, meglio rimuovere
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
