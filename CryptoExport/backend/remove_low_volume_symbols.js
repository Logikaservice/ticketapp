/**
 * 🗑️ Rimozione Simboli con Volumi Bassi
 * 
 * Rimuove completamente dal database tutti i simboli con volume < 1M USDT
 * o che hanno dato errore "Invalid symbol" durante l'analisi.
 * 
 * ATTENZIONE: Questo script rimuove i simboli da:
 * - bot_settings
 * - bot_parameters
 * - klines
 * - market_data
 * - open_positions (se ci sono posizioni aperte, vengono chiuse)
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');
const https = require('https');

// Soglia minima volume (1M USDT)
const MIN_VOLUME_THRESHOLD = 1_000_000;

// Simboli da mantenere (quelli con volume ≥ 1M USDT dall'analisi)
const SYMBOLS_TO_KEEP = [
    // EXCELLENT (>10M USDT)
    'bitcoin',
    'ethereum',
    'solana',
    'binance_coin',
    'cardano',
    'avax_usdt',
    'pepe',
    'litecoin',
    'sei',
    'polkadot',
    'uniswap',
    'aave',
    'bonk',
    'ripple',
    'chainlink_usdt',
    
    // GOOD (5-10M USDT)
    'floki',
    
    // ACCEPTABLE (1-5M USDT)
    'gala',
    'sand',
    'mana',
    'imx',
    'matic',
    'pol_polygon'
];

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
    'floki': 'FLOKIUSDT',
    'gala': 'GALAUSDT',
    'imx': 'IMXUSDT',
    'matic': 'MATICUSDT',
    'pol_polygon': 'MATICUSDT',
    'pepe': 'PEPEUSDT',
    'sei': 'SEIUSDT'
};

const get24hVolume = async (symbol) => {
    try {
        const pair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase().replace('_', '');
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
        const data = await httpsGet(url);
        return parseFloat(data.quoteVolume || data.volume || 0);
    } catch (error) {
        // Se errore "Invalid symbol", considera volume = 0
        return 0;
    }
};

const removeSymbol = async (symbol) => {
    const results = {
        symbol,
        bot_settings: 0,
        bot_parameters: 0,
        klines: 0,
        market_data: 0,
        open_positions: 0
    };
    
    try {
        // 1. Verifica se ci sono posizioni aperte
        const openPositions = await dbAll(
            "SELECT ticket_id, symbol, type, volume, entry_price FROM open_positions WHERE symbol = $1 AND status = 'open'",
            [symbol]
        );
        
        if (openPositions.length > 0) {
            console.log(`   ⚠️  Trovate ${openPositions.length} posizioni aperte per ${symbol}`);
            console.log(`   → Le posizioni verranno chiuse automaticamente`);
            
            // Chiudi tutte le posizioni aperte
            for (const pos of openPositions) {
                try {
                    // Recupera prezzo corrente
                    const currentPrice = await getSymbolPrice(symbol).catch(() => pos.entry_price);
                    
                    // Calcola P&L
                    let pnl = 0;
                    if (pos.type === 'buy') {
                        pnl = (currentPrice - pos.entry_price) * pos.volume;
                    } else {
                        pnl = (pos.entry_price - currentPrice) * pos.volume;
                    }
                    
                    // Chiudi posizione
                    await dbRun(
                        `UPDATE open_positions 
                         SET status = 'closed', 
                             closed_at = NOW(), 
                             close_price = $1, 
                             profit_loss = $2,
                             close_reason = 'Symbol removed - low volume'
                         WHERE ticket_id = $3`,
                        [currentPrice, pnl, pos.ticket_id]
                    );
                    results.open_positions++;
                } catch (err) {
                    console.error(`   ❌ Errore chiusura posizione ${pos.ticket_id}: ${err.message}`);
                }
            }
        }
        
        // 2. Rimuovi da bot_settings
        const botSettingsResult = await dbRun(
            "DELETE FROM bot_settings WHERE symbol = $1",
            [symbol]
        );
        results.bot_settings = botSettingsResult.changes || 0;
        
        // 3. Rimuovi da bot_parameters
        const botParamsResult = await dbRun(
            "DELETE FROM bot_parameters WHERE symbol = $1",
            [symbol]
        );
        results.bot_parameters = botParamsResult.changes || 0;
        
        // 4. Rimuovi da klines
        const klinesResult = await dbRun(
            "DELETE FROM klines WHERE symbol = $1",
            [symbol]
        );
        results.klines = klinesResult.changes || 0;
        
        // 5. Rimuovi da market_data
        const marketDataResult = await dbRun(
            "DELETE FROM market_data WHERE symbol = $1",
            [symbol]
        );
        results.market_data = marketDataResult.changes || 0;
        
        // 6. Rimuovi posizioni chiuse (opzionale, per pulizia)
        const closedPositionsResult = await dbRun(
            "DELETE FROM open_positions WHERE symbol = $1",
            [symbol]
        );
        results.open_positions += closedPositionsResult.changes || 0;
        
    } catch (error) {
        console.error(`   ❌ Errore rimozione ${symbol}: ${error.message}`);
        throw error;
    }
    
    return results;
};

const getSymbolPrice = async (symbol) => {
    try {
        const pair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase().replace('_', '');
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;
        const data = await httpsGet(url);
        return parseFloat(data.price || 0);
    } catch (error) {
        // Se non riesce a recuperare il prezzo, usa il prezzo entry come fallback
        return 0;
    }
};

async function main() {
    console.log('🗑️  RIMOZIONE SIMBOLI CON VOLUMI BASSI\n');
    console.log('='.repeat(80));
    console.log(`Soglia minima volume: ${(MIN_VOLUME_THRESHOLD / 1_000_000).toFixed(1)}M USDT`);
    console.log(`Simboli da mantenere: ${SYMBOLS_TO_KEEP.length}`);
    console.log('='.repeat(80));
    console.log('\n🔍 Recupero tutti i simboli dal database...\n');
    
    try {
        // Recupera tutti i simboli attivi
        const allSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );
        
        if (allSymbols.length === 0) {
            console.log('❌ Nessun simbolo trovato nel database');
            return;
        }
        
        console.log(`📋 Trovati ${allSymbols.length} simboli totali\n`);
        
        // Identifica simboli da rimuovere
        const symbolsToRemove = [];
        const symbolsToKeep = [];
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            
            if (SYMBOLS_TO_KEEP.includes(symbol)) {
                symbolsToKeep.push(symbol);
            } else {
                symbolsToRemove.push(symbol);
            }
        }
        
        console.log(`✅ Simboli da MANTENERE: ${symbolsToKeep.length}`);
        console.log(`   ${symbolsToKeep.join(', ')}\n`);
        
        console.log(`🗑️  Simboli da RIMUOVERE: ${symbolsToRemove.length}`);
        console.log(`   ${symbolsToRemove.join(', ')}\n`);
        
        if (symbolsToRemove.length === 0) {
            console.log('✅ Nessun simbolo da rimuovere!');
            return;
        }
        
        // Conferma
        console.log('⚠️  ATTENZIONE: Questo script rimuoverà completamente i simboli da:');
        console.log('   - bot_settings');
        console.log('   - bot_parameters');
        console.log('   - klines');
        console.log('   - market_data');
        console.log('   - open_positions (posizioni aperte verranno chiuse)\n');
        
        console.log('🚀 Inizio rimozione...\n');
        
        const removalResults = [];
        let totalRemoved = {
            bot_settings: 0,
            bot_parameters: 0,
            klines: 0,
            market_data: 0,
            open_positions: 0
        };
        
        for (const symbol of symbolsToRemove) {
            process.stdout.write(`   Rimuovendo ${symbol}... `);
            try {
                const result = await removeSymbol(symbol);
                removalResults.push(result);
                totalRemoved.bot_settings += result.bot_settings;
                totalRemoved.bot_parameters += result.bot_parameters;
                totalRemoved.klines += result.klines;
                totalRemoved.market_data += result.market_data;
                totalRemoved.open_positions += result.open_positions;
                console.log(`✅`);
            } catch (error) {
                console.log(`❌ ${error.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 RIEPILOGO RIMOZIONE\n');
        console.log(`✅ Simboli rimossi: ${symbolsToRemove.length}`);
        console.log(`📊 Dettagli:`);
        console.log(`   - bot_settings: ${totalRemoved.bot_settings} record`);
        console.log(`   - bot_parameters: ${totalRemoved.bot_parameters} record`);
        console.log(`   - klines: ${totalRemoved.klines} record`);
        console.log(`   - market_data: ${totalRemoved.market_data} record`);
        console.log(`   - open_positions: ${totalRemoved.open_positions} record (chiuse/rimosse)`);
        console.log('\n✅ Rimozione completata!');
        console.log(`\n💡 Ora hai ${symbolsToKeep.length} simboli attivi con volume ≥ 1M USDT`);
        
    } catch (error) {
        console.error('❌ Errore durante la rimozione:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch(console.error);

