/**
 * Script per ripopolare prezzi e volumi dal WebSocket
 * 
 * Questo script:
 * 1. Si connette al WebSocket di Binance
 * 2. Attende che i dati arrivino (prezzi e volumi)
 * 3. Salva tutto nel database
 * 4. Dopo 5 minuti, mostra statistiche e termina
 * 
 * Utile quando l'IP è bannato e si vuole ripopolare il database con dati real-time
 */

const cryptoDb = require('../crypto_db');
const { dbRun, dbAll } = cryptoDb;
const BinanceWebSocketService = require('../services/BinanceWebSocket');

// Statistiche
const stats = {
    pricesSaved: 0,
    volumesSaved: 0,
    symbolsProcessed: new Set(),
    errors: 0,
    startTime: Date.now()
};

// Mappa simboli -> trading pair (usa quella principale)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT',
    'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT',
    'solana': 'SOLUSDT', 'sol': 'SOLUSDT',
    'cardano': 'ADAUSDT', 'ada': 'ADAUSDT',
    'ripple': 'XRPUSDT', 'xrp': 'XRPUSDT',
    'polkadot': 'DOTUSDT', 'dot': 'DOTUSDT',
    'dogecoin': 'DOGEUSDT', 'doge': 'DOGEUSDT',
    'avalanche': 'AVAXUSDT', 'avax': 'AVAXUSDT',
    'binance_coin': 'BNBUSDT', 'bnb': 'BNBUSDT',
    'chainlink': 'LINKUSDT', 'link': 'LINKUSDT',
    'litecoin': 'LTCUSDT', 'ltc': 'LTCUSDT',
    'matic': 'POLUSDT', 'polygon': 'POLUSDT',
    'ton': 'TONUSDT', 'tron': 'TRXUSDT', 'trx': 'TRXUSDT',
    'stellar': 'XLMUSDT', 'xlm': 'XLMUSDT',
    'cosmos': 'ATOMUSDT', 'atom': 'ATOMUSDT',
    'uniswap': 'UNIUSDT', 'uni': 'UNIUSDT',
    'optimism': 'OPUSDT', 'op': 'OPUSDT',
    'the_sandbox': 'SANDUSDT', 'sand': 'SANDUSDT',
    'decentraland': 'MANAUSDT', 'mana': 'MANAUSDT',
    'axie_infinity': 'AXSUSDT', 'axs': 'AXSUSDT',
    'icp': 'ICPUSDT', 'aave': 'AAVEUSDT', 'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT', 'mkr': 'MKRUSDT', 'comp': 'COMPUSDT',
    'snx': 'SNXUSDT', 'arb': 'ARBUSDT', 'apt': 'APTUSDT',
    'sei': 'SEIUSDT', 'inj': 'INJUSDT', 'fet': 'FETUSDT',
    'render': 'RENDERUSDT', 'grt': 'GRTUSDT', 'imx': 'IMXUSDT',
    'enj': 'ENJUSDT', 'pepe': 'PEPEUSDT', 'floki': 'FLOKIUSDT',
    'bonk': 'BONKUSDT', 'ar': 'ARUSDT'
};

async function savePrice(symbol, price) {
    try {
        // Valida prezzo
        if (!price || price <= 0 || price > 100000 || price < 0.000001) {
            return false;
        }
        
        await dbRun(
            `INSERT INTO price_history (symbol, price, timestamp) 
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT DO NOTHING`,
            [symbol, price]
        );
        
        stats.pricesSaved++;
        stats.symbolsProcessed.add(symbol);
        return true;
    } catch (error) {
        stats.errors++;
        if (stats.errors < 10) {
            console.error(`❌ Errore salvataggio prezzo ${symbol}:`, error.message);
        }
        return false;
    }
}

async function saveVolume(symbol, volume24h) {
    try {
        if (!volume24h || volume24h <= 0) {
            return false;
        }
        
        await dbRun(
            `INSERT INTO symbol_volumes_24h (symbol, volume_24h, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (symbol) 
             DO UPDATE SET volume_24h = EXCLUDED.volume_24h, updated_at = CURRENT_TIMESTAMP`,
            [symbol, volume24h]
        );
        
        stats.volumesSaved++;
        return true;
    } catch (error) {
        stats.errors++;
        if (stats.errors < 10) {
            console.error(`❌ Errore salvataggio volume ${symbol}:`, error.message);
        }
        return false;
    }
}

