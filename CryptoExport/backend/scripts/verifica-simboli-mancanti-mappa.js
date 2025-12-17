/**
 * 🔍 VERIFICA SIMBOLI MANCANTI NELLA MAPPA SYMBOL_TO_PAIR
 * 
 * Questo script identifica tutti i simboli presenti nel database
 * che NON sono presenti nella mappa SYMBOL_TO_PAIR.
 * 
 * Database: PostgreSQL
 */

const { dbAll } = require('../crypto_db');

// Mappa SYMBOL_TO_PAIR dal codice (copiata da cryptoRoutes.js)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT', 'bitcoin_usdt': 'BTCUSDT', 'bitcoin_eur': 'BTCEUR', 'btcusdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT', 'ethereum_usdt': 'ETHUSDT', 'ethusdt': 'ETHUSDT',
    'solana': 'SOLUSDT', 'sol': 'SOLUSDT', 'solana_eur': 'SOLUSDT', 'solana_usdt': 'SOLUSDT', 'solusdt': 'SOLUSDT',
    'ripple': 'XRPUSDT', 'xrp': 'XRPUSDT', 'ripple_eur': 'XRPEUR', 'xrp_eur': 'XRPEUR', 'ripple_usdt': 'XRPUSDT', 'xrpusdt': 'XRPUSDT',
    'binance_coin': 'BNBUSDT', 'bnb': 'BNBUSDT', 'binance_coin_eur': 'BNBUSDT', 'bnbusdt': 'BNBUSDT',
    'cardano': 'ADAUSDT', 'ada': 'ADAUSDT', 'cardano_usdt': 'ADAUSDT', 'adausdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT', 'dot': 'DOTUSDT', 'polkadot_usdt': 'DOTUSDT', 'dotusdt': 'DOTUSDT',
    'avalanche': 'AVAXUSDT', 'avax': 'AVAXUSDT', 'avalanche_eur': 'AVAXEUR', 'avax_usdt': 'AVAXUSDT', 'avaxusdt': 'AVAXUSDT',
    'near': 'NEARUSDT', 'near_eur': 'NEAREUR', 'nearusdt': 'NEARUSDT',
    'atom_eur': 'ATOMEUR', 'cosmos': 'ATOMUSDT', 'atom': 'ATOMUSDT',
    'sui_eur': 'SUIUSDT',
    'apt': 'APTUSDT',
    'ton': 'TONUSDT',
    'icp': 'ICPUSDT',
    'uniswap': 'UNIUSDT', 'uni': 'UNIUSDT', 'uniswap_eur': 'UNIEUR', 'uniusdt': 'UNIUSDT',
    'chainlink': 'LINKUSDT', 'link': 'LINKUSDT', 'chainlink_usdt': 'LINKUSDT', 'linkusdt': 'LINKUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'mkr': 'MKRUSDT',
    'comp': 'COMPUSDT',
    'snx': 'SNXUSDT',
    'arb': 'ARBUSDT', 'arb_eur': 'ARBUSDT', 'arbitrum': 'ARBUSDT', 'arbusdt': 'ARBUSDT',
    'op': 'OPUSDT', 'op_eur': 'OPUSDT', 'optimism': 'OPUSDT', 'opusdt': 'OPUSDT',
    'matic': 'POLUSDT', 'matic_eur': 'POLUSDT', 'polygon': 'POLUSDT', 'maticusdt': 'POLUSDT', 
    'pol': 'POLUSDT', 'pol_polygon': 'POLUSDT', 'pol_polygon_eur': 'POLEUR', 'polpolygon': 'POLUSDT', 'polusdt': 'POLUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm_eur': 'XLMUSDT',
    'fet': 'FETUSDT',
    'render': 'RENDERUSDT',
    'grt': 'GRTUSDT',
    'sand': 'SANDUSDT', 'the_sandbox': 'SANDUSDT', 'thesandbox': 'SANDUSDT', 'sandusdt': 'SANDUSDT',
    'mana': 'MANAUSDT', 'decentraland': 'MANAUSDT', 'manausdt': 'MANAUSDT',
    'axs': 'AXSUSDT', 'axie_infinity': 'AXSUSDT', 'axsusdt': 'AXSUSDT',
    'gala': 'GALAUSDT', 'galausdt': 'GALAUSDT',
    'imx': 'IMXUSDT', 'imxusdt': 'IMXUSDT',
    'enj': 'ENJUSDT', 'enj_eur': 'ENJUSDT', 'enjusdt': 'ENJUSDT',
    'theta': 'THETAUSDT', 'theta_network': 'THETAUSDT', 'thetanetwork': 'THETAUSDT', 'thetausdt': 'THETAUSDT',
    'pepe': 'PEPEUSDT', 'pepe_eur': 'PEPEUSDT', 'pepeusdt': 'PEPEUSDT',
    'dogecoin': 'DOGEUSDT', 'doge': 'DOGEUSDT', 'dogecoin_eur': 'DOGEUSDT', 'dogeusdt': 'DOGEUSDT',
    'shiba_inu': 'SHIBUSDT', 'shib': 'SHIBUSDT', 'shiba_eur': 'SHIBUSDT', 'shibusdt': 'SHIBUSDT',
    'floki': 'FLOKIUSDT', 'flokiusdt': 'FLOKIUSDT',
    'bonk': 'BONKUSDT', 'bonkusdt': 'BONKUSDT',
    'fil': 'FILUSDT',
    'ar': 'ARUSDT',
    'sei': 'SEIUSDT',
    'inj': 'INJUSDT',
    'usdc': 'USDCUSDT',
    'flow': 'FLOWUSDT', 'flowusdt': 'FLOWUSDT'
};

