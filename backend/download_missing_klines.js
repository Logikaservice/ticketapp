/**
 * 🔍 Identifica simboli con klines insufficienti e li scarica
 */

const { dbAll } = require('./crypto_db');
const { spawn } = require('child_process');

async function findAndDownloadMissingKlines() {
    console.log(`\n📊 VERIFICA KLINES SIMBOLI`);
    console.log('='.repeat(70));
    
    try {
        // Trova tutti i simboli nel database
        const allSymbols = await dbAll(
            `SELECT symbol, COUNT(*) as klines_count
             FROM klines 
             WHERE interval = '15m'
             GROUP BY symbol
             ORDER BY klines_count ASC`
        );
        
        console.log(`\n📊 Stato klines per ${allSymbols.length} simboli:`);
        
        const MIN_KLINES_REQUIRED = 1000; // Minimo per analisi affidabile
        const symbolsNeedingDownload = [];
        
        allSymbols.forEach(row => {
            const status = row.klines_count >= MIN_KLINES_REQUIRED ? '✅' : '⚠️';
            console.log(`   ${status} ${row.symbol.padEnd(25)}: ${row.klines_count.toString().padStart(5)} klines`);
            
            if (row.klines_count < MIN_KLINES_REQUIRED) {
                symbolsNeedingDownload.push(row.symbol);
            }
        });
        
        console.log(`\n📊 Riepilogo:`);
        console.log(`   ✅ Simboli con dati sufficienti: ${allSymbols.length - symbolsNeedingDownload.length}`);
        console.log(`   ⚠️ Simboli da aggiornare: ${symbolsNeedingDownload.length}`);
        
        if (symbolsNeedingDownload.length > 0) {
            console.log(`\n📥 Simboli che necessitano download (< ${MIN_KLINES_REQUIRED} klines):`);
            symbolsNeedingDownload.forEach(symbol => {
                const count = allSymbols.find(s => s.symbol === symbol).klines_count;
                console.log(`   - ${symbol} (attuale: ${count})`);
            });
            
            console.log(`\n💾 Database: PostgreSQL VPS (DATABASE_URL_CRYPTO)`);
            console.log(`   Tutti i dati verranno salvati nel database PostgreSQL della VPS`);
            
            // Mappa simboli comuni a Binance ticker
            const symbolMap = {
                'bitcoin_usdt': 'BTCUSDT',
                'ethereum_usdt': 'ETHUSDT',
                'cardano_usdt': 'ADAUSDT',
                'polkadot_usdt': 'DOTUSDT',
                'litecoin_usdt': 'LTCUSDT',
                'binance_coin_eur': 'BNBEUR',
                'ar': 'ARUSDT',
                'mkr': 'MKRUSDT',
                'pol_polygon_eur': 'MATICEUR',
                'trx': 'TRXUSDT',
                'usdc': 'USDCUSDT',
                'grt': 'GRTUSDT',
                'trx_eur': 'TRXEUR',
                'ldo': 'LDOUSDT',
                'avalanche_eur': 'AVAXEUR',
                'aave': 'AAVEUSDT',
                'vet': 'VETUSDT',
                'sei': 'SEIUSDT',
                'comp': 'COMPUSDT',
                'floki': 'FLOKIUSDT',
                'gala': 'GALAUSDT',
                'fet': 'FETUSDT',
                'uniswap': 'UNIUSDT',
                'ton': 'TONUSDT',
                'pepe': 'PEPEUSDT',
                'mana': 'MANAUSDT',
                'sui': 'SUIUSDT',
                'atom_eur': 'ATOMEUR',
                'sui_eur': 'SUIEUR',
                'pol_polygon': 'MATICUSDT',
                'algo': 'ALGOUSDT',
                'dogecoin_eur': 'DOGEEUR',
                'op': 'OPUSDT',
                'arb': 'ARBUSDT',
                'enj_eur': 'ENJEUR',
                'imx': 'IMXUSDT',
                'matic': 'MATICUSDT',
                'axs': 'AXSUSDT',
                'matic_eur': 'MATICEUR',
                'op_eur': 'OPEUR',
                'uniswap_eur': 'UNIEUR',
                'shiba_eur': 'SHIBEUR',
                'render': 'RENDERUSDT',
                'ripple_eur': 'XRPEUR',
                'enj': 'ENJUSDT',
                'pepe_eur': 'PEPEEUR',
                'avalanche': 'AVAXUSDT',
                'snx': 'SNXUSDT',
                'atom': 'ATOMUSDT',
                'xlm_eur': 'XLMEUR',
                'near_eur': 'NEAREUR',
                'xlm': 'XLMUSDT',
                'apt': 'APTUSDT',
                'near': 'NEARUSDT',
                'fil': 'FILUSDT',
                'shiba': 'SHIBUSDT',
                'solana_eur': 'SOLEUR',
                'arb_eur': 'ARBEUR',
                'inj': 'INJUSDT',
                'crv': 'CRVUSDT'
            };
            
            return {
                needsDownload: true,
                symbols: symbolsNeedingDownload,
                symbolMap: symbolMap
            };
        } else {
            console.log(`\n✅ Tutti i simboli hanno dati sufficienti!`);
            return {
                needsDownload: false
            };
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        return { needsDownload: false, error: error.message };
    }
}

// Esegui analisi
findAndDownloadMissingKlines().then(result => {
    if (result.needsDownload) {
        console.log(`\n🚀 AVVIO DOWNLOAD AUTOMATICO...`);
        console.log(`   Scaricherò klines per ${result.symbols.length} simboli`);
        console.log(`   Tempo stimato: ~${Math.ceil(result.symbols.length * 0.5)} minuti\n`);
        
        // Limita a primi 10 simboli più importanti per non sovraccaricare
        const prioritySymbols = result.symbols.slice(0, 15);
        
        console.log(`📥 Scarico primi ${prioritySymbols.length} simboli prioritari...`);
        
        let completed = 0;
        const downloadNext = () => {
            if (completed >= prioritySymbols.length) {
                console.log(`\n✅ Download completato per ${completed} simboli!`);
                console.log(`💾 Tutti i dati sono stati salvati nel database PostgreSQL della VPS`);
                process.exit(0);
                return;
            }
            
            const symbol = prioritySymbols[completed];
            const binanceSymbol = result.symbolMap[symbol];
            
            if (!binanceSymbol) {
                console.log(`⚠️ Saltato ${symbol} (nessun mapping Binance)`);
                completed++;
                downloadNext();
                return;
            }
            
            console.log(`\n[${completed + 1}/${prioritySymbols.length}] 📥 Download ${symbol} (${binanceSymbol})...`);
            
            const child = spawn('node', ['download_klines.js', symbol, binanceSymbol, '60'], {
                stdio: 'inherit',
                shell: true
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`   ✅ ${symbol} completato`);
                } else {
                    console.log(`   ⚠️ ${symbol} fallito (code ${code})`);
                }
                completed++;
                downloadNext();
            });
        };
        
        downloadNext();
        
    } else {
        process.exit(0);
    }
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