async function repopulateFromWebSocket() {
    console.log('🔧 RIPOPOLAZIONE DATI DA WEBSOCKET');
    console.log('==================================');
    console.log('');
    console.log('📡 Connessione al WebSocket di Binance...');
    console.log('⏱️  Attendo 5 minuti per raccogliere dati...');
    console.log('');
    
    // Inizializza database
    await cryptoDb.initDb();
    console.log('✅ Database inizializzato');
    console.log('');
    
    // Crea WebSocket service
    const wsService = new BinanceWebSocketService(
        // Callback prezzi
        async (symbol, price) => {
            await savePrice(symbol, price);
            
            // Log ogni 50 prezzi salvati
            if (stats.pricesSaved % 50 === 0) {
                console.log(`💾 Prezzi salvati: ${stats.pricesSaved} | Volumi salvati: ${stats.volumesSaved} | Simboli: ${stats.symbolsProcessed.size}`);
            }
        },
        // Callback volumi
        async (symbol, volume24h) => {
            await saveVolume(symbol, volume24h);
        }
    );
    
    // Imposta mappa simboli
    wsService.setSymbolToPairMap(SYMBOL_TO_PAIR);
    
    // Connetti WebSocket
    try {
        await wsService.connect();
        console.log('✅ WebSocket connesso!');
        console.log('');
    } catch (error) {
        console.error('❌ Errore connessione WebSocket:', error.message);
        process.exit(1);
    }
    
    // Attendi 5 minuti
    const DURATION_MS = 5 * 60 * 1000; // 5 minuti
    const startTime = Date.now();
    
    // Mostra progresso ogni 30 secondi
    const progressInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.floor((DURATION_MS - (Date.now() - startTime)) / 1000);
        console.log(`⏱️  Elapsed: ${elapsed}s | Remaining: ${remaining}s | Prezzi: ${stats.pricesSaved} | Volumi: ${stats.volumesSaved} | Simboli: ${stats.symbolsProcessed.size}`);
    }, 30000);
    
    // Attendi completamento
    await new Promise(resolve => setTimeout(resolve, DURATION_MS));
    
    clearInterval(progressInterval);
    
    // Disconnetti WebSocket
    wsService.disconnect();
    
    // Mostra statistiche finali
    console.log('');
    console.log('📊 STATISTICHE FINALI');
    console.log('=====================');
    console.log(`⏱️  Durata: ${Math.floor((Date.now() - startTime) / 1000)}s`);
    console.log(`💾 Prezzi salvati: ${stats.pricesSaved}`);
    console.log(`📊 Volumi salvati: ${stats.volumesSaved}`);
    console.log(`🔢 Simboli processati: ${stats.symbolsProcessed.size}`);
    console.log(`❌ Errori: ${stats.errors}`);
    console.log('');
    
    // Mostra top 20 simboli per volume
    try {
        const topVolumes = await dbAll(
            `SELECT symbol, volume_24h, updated_at 
             FROM symbol_volumes_24h 
             ORDER BY volume_24h DESC 
             LIMIT 20`
        );
        
        if (topVolumes.length > 0) {
            console.log('📊 TOP 20 VOLUMI SALVATI:');
            topVolumes.forEach((v, idx) => {
                console.log(`   ${idx + 1}. ${v.symbol}: $${parseFloat(v.volume_24h).toLocaleString('it-IT')} USDT`);
            });
        }
    } catch (error) {
        console.error('❌ Errore recupero top volumi:', error.message);
    }
    
    console.log('');
    console.log('✅ Ripopolazione completata!');
}

// Esegui se chiamato direttamente
if (require.main === module) {
    repopulateFromWebSocket()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Errore:', error);
            process.exit(1);
        });
}

module.exports = repopulateFromWebSocket;

