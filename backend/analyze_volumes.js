/**
 * 📊 Analisi Volumi Trading - Valutazione Convenienza
 * 
 * Analizza i volumi 24h di tutti i simboli e fornisce raccomandazioni
 * su quali sono convenienti per il trading e quali evitare.
 */

const { dbAll, dbGet } = require('./crypto_db');
const https = require('https');

// Soglie di valutazione
const VOLUME_THRESHOLDS = {
    EXCELLENT: 10_000_000,  // >10M USDT: Eccellente liquidità
    GOOD: 5_000_000,        // 5-10M USDT: Buona liquidità
    ACCEPTABLE: 1_000_000,  // 1-5M USDT: Accettabile
    LOW: 500_000,           // 500K-1M USDT: Bassa liquidità (rischio slippage)
    VERY_LOW: 100_000,      // 100K-500K USDT: Molto bassa (alto rischio)
    CRITICAL: 0             // <100K USDT: Critico (evitare)
};

// Importa SYMBOL_TO_PAIR da cryptoRoutes per consistenza
// Per ora usiamo una versione semplificata, ma dovrebbe essere allineata con cryptoRoutes.js
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'ripple': 'XRPUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'binance_coin': 'BNBUSDT',
    'avax_usdt': 'AVAXUSDT',
    'sand': 'SANDUSDT',
    'uniswap': 'UNIUSDT',
    'aave': 'AAVEUSDT',
    'mana': 'MANAUSDT',
    'bonk': 'BONKUSDT',
    'shib': 'SHIBUSDT',
    'shib_eur': 'SHIBEUR',
    'btc_eur': 'BTCEUR',
    'eth_eur': 'ETHEUR',
    'ada_eur': 'ADAEUR',
    'dot_eur': 'DOTEUR',
    'link_eur': 'LINKEUR',
    'ltc_eur': 'LTCEUR',
    'xrp_eur': 'XRPEUR',
    'bnb_eur': 'BNBEUR',
    'sol_eur': 'SOLEUR',
    'avax_eur': 'AVAXEUR',
    'matic_eur': 'MATICEUR',
    'doge_eur': 'DOGEEUR',
    'trx_eur': 'TRXEUR',
    'xlm_eur': 'XLMEUR',
    'atom_eur': 'ATOMEUR',
    'near_eur': 'NEAREUR',
    'sui_eur': 'SUIEUR',
    'arb_eur': 'ARBEUR',
    'op_eur': 'OPEUR',
    'pepe_eur': 'PEPEEUR',
    'gala_eur': 'GALAEUR',
    'uni_eur': 'UNIEUR',
    'pol_polygon': 'MATICUSDT',
    'polpolygon': 'MATICUSDT',
    'matic': 'MATICUSDT',
    'eos': 'EOSUSDT',
    'imx': 'IMXUSDT',
    'sei': 'SEIUSDT',
    'toncoin': 'TONUSDT',
    'arbitrum': 'ARBUSDT',
    'optimism': 'OPUSDT',
    'gala': 'GALAUSDT',
    'pepe': 'PEPEUSDT',
    'floki': 'FLOKIUSDT',
    'fetchai': 'FETUSDT',
    'filecoin': 'FILUSDT',
    'graph': 'GRTUSDT',
    'immutablex': 'IMXUSDT',
    'lido': 'LDOUSDT',
    'synthetix': 'SNXUSDT',
    'usdcoin': 'USDCUSDT',
    'arweave': 'ARUSDT',
    'maker': 'MKRUSDT',
    'compound': 'COMPUSDT',
    'curve': 'CRVUSDT'
};

const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.code || parsed.msg) {
                        reject(new Error(parsed.msg || parsed.code));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
};

const get24hVolume = async (symbol) => {
    try {
        const pair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase().replace('_', '');
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
        
        const data = await httpsGet(url);
        return parseFloat(data.quoteVolume || data.volume || 0); // quoteVolume è in USDT
    } catch (error) {
        console.error(`   ❌ Errore recupero volume per ${symbol}: ${error.message}`);
        return 0;
    }
};

