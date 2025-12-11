/**
 * 🔍 Script di Debug per Capire Perché il Bot Non Apre Posizioni
 * 
 * Analizza tutti i controlli che possono bloccare l'apertura di una posizione
 */

const { dbAll, dbGet } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');
const riskManager = require('./services/RiskManager');

// Configurazione
const SYMBOL = process.argv[2] || 'aave';
const MIN_SIGNAL_STRENGTH = 65; // LONG
const MIN_CONFIRMATIONS_LONG = 3;

// Helper per calcolare score posizione
async function calculatePositionQualityScore(position) {
    const pnlPct = parseFloat(position.profit_loss_pct) || 0;
    const signalDetails = position.signal_details ? JSON.parse(position.signal_details) : null;
    const signalStrength = signalDetails?.strength || 0;
    
    // Score basato su P&L e strength segnale originale
    const score = (pnlPct * 0.3) + (signalStrength * 0.7);
    
    return {
        position,
        score,
        pnlPct,
        signalStrength
    };
}

// Helper per calcolare score nuovo segnale
function calculateNewSignalQualityScore(signal, symbol, signalType) {
    const strength = signalType === 'buy' 
        ? (signal.longSignal?.strength || signal.strength || 0)
        : (signal.shortSignal?.strength || signal.strength || 0);
    
    const confirmations = signalType === 'buy'
        ? (signal.longSignal?.confirmations || signal.confirmations || 0)
        : (signal.shortSignal?.confirmations || signal.confirmations || 0);
    
    // Score basato su strength e confirmations
    const score = (strength * 0.8) + (confirmations * 5);
    
    return {
        symbol,
        signalType,
        score,
        strength,
        confirmations
    };
}

// Helper per gruppi correlazione
function getCorrelationGroup(symbol) {
    const CORRELATION_GROUPS = {
        'layer1': ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'avax_usdt', 'near', 'aptos', 'sui'],
        'defi': ['uniswap', 'aave', 'maker', 'compound', 'curve', 'synthetix'],
        'meme': ['dogecoin', 'shiba', 'pepe', 'floki', 'bonk'],
        'layer2': ['arbitrum', 'optimism', 'polygon'],
        'storage': ['filecoin', 'arweave'],
        'gaming': ['sand', 'mana', 'gala', 'immutablex'],
        'ai': ['fetchai', 'render'],
        'other': ['chainlink', 'litecoin', 'ripple', 'stellar', 'cosmos', 'internetcomputer', 'injective', 'algorand', 'vechain', 'graph', 'lido', 'sei', 'toncoin', 'usdcoin', 'eos']
    };
    
    for (const [group, symbols] of Object.entries(CORRELATION_GROUPS)) {
        if (symbols.includes(symbol.toLowerCase())) {
            return group;
        }
    }
    return null;
}

