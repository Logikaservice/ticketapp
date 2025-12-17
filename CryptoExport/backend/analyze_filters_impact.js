/**
 * STRATEGIC FILTER ANALYSIS
 * Identifica quali filtri stanno limitando i profitti
 * Approccio: Disabilita un filtro alla volta e misura l'impatto
 */

const AdvancedBacktestAnalyzer = require('./advanced_backtest_analyzer');

async function analyzeFilterImpact(symbol = 'bitcoin', days = 60) {
    console.log('\n🔬 ANALISI STRATEGICA FILTRI PROFESSIONALI\n');
    console.log('='.repeat(80));
    console.log('🎯 Obiettivo: Identificare filtri che bloccano trade buoni\n');
    console.log('💡 Strategia: Disabilita un filtro alla volta e misura impatto\n');

    // Configurazione base ottimale
    const baseConfig = {
        stopLossPercent: 3,
        takeProfitPercent: 15,
        trailingStopPercent: 4,
        minSignalStrength: 70
    };

    // Test scenarios
    const scenarios = [
        {
            name: 'BASELINE (Tutti i filtri)',
            description: 'Configurazione attuale con tutti i filtri attivi',
            filters: {
                trendFilter: true,
                volatilityFilter: true,
                rrFilter: true,
                bollingerFilter: true,
                rsiFilter: true
            }
        },
        {
            name: 'NO Trend 4h Filter',
            description: 'Rimuove filtro trend 4h (linee 117-126)',
            filters: {
                trendFilter: false,  // ← DISABILITA
                volatilityFilter: true,
                rrFilter: true,
                bollingerFilter: true,
                rsiFilter: true
            }
        },
        {
            name: 'NO Volatility Filter',
            description: 'Rimuove filtro volatilità ATR (linee 129-135)',
            filters: {
                trendFilter: true,
                volatilityFilter: false,  // ← DISABILITA
                rrFilter: true,
                bollingerFilter: true,
                rsiFilter: true
            }
        },
        {
            name: 'NO R/R Filter',
            description: 'Rimuove filtro Risk/Reward (linee 138-145)',
            filters: {
                trendFilter: true,
                volatilityFilter: true,
                rrFilter: false,  // ← DISABILITA
                bollingerFilter: true,
                rsiFilter: true
            }
        },
        {
            name: 'NO Bollinger Filter',
            description: 'Rimuove filtro Bollinger Bands (linee 148-163)',
            filters: {
                trendFilter: true,
                volatilityFilter: true,
                rrFilter: true,
                bollingerFilter: false,  // ← DISABILITA
                rsiFilter: true
            }
        },
        {
            name: 'NO RSI Extremes Filter',
            description: 'Rimuove filtro RSI estremi (linee 166-174)',
            filters: {
                trendFilter: true,
                volatilityFilter: true,
                rrFilter: true,
                bollingerFilter: true,
                rsiFilter: false  // ← DISABILITA
            }
        },
        {
            name: 'MINIMAL Filters',
            description: 'Solo filtri essenziali (Trend + Volatilità)',
            filters: {
                trendFilter: true,
                volatilityFilter: true,
                rrFilter: false,
                bollingerFilter: false,
                rsiFilter: false
            }
        },
        {
            name: 'NO Filters',
            description: 'Nessun filtro (solo MIN_SIGNAL_STRENGTH)',
            filters: {
                trendFilter: false,
                volatilityFilter: false,
                rrFilter: false,
                bollingerFilter: false,
                rsiFilter: false
            }
        }
    ];

    console.log(`📊 Testando ${scenarios.length} configurazioni filtri...\n`);

    const results = [];

    for (const scenario of scenarios) {
        console.log(`[${scenarios.indexOf(scenario) + 1}/${scenarios.length}] ${scenario.name}`);
        console.log(`   ${scenario.description}`);

        try {
            const analyzer = new AdvancedBacktestAnalyzer(symbol, 1000, 100);

            // Applica configurazione ottimale
            Object.assign(analyzer.config, baseConfig);

            // Override applyProfessionalFilters con filtri personalizzati
            const originalApply = analyzer.applyProfessionalFilters.bind(analyzer);
            analyzer.applyProfessionalFilters = function (signal, history, currentPrice) {
                let allowed = true;
                let strengthReduction = 0;
                const reasons = [];

                // 1. Verifica forza segnale minima (sempre attivo)
                if (signal.score < this.config.minSignalStrength) {
                    allowed = false;
                    reasons.push(`Score troppo basso`);
                }

                const prices = history.map(h => h.close);
                const priceChange4h = prices.length >= 16 ? ((prices[prices.length - 1] - prices[prices.length - 16]) / prices[prices.length - 16] * 100) : 0;

                // 2. Trend Filter (opzionale)
                if (scenario.filters.trendFilter) {
                    if (signal.direction === 'LONG' && priceChange4h < -2) {
                        strengthReduction += 30;
                        reasons.push('Trend 4h ribassista');
                    }
                    if (signal.direction === 'SHORT' && priceChange4h > 2) {
                        strengthReduction += 30;
                        reasons.push('Trend 4h rialzista');
                    }
                }

                // 3. Volatility Filter (opzionale)
                if (scenario.filters.volatilityFilter && signal.indicators.atr && currentPrice > 0) {
                    const atrPercent = (signal.indicators.atr / currentPrice) * 100;
                    if (atrPercent > 3) {
                        strengthReduction += 20;
                        reasons.push('Volatilità troppo alta');
                    }
                }

                // 4. R/R Filter (opzionale)
                if (scenario.filters.rrFilter) {
                    const rrRatio = this.config.takeProfitPercent / this.config.stopLossPercent;
                    if (rrRatio < 1.3) {
                        strengthReduction += 20;
                        reasons.push('R/R scarso');
                    }
                }

                // 5. Bollinger Filter (opzionale)
                if (scenario.filters.bollingerFilter && signal.indicators.bollinger) {
                    const distanceToUpper = ((signal.indicators.bollinger.upper - currentPrice) / currentPrice) * 100;
                    const distanceToLower = ((currentPrice - signal.indicators.bollinger.lower) / currentPrice) * 100;

                    if (signal.direction === 'LONG' && distanceToUpper < 1) {
                        strengthReduction += 30;
                        reasons.push('Vicino a resistenza');
                    }
                    if (signal.direction === 'SHORT' && distanceToLower < 1) {
                        strengthReduction += 30;
                        reasons.push('Vicino a supporto');
                    }
                }

                // 6. RSI Extremes Filter (opzionale)
                if (scenario.filters.rsiFilter) {
                    if (signal.indicators.rsi > 75 && signal.direction === 'LONG') {
                        strengthReduction += 25;
                        reasons.push('RSI ipercomprato');
                    }
                    if (signal.indicators.rsi < 25 && signal.direction === 'SHORT') {
                        strengthReduction += 25;
                        reasons.push('RSI ipervenduto');
                    }
                }

                const adjustedStrength = Math.max(0, signal.score - strengthReduction);
                if (adjustedStrength < this.config.minSignalStrength) {
                    allowed = false;
                }

                return { allowed, adjustedStrength, originalStrength: signal.score, strengthReduction, reasons };
            };

            // Esegui backtest silenzioso
            const originalLog = console.log;
            console.log = () => { };
            const result = await analyzer.runBacktest(days);
            console.log = originalLog;

            results.push({
                scenario: scenario.name,
                description: scenario.description,
                filters: scenario.filters,
                summary: result.summary
            });

            // Mostra risultato
            const returnStr = result.summary.totalReturn >= 0 ? `+${result.summary.totalReturn.toFixed(2)}%` : `${result.summary.totalReturn.toFixed(2)}%`;
            const emoji = result.summary.totalReturn > 2 ? '🟢' : result.summary.totalReturn > 0 ? '✅' : '❌';
            console.log(`   ${emoji} Return: ${returnStr} | Trades: ${result.summary.totalTrades} | Win Rate: ${result.summary.winRate.toFixed(1)}%\n`);

        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }

    // Analisi risultati
    console.log('\n' + '='.repeat(80));
    console.log('📊 CLASSIFICA PER RETURN');
    console.log('='.repeat(80));

    const sorted = [...results].sort((a, b) => b.summary.totalReturn - a.summary.totalReturn);

    console.log('\n┌────┬──────────────────────────┬─────────┬────────┬──────────┬────────┐');
    console.log('│ Pos│ Configurazione           │ Return  │ Trades │ Win Rate │ Profit │');
    console.log('├────┼──────────────────────────┼─────────┼────────┼──────────┼────────┤');

    sorted.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const isBaseline = r.scenario === 'BASELINE (Tutti i filtri)' ? '→' : ' ';

        console.log(`│ ${medal}${(idx + 1).toString().padStart(2)} │${isBaseline}${r.scenario.padEnd(24)} │ ${returnStr.padStart(7)} │ ${r.summary.totalTrades.toString().padStart(6)} │ ${r.summary.winRate.toFixed(1).padStart(8)}% │ ${r.summary.profitFactor.toFixed(2).padStart(6)} │`);
    });

    console.log('└────┴──────────────────────────┴─────────┴────────┴──────────┴────────┘');

    // Identifica filtro più dannoso
    const baseline = results.find(r => r.scenario === 'BASELINE (Tutti i filtri)');
    const best = sorted[0];

    console.log('\n' + '='.repeat(80));
    console.log('🎯 ANALISI IMPATTO FILTRI');
    console.log('='.repeat(80));

    console.log('\n📊 Impatto di ogni filtro (vs BASELINE):');

    const filterTests = results.filter(r => r.scenario.startsWith('NO '));
    filterTests.forEach(r => {
        const improvement = r.summary.totalReturn - baseline.summary.totalReturn;
        const tradeIncrease = r.summary.totalTrades - baseline.summary.totalTrades;
        const emoji = improvement > 0.5 ? '🟢' : improvement > 0 ? '✅' : improvement < -0.5 ? '❌' : '⚪';

        console.log(`\n${emoji} ${r.scenario}:`);
        console.log(`   Return: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}% (${r.summary.totalReturn.toFixed(2)}% totale)`);
        console.log(`   Trade: ${tradeIncrease >= 0 ? '+' : ''}${tradeIncrease} (${r.summary.totalTrades} totale)`);
        console.log(`   Win Rate: ${r.summary.winRate.toFixed(1)}%`);

        if (improvement > 0.5) {
            console.log(`   💡 RACCOMANDAZIONE: Questo filtro sta LIMITANDO i profitti!`);
        } else if (improvement < -0.5) {
            console.log(`   ✅ RACCOMANDAZIONE: Questo filtro è UTILE, mantienilo!`);
        }
    });

    // Simulazione con $1080
    console.log('\n' + '='.repeat(80));
    console.log('💰 SIMULAZIONE CON CAPITALE $1,080');
    console.log('='.repeat(80));

    console.log('\n┌──────────────────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Configurazione           │ Return       │ Profitto     │ Mensile      │');
    console.log('├──────────────────────────┼──────────────┼──────────────┼──────────────┤');

    sorted.slice(0, 5).forEach(r => {
        const profit = 1080 * (r.summary.totalReturn / 100);
        const monthly = profit / 2;
        const returnStr = `${r.summary.totalReturn >= 0 ? '+' : ''}${r.summary.totalReturn.toFixed(2)}%`;
        const profitStr = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
        const monthlyStr = `${monthly >= 0 ? '+' : ''}$${monthly.toFixed(2)}`;
        const isBaseline = r.scenario === 'BASELINE (Tutti i filtri)' ? '→' : ' ';

        console.log(`│${isBaseline}${r.scenario.padEnd(25)} │ ${returnStr.padStart(12)} │ ${profitStr.padStart(12)} │ ${monthlyStr.padStart(12)} │`);
    });

    console.log('└──────────────────────────┴──────────────┴──────────────┴──────────────┘');

    // Raccomandazione finale
    console.log('\n' + '='.repeat(80));
    console.log('🎯 RACCOMANDAZIONE STRATEGICA FINALE');
    console.log('='.repeat(80));

    const improvement = best.summary.totalReturn - baseline.summary.totalReturn;
    const profitImprovement = 1080 * (improvement / 100);

    if (improvement > 0.5) {
        console.log(`\n💡 TROVATA CONFIGURAZIONE MIGLIORE!\n`);
        console.log(`📊 ${best.scenario}`);
        console.log(`   ${best.description}\n`);
        console.log(`📈 Miglioramento vs BASELINE:`);
        console.log(`   Return: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%`);
        console.log(`   Profitto (2 mesi): ${profitImprovement >= 0 ? '+' : ''}$${profitImprovement.toFixed(2)}`);
        console.log(`   Profitto mensile: ${profitImprovement >= 0 ? '+' : ''}$${(profitImprovement / 2).toFixed(2)}`);
        console.log(`   Trade: ${best.summary.totalTrades} (vs ${baseline.summary.totalTrades})`);
        console.log(`   Win Rate: ${best.summary.winRate.toFixed(1)}% (vs ${baseline.summary.winRate.toFixed(1)}%)`);

        console.log(`\n🔧 Filtri da DISABILITARE:`);
        Object.entries(best.filters).forEach(([filter, enabled]) => {
            if (!enabled) {
                console.log(`   ❌ ${filter}`);
            }
        });

        console.log(`\n🔧 Filtri da MANTENERE:`);
        Object.entries(best.filters).forEach(([filter, enabled]) => {
            if (enabled) {
                console.log(`   ✅ ${filter}`);
            }
        });
    } else {
        console.log(`\n✅ La configurazione BASELINE è già ottimale!`);
        console.log(`   Tutti i filtri stanno contribuendo positivamente.`);
        console.log(`   Non rimuovere nessun filtro.`);
    }

    // Salva report
    const fs = require('fs');
    fs.writeFileSync('./filter_analysis_report.json', JSON.stringify({
        symbol,
        period: `${days} days`,
        testDate: new Date().toISOString(),
        baseline: baseline.summary,
        best: {
            scenario: best.scenario,
            filters: best.filters,
            summary: best.summary,
            improvement: improvement,
            profitImprovement: profitImprovement
        },
        allResults: results.map(r => ({
            scenario: r.scenario,
            filters: r.filters,
            return: r.summary.totalReturn,
            trades: r.summary.totalTrades,
            winRate: r.summary.winRate
        }))
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analisi filtri completata!');
    console.log('📁 Report salvato in: filter_analysis_report.json');
    console.log('='.repeat(80) + '\n');
}

// Esegui analisi
analyzeFilterImpact('bitcoin', 60).then(() => process.exit(0)).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});