const getVolumeCategory = (volume) => {
    if (volume >= VOLUME_THRESHOLDS.EXCELLENT) return { category: 'EXCELLENT', emoji: '🟢', recommendation: '✅ ECCELLENTE - Trading consigliato' };
    if (volume >= VOLUME_THRESHOLDS.GOOD) return { category: 'GOOD', emoji: '🟢', recommendation: '✅ BUONO - Trading consigliato' };
    if (volume >= VOLUME_THRESHOLDS.ACCEPTABLE) return { category: 'ACCEPTABLE', emoji: '🟡', recommendation: '⚠️ ACCETTABILE - Trading possibile con cautela' };
    if (volume >= VOLUME_THRESHOLDS.LOW) return { category: 'LOW', emoji: '🟠', recommendation: '⚠️ BASSO - Rischio slippage moderato' };
    if (volume >= VOLUME_THRESHOLDS.VERY_LOW) return { category: 'VERY_LOW', emoji: '🔴', recommendation: '❌ MOLTO BASSO - Evitare trading' };
    return { category: 'CRITICAL', emoji: '🔴', recommendation: '❌ CRITICO - NON TRADARE' };
};

const analyzeSymbol = async (symbol) => {
    const volume = await get24hVolume(symbol);
    const category = getVolumeCategory(volume);
    
    // Calcola rischio slippage (stima)
    // Slippage tipico: 0.1% per volumi >10M, 0.5% per 1-10M, 1-2% per <1M
    let slippageRisk = 'Basso';
    if (volume < VOLUME_THRESHOLDS.VERY_LOW) slippageRisk = 'Molto Alto (2-5%)';
    else if (volume < VOLUME_THRESHOLDS.LOW) slippageRisk = 'Alto (1-2%)';
    else if (volume < VOLUME_THRESHOLDS.ACCEPTABLE) slippageRisk = 'Moderato (0.5-1%)';
    else if (volume < VOLUME_THRESHOLDS.GOOD) slippageRisk = 'Basso (0.2-0.5%)';
    else slippageRisk = 'Molto Basso (<0.2%)';
    
    // Calcola se posizione $80-100 è ragionevole
    const positionSize = 80; // $80 USDT
    const positionSizePct = volume > 0 ? (positionSize / volume) * 100 : 100;
    const isPositionReasonable = positionSizePct < 0.01; // <0.01% del volume 24h è ragionevole
    
    return {
        symbol,
        volume,
        volumeFormatted: volume.toLocaleString('it-IT', { maximumFractionDigits: 0 }),
        ...category,
        slippageRisk,
        positionSizePct: positionSizePct.toFixed(4),
        isPositionReasonable,
        shouldTrade: volume >= VOLUME_THRESHOLDS.ACCEPTABLE
    };
};