async function debugPositionOpening() {
    console.log(`🔍 DEBUG APERTURA POSIZIONE PER ${SYMBOL.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Verifica bot attivo
        console.log('1️⃣ VERIFICA BOT ATTIVO');
        const botSettings = await dbGet(
            "SELECT * FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
            [SYMBOL, 'RSI_Strategy']
        );
        
        if (!botSettings) {
            console.log(`   ❌ Bot non configurato per ${SYMBOL}`);
            return;
        }
        
        const isActive = botSettings.is_active === 1;
        console.log(`   ${isActive ? '✅' : '❌'} Bot ${isActive ? 'ATTIVO' : 'DISATTIVATO'}`);
        if (!isActive) {
            console.log(`   ⚠️ Il bot è disattivato - questa è la causa principale!`);
            return;
        }
        console.log('');

        // 2. Verifica klines
        console.log('2️⃣ VERIFICA KLINES');
        const klines = await dbAll(
            "SELECT * FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
            [SYMBOL]
        );
        
        if (klines.length < 50) {
            console.log(`   ❌ Klines insufficienti: ${klines.length}/50`);
            return;
        }
        console.log(`   ✅ Klines sufficienti: ${klines.length}`);
        console.log('');

        // 3. Genera segnale
        console.log('3️⃣ GENERAZIONE SEGNALE');
        const historyForSignal = klines.reverse().map(k => ({
            close: parseFloat(k.close_price),
            high: parseFloat(k.high_price),
            low: parseFloat(k.low_price),
            volume: parseFloat(k.volume || 0),
            price: parseFloat(k.close_price),
            timestamp: new Date(parseInt(k.open_time)).toISOString()
        }));

        const signal = signalGenerator.generateSignal(historyForSignal, SYMBOL);
        
        if (!signal || signal.direction === 'NEUTRAL') {
            console.log(`   ❌ Nessun segnale generato`);
            return;
        }

        console.log(`   ✅ Segnale: ${signal.direction}`);
        console.log(`   📊 Strength LONG: ${signal.longSignal?.strength || 0}/100`);
        console.log(`   📊 Strength SHORT: ${signal.shortSignal?.strength || 0}/100`);
        console.log(`   📊 Conferme LONG: ${signal.longSignal?.confirmations || 0}`);
        console.log(`   📊 Conferme SHORT: ${signal.shortSignal?.confirmations || 0}`);
        console.log('');

        // 4. Verifica requisiti minimi
        console.log('4️⃣ VERIFICA REQUISITI MINIMI');
        const longStrength = signal.longSignal?.strength || 0;
        const longConfirmations = signal.longSignal?.confirmations || 0;
        
        console.log(`   LONG: Strength ${longStrength} >= ${MIN_SIGNAL_STRENGTH}? ${longStrength >= MIN_SIGNAL_STRENGTH ? '✅' : '❌'}`);
        console.log(`   LONG: Conferme ${longConfirmations} >= ${MIN_CONFIRMATIONS_LONG}? ${longConfirmations >= MIN_CONFIRMATIONS_LONG ? '✅' : '❌'}`);
        
        if (longStrength < MIN_SIGNAL_STRENGTH) {
            console.log(`   ⚠️ Strength insufficiente: ${longStrength} < ${MIN_SIGNAL_STRENGTH}`);
        }
        if (longConfirmations < MIN_CONFIRMATIONS_LONG) {
            console.log(`   ⚠️ Conferme insufficienti: ${longConfirmations} < ${MIN_CONFIRMATIONS_LONG}`);
        }
        console.log('');

        // 5. Verifica volume 24h
        console.log('5️⃣ VERIFICA VOLUME 24H');
        const marketData = await dbGet(
            "SELECT volume_24h FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1",
            [SYMBOL]
        );
        
        const volume24h = marketData ? parseFloat(marketData.volume_24h) : 0;
        const minVolume = 500000;
        console.log(`   Volume 24h: $${volume24h.toLocaleString()}`);
        console.log(`   Minimo richiesto: $${minVolume.toLocaleString()}`);
        console.log(`   ${volume24h >= minVolume ? '✅' : '❌'} Volume ${volume24h >= minVolume ? 'sufficiente' : 'insufficiente'}`);
        if (volume24h < minVolume) {
            console.log(`   ⚠️ Volume troppo basso: $${volume24h.toLocaleString()} < $${minVolume.toLocaleString()}`);
        }
        console.log('');

        // 6. Verifica Hybrid Strategy
        console.log('6️⃣ VERIFICA HYBRID STRATEGY');
        const allOpenPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        console.log(`   Posizioni aperte totali: ${allOpenPositions.length}`);
        
        const group = getCorrelationGroup(SYMBOL);
        if (group) {
            const CORRELATION_GROUPS = {
                'layer1': ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'avax_usdt', 'near', 'aptos', 'sui'],
                'defi': ['uniswap', 'aave', 'maker', 'compound', 'curve', 'synthetix'],
                'meme': ['dogecoin', 'shiba', 'pepe', 'floki', 'bonk'],
                'layer2': ['arbitrum', 'optimism', 'polygon'],
                'storage': ['filecoin', 'arweave'],
                'gaming': ['sand', 'mana', 'gala', 'immutablex'],
                'ai': ['fetchai', 'render'],
                'other': ['chainlink', 'litecoin', 'ripple', 'stellar', 'cosmos', 'internetcomputer', 'injective', 'algorand', 'vechain', 'graph', 'lido', 'sei', 'toncoin', 'usdcoin', 'eos']
            };
            const groupSymbols = CORRELATION_GROUPS[group];
            const groupPositions = allOpenPositions.filter(p => groupSymbols.includes(p.symbol));
            console.log(`   Gruppo: ${group}`);
            console.log(`   Posizioni nel gruppo: ${groupPositions.length}`);
            
            const MAX_POSITIONS_PER_GROUP = 2;
            if (groupPositions.length >= MAX_POSITIONS_PER_GROUP) {
                console.log(`   ❌ Limite gruppo raggiunto: ${groupPositions.length} >= ${MAX_POSITIONS_PER_GROUP}`);
            } else {
                console.log(`   ✅ Limite gruppo OK: ${groupPositions.length} < ${MAX_POSITIONS_PER_GROUP}`);
            }
        } else {
            console.log(`   ⚠️ Simbolo non in nessun gruppo correlazione`);
        }
        
        const MAX_TOTAL_POSITIONS = 10;
        if (allOpenPositions.length >= MAX_TOTAL_POSITIONS) {
            console.log(`   ⚠️ Limite totale raggiunto: ${allOpenPositions.length} >= ${MAX_TOTAL_POSITIONS}`);
            console.log(`   🔍 Verifica se nuovo segnale è migliore delle posizioni esistenti...`);
            
            // Calcola score nuovo segnale
            const newSignalScore = calculateNewSignalQualityScore(signal, SYMBOL, 'buy');
            console.log(`   📊 Score nuovo segnale: ${newSignalScore.score.toFixed(2)}`);
            
            // Calcola score posizioni esistenti
            const positionScores = [];
            for (const pos of allOpenPositions) {
                const posScore = await calculatePositionQualityScore(pos);
                positionScores.push(posScore);
            }
            positionScores.sort((a, b) => a.score - b.score);
            const worstPosition = positionScores[0];
            
            console.log(`   📊 Score posizione peggiore: ${worstPosition.score.toFixed(2)} (${worstPosition.position.symbol}, P&L: ${worstPosition.pnlPct.toFixed(2)}%)`);
            
            if (newSignalScore.score > worstPosition.score) {
                console.log(`   ✅ Nuovo segnale è MIGLIORE della posizione peggiore`);
            } else {
                console.log(`   ❌ Nuovo segnale NON è migliore della posizione peggiore`);
                console.log(`   ⚠️ Questo blocca l'apertura!`);
            }
        } else {
            console.log(`   ✅ Limite totale OK: ${allOpenPositions.length} < ${MAX_TOTAL_POSITIONS}`);
        }
        console.log('');

        // 7. Verifica Risk Manager
        console.log('7️⃣ VERIFICA RISK MANAGER');
        const portfolio = await dbGet("SELECT balance_usd FROM portfolio WHERE id = 1");
        const cashBalance = parseFloat(portfolio?.balance_usd || 0);
        
        // Calcola exposure corrente
        let currentExposureValue = 0;
        for (const pos of allOpenPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            const remaining = vol - volClosed;
            const entry = parseFloat(pos.entry_price) || 0;
            currentExposureValue += remaining * entry;
        }
        const totalEquity = cashBalance + currentExposureValue;
        
        console.log(`   Cash Balance: $${cashBalance.toFixed(2)}`);
        console.log(`   Exposure corrente: $${currentExposureValue.toFixed(2)}`);
        console.log(`   Total Equity: $${totalEquity.toFixed(2)}`);
        
        const riskCheck = await riskManager.calculateMaxRisk();
        console.log(`   Max Exposure: ${(riskCheck.maxExposurePct * 100).toFixed(1)}%`);
        console.log(`   Current Exposure: ${(riskCheck.currentExposure * 100).toFixed(1)}%`);
        console.log(`   Available Exposure: $${riskCheck.availableExposure.toFixed(2)}`);
        console.log(`   Max Position Size: $${riskCheck.maxPositionSize.toFixed(2)}`);
        
        const canOpen = await riskManager.canOpenPosition(riskCheck.maxPositionSize);
        console.log(`   ${canOpen.allowed ? '✅' : '❌'} Risk Manager: ${canOpen.allowed ? 'PERMETTE' : 'BLOCCA'}`);
        if (!canOpen.allowed) {
            console.log(`   ⚠️ Motivo: ${canOpen.reason}`);
        }
        console.log('');

        // 8. Verifica filtri professionali
        console.log('8️⃣ VERIFICA FILTRI PROFESSIONALI');
        if (signal.professionalAnalysis) {
            const filters = signal.professionalAnalysis.filters || [];
            const blockingFilters = filters.filter(f => f.status === 'blocked');
            const warningFilters = filters.filter(f => f.status === 'warning');
            
            if (blockingFilters.length > 0) {
                console.log(`   ❌ Filtri che bloccano (${blockingFilters.length}):`);
                blockingFilters.forEach(f => {
                    console.log(`      - ${f.type}: ${f.message}`);
                });
            } else {
                console.log(`   ✅ Nessun filtro che blocca`);
            }
            
            if (warningFilters.length > 0) {
                console.log(`   ⚠️ Avvisi (${warningFilters.length}):`);
                warningFilters.forEach(f => {
                    console.log(`      - ${f.type}: ${f.message}`);
                });
            }
        } else {
            console.log(`   ⚠️ Nessuna analisi professionale disponibile`);
        }
        console.log('');

        // 9. Report finale
        console.log('='.repeat(80));
        console.log('📋 REPORT FINALE');
        console.log('='.repeat(80));
        
        const blockers = [];
        if (!isActive) blockers.push('Bot disattivato');
        if (klines.length < 50) blockers.push('Klines insufficienti');
        if (longStrength < MIN_SIGNAL_STRENGTH) blockers.push(`Strength insufficiente (${longStrength} < ${MIN_SIGNAL_STRENGTH})`);
        if (longConfirmations < MIN_CONFIRMATIONS_LONG) blockers.push(`Conferme insufficienti (${longConfirmations} < ${MIN_CONFIRMATIONS_LONG})`);
        if (volume24h < minVolume) blockers.push(`Volume insufficiente ($${volume24h.toLocaleString()} < $${minVolume.toLocaleString()})`);
        if (!canOpen.allowed) blockers.push(`Risk Manager: ${canOpen.reason}`);
        if (signal.professionalAnalysis) {
            const blockingFilters = signal.professionalAnalysis.filters?.filter(f => f.status === 'blocked') || [];
            if (blockingFilters.length > 0) {
                blockers.push(`Filtri professionali: ${blockingFilters.map(f => f.type).join(', ')}`);
            }
        }
        
        if (blockers.length === 0) {
            console.log('✅ TUTTI I CONTROLLI PASSATI - Il bot DOVREBBE aprire la posizione!');
            console.log('   Se non apre, controlla i log del backend per altri problemi.');
        } else {
            console.log('❌ PROBLEMI TROVATI:');
            blockers.forEach((blocker, idx) => {
                console.log(`   ${idx + 1}. ${blocker}`);
            });
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante debug:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugPositionOpening().catch(console.error);