async function verificaSimboliMancanti() {
    console.log('🔍 VERIFICA SIMBOLI MANCANTI NELLA MAPPA SYMBOL_TO_PAIR\n');
    console.log('='.repeat(80));
    console.log('');


    try {
        // 1. Ottieni tutti i simboli unici dal database
        console.log('📊 1. RACCOLTA SIMBOLI DAL DATABASE');
        console.log('-'.repeat(80));

        // Simboli da klines
        const klinesSymbols = await dbAll(`
            SELECT DISTINCT symbol 
            FROM klines 
            WHERE symbol IS NOT NULL 
            ORDER BY symbol
        `);

        // Simboli da price_history
        const priceHistorySymbols = await dbAll(`
            SELECT DISTINCT symbol 
            FROM price_history 
            WHERE symbol IS NOT NULL 
            ORDER BY symbol
        `);

        // Simboli da open_positions
        const openPositionsSymbols = await dbAll(`
            SELECT DISTINCT symbol 
            FROM open_positions 
            WHERE symbol IS NOT NULL 
            ORDER BY symbol
        `);

        // Simboli da bot_settings
        const botSettingsSymbols = await dbAll(`
            SELECT DISTINCT symbol 
            FROM bot_settings 
            WHERE symbol IS NOT NULL AND symbol != 'global'
            ORDER BY symbol
        `);

        // Simboli da symbol_volumes_24h
        const volumesSymbols = await dbAll(`
            SELECT DISTINCT symbol 
            FROM symbol_volumes_24h 
            WHERE symbol IS NOT NULL 
            ORDER BY symbol
        `);

        // Unisci tutti i simboli
        const allDbSymbols = new Set();
        [klinesSymbols, priceHistorySymbols, openPositionsSymbols, botSettingsSymbols, volumesSymbols].forEach(symbols => {
            symbols.forEach(row => {
                if (row.symbol) {
                    allDbSymbols.add(row.symbol.toLowerCase().trim());
                }
            });
        });

        console.log(`   ✅ Simboli trovati nel database: ${allDbSymbols.size}`);
        console.log(`      - Klines: ${klinesSymbols.length}`);
        console.log(`      - Price History: ${priceHistorySymbols.length}`);
        console.log(`      - Open Positions: ${openPositionsSymbols.length}`);
        console.log(`      - Bot Settings: ${botSettingsSymbols.length}`);
        console.log(`      - Volumes 24h: ${volumesSymbols.length}`);
        console.log('');

        // 2. Verifica quali simboli NON sono nella mappa
        console.log('🔍 2. VERIFICA SIMBOLI MANCANTI NELLA MAPPA');
        console.log('-'.repeat(80));

        const missingSymbols = [];
        const foundSymbols = [];

        allDbSymbols.forEach(symbol => {
            if (!SYMBOL_TO_PAIR[symbol]) {
                missingSymbols.push(symbol);
            } else {
                foundSymbols.push(symbol);
            }
        });

        console.log(`   ✅ Simboli presenti nella mappa: ${foundSymbols.length}`);
        console.log(`   ❌ Simboli MANCANTI nella mappa: ${missingSymbols.length}`);
        console.log('');

        // 3. Dettaglio simboli mancanti
        if (missingSymbols.length > 0) {
            console.log('🚨 3. SIMBOLI MANCANTI NELLA MAPPA (CRITICO!)');
            console.log('-'.repeat(80));
            console.log('');

            // Raggruppa per categoria
            const eurSymbols = missingSymbols.filter(s => s.includes('_eur') || s.endsWith('eur'));
            const usdtSymbols = missingSymbols.filter(s => s.includes('_usdt') || s.endsWith('usdt'));
            const otherSymbols = missingSymbols.filter(s => !s.includes('_eur') && !s.includes('_usdt') && !s.endsWith('eur') && !s.endsWith('usdt'));

            if (eurSymbols.length > 0) {
                console.log('   📊 Simboli EUR mancanti:');
                eurSymbols.forEach(s => {
                    // Prova a dedurre il trading pair
                    const base = s.replace(/_eur$/, '').replace(/eur$/, '');
                    const suggestedPair = base.toUpperCase() + 'EUR';
                    console.log(`      ❌ ${s.padEnd(30)} → SUGGERITO: ${suggestedPair}`);
                });
                console.log('');
            }

            if (usdtSymbols.length > 0) {
                console.log('   📊 Simboli USDT mancanti:');
                usdtSymbols.forEach(s => {
                    const base = s.replace(/_usdt$/, '').replace(/usdt$/, '');
                    const suggestedPair = base.toUpperCase() + 'USDT';
                    console.log(`      ❌ ${s.padEnd(30)} → SUGGERITO: ${suggestedPair}`);
                });
                console.log('');
            }

            if (otherSymbols.length > 0) {
                console.log('   📊 Altri simboli mancanti:');
                otherSymbols.forEach(s => {
                    console.log(`      ❌ ${s.padEnd(30)} → RICHIEDE VERIFICA MANUALE`);
                });
                console.log('');
            }

            // 4. Verifica dove sono usati questi simboli
            console.log('📋 4. DOVE SONO USATI I SIMBOLI MANCANTI');
            console.log('-'.repeat(80));
            console.log('');

            for (const symbol of missingSymbols.slice(0, 10)) { // Limita a 10 per performance
                const inKlines = klinesSymbols.some(s => s.symbol?.toLowerCase() === symbol);
                const inPriceHistory = priceHistorySymbols.some(s => s.symbol?.toLowerCase() === symbol);
                const inOpenPositions = openPositionsSymbols.some(s => s.symbol?.toLowerCase() === symbol);
                const inBotSettings = botSettingsSymbols.some(s => s.symbol?.toLowerCase() === symbol);
                const inVolumes = volumesSymbols.some(s => s.symbol?.toLowerCase() === symbol);

                const locations = [];
                if (inKlines) locations.push('klines');
                if (inPriceHistory) locations.push('price_history');
                if (inOpenPositions) locations.push('open_positions');
                if (inBotSettings) locations.push('bot_settings');
                if (inVolumes) locations.push('symbol_volumes_24h');

                if (locations.length > 0) {
                    console.log(`   ${symbol.padEnd(30)} → Usato in: ${locations.join(', ')}`);
                }
            }
            console.log('');

            // 5. Genera codice per aggiungere simboli mancanti
            console.log('💻 5. CODICE SUGGERITO PER AGGIUNGERE SIMBOLI MANCANTI');
            console.log('-'.repeat(80));
            console.log('');
            console.log('// Aggiungi alla mappa SYMBOL_TO_PAIR in backend/routes/cryptoRoutes.js:');
            console.log('');

            const eurToAdd = eurSymbols.map(s => {
                const base = s.replace(/_eur$/, '').replace(/eur$/, '');
                const pair = base.toUpperCase() + 'EUR';
                return `    '${s}': '${pair}',`;
            });

            const usdtToAdd = usdtSymbols.map(s => {
                const base = s.replace(/_usdt$/, '').replace(/usdt$/, '');
                const pair = base.toUpperCase() + 'USDT';
                return `    '${s}': '${pair}',`;
            });

            if (eurToAdd.length > 0) {
                console.log('// Simboli EUR:');
                eurToAdd.forEach(line => console.log(line));
                console.log('');
            }

            if (usdtToAdd.length > 0) {
                console.log('// Simboli USDT:');
                usdtToAdd.forEach(line => console.log(line));
                console.log('');
            }

        } else {
            console.log('✅ 3. NESSUN SIMBOLO MANCANTE!');
            console.log('');
            console.log('   Tutti i simboli nel database sono presenti nella mappa SYMBOL_TO_PAIR.');
            console.log('');
        }

        // 6. Statistiche
        console.log('📊 6. STATISTICHE');
        console.log('-'.repeat(80));
        console.log(`   - Totale simboli nel database: ${allDbSymbols.size}`);
        console.log(`   - Simboli nella mappa: ${Object.keys(SYMBOL_TO_PAIR).length}`);
        console.log(`   - Simboli mancanti: ${missingSymbols.length}`);
        console.log(`   - Coverage: ${((foundSymbols.length / allDbSymbols.size) * 100).toFixed(1)}%`);
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante verifica:', error.message);
        console.error(error.stack);
    }

    console.log('='.repeat(80));
    console.log('✅ Verifica completata');
}

// Esegui verifica
verificaSimboliMancanti().catch(console.error);