async function main() {
    console.log('📊 ANALISI VOLUMI TRADING - Valutazione Convenienza\n');
    console.log('='.repeat(80));
    console.log('Soglie di valutazione:');
    console.log(`  🟢 ECCELLENTE: >${(VOLUME_THRESHOLDS.EXCELLENT / 1_000_000).toFixed(0)}M USDT`);
    console.log(`  🟢 BUONO: ${(VOLUME_THRESHOLDS.GOOD / 1_000_000).toFixed(0)}-${(VOLUME_THRESHOLDS.EXCELLENT / 1_000_000).toFixed(0)}M USDT`);
    console.log(`  🟡 ACCETTABILE: ${(VOLUME_THRESHOLDS.ACCEPTABLE / 1_000_000).toFixed(0)}-${(VOLUME_THRESHOLDS.GOOD / 1_000_000).toFixed(0)}M USDT`);
    console.log(`  🟠 BASSO: ${(VOLUME_THRESHOLDS.LOW / 1_000_000).toFixed(1)}-${(VOLUME_THRESHOLDS.ACCEPTABLE / 1_000_000).toFixed(0)}M USDT`);
    console.log(`  🔴 MOLTO BASSO: ${(VOLUME_THRESHOLDS.VERY_LOW / 1_000_000).toFixed(1)}-${(VOLUME_THRESHOLDS.LOW / 1_000_000).toFixed(1)}M USDT`);
    console.log(`  🔴 CRITICO: <${(VOLUME_THRESHOLDS.VERY_LOW / 1_000_000).toFixed(1)}M USDT`);
    console.log('='.repeat(80));
    console.log('\n🔍 Recupero simboli attivi dal database...\n');
    
    try {
        // Escludi simboli invalidi come 'global'
        const activeSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE is_active = 1 AND symbol != 'global' ORDER BY symbol"
        );
        
        if (activeSymbols.length === 0) {
            console.log('❌ Nessun simbolo attivo trovato nel database');
            return;
        }
        
        console.log(`📋 Trovati ${activeSymbols.length} simboli attivi\n`);
        console.log('⏳ Analisi volumi in corso...\n');
        
        const results = [];
        for (const row of activeSymbols) {
            const symbol = row.symbol;
            process.stdout.write(`   Analizzando ${symbol}... `);
            const analysis = await analyzeSymbol(symbol);
            results.push(analysis);
            console.log(`${analysis.emoji} ${analysis.volumeFormatted} USDT`);
            // Pausa per evitare rate limit
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 RISULTATI ANALISI\n');
        
        // Raggruppa per categoria
        const byCategory = {
            EXCELLENT: [],
            GOOD: [],
            ACCEPTABLE: [],
            LOW: [],
            VERY_LOW: [],
            CRITICAL: []
        };
        
        results.forEach(r => {
            byCategory[r.category].push(r);
        });
        
        // Mostra risultati per categoria
        const categories = ['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'LOW', 'VERY_LOW', 'CRITICAL'];
        categories.forEach(cat => {
            if (byCategory[cat].length > 0) {
                const emoji = byCategory[cat][0].emoji;
                console.log(`\n${emoji} ${cat} (${byCategory[cat].length} simboli):`);
                byCategory[cat].forEach(r => {
                    console.log(`   ${r.symbol.padEnd(20)} ${r.volumeFormatted.padStart(12)} USDT | ${r.recommendation}`);
                    console.log(`   ${' '.repeat(20)} Rischio Slippage: ${r.slippageRisk} | Posizione $80 = ${r.positionSizePct}% del volume`);
                });
            }
        });
        
        // Riepilogo
        console.log('\n' + '='.repeat(80));
        console.log('📈 RIEPILOGO\n');
        
        const recommended = results.filter(r => r.shouldTrade).length;
        const notRecommended = results.length - recommended;
        
        console.log(`✅ Simboli CONSIGLIATI per trading: ${recommended}/${results.length}`);
        console.log(`❌ Simboli da EVITARE: ${notRecommended}/${results.length}\n`);
        
        console.log('💡 RACCOMANDAZIONI:\n');
        console.log('1. ✅ TRADARE solo simboli con volume ≥ 1M USDT (categorie EXCELLENT, GOOD, ACCEPTABLE)');
        console.log('2. ⚠️  EVITARE simboli con volume < 1M USDT (rischio slippage alto)');
        console.log('3. 🔴 DISATTIVARE simboli con volume < 500K USDT (critico)');
        console.log('4. 📊 Considera di aumentare MIN_VOLUME_24H a 1,000,000 USDT per filtrare automaticamente');
        console.log('5. 💰 Con posizioni da $80-100, preferisci simboli con volume > 5M USDT per minimizzare slippage\n');
        
        // Lista simboli da disattivare
        const toDisable = results.filter(r => !r.shouldTrade);
        if (toDisable.length > 0) {
            console.log('🚫 SIMBOLI DA DISATTIVARE (volume < 1M USDT):');
            toDisable.forEach(r => {
                console.log(`   - ${r.symbol} (${r.volumeFormatted} USDT)`);
            });
        }
        
    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error.message);
        console.error(error.stack);
    }
}

main().catch(console.error);

