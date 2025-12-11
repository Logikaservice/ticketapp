/**
 * 🔍 Verifica Rimozione Simboli
 * 
 * Verifica che tutti i simboli con volume < 1M USDT siano stati
 * completamente rimossi da tutte le tabelle del database.
 */

const { dbAll, dbGet } = require('./crypto_db');

// Lista simboli che DOVREBBERO essere stati rimossi
const SYMBOLS_REMOVED = [
    'algo', 'apt', 'ar', 'arb', 'arb_eur', 'atom', 'atom_eur',
    'avalanche', 'avalanche_eur', 'axs', 'binance_coin_eur',
    'bitcoin_usdt', 'cardano_usdt', 'chainlink', 'comp', 'crv',
    'dogecoin', 'dogecoin_eur', 'enj', 'enj_eur', 'eos',
    'ethereum_usdt', 'fet', 'fil', 'grt', 'icp', 'inj', 'ldo',
    'litecoin_usdt', 'matic_eur', 'mkr', 'near', 'near_eur',
    'op', 'op_eur', 'pepe_eur', 'polkadot_usdt', 'pol_polygon_eur',
    'render', 'ripple_eur', 'shiba', 'shiba_eur', 'snx',
    'solana_eur', 'sui', 'sui_eur', 'ton', 'trx', 'trx_eur',
    'uniswap_eur', 'usdc', 'vet', 'xlm', 'xlm_eur'
];

// Lista simboli che DOVREBBERO essere mantenuti
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
];

async function checkTable(tableName, symbolColumn = 'symbol') {
    console.log(`\n📊 Verifica tabella: ${tableName}`);
    console.log('─'.repeat(60));
    
    try {
        // Conta tutti i simboli
        const allSymbols = await dbAll(
            `SELECT DISTINCT ${symbolColumn} as symbol, COUNT(*) as count 
             FROM ${tableName} 
             WHERE ${symbolColumn} IS NOT NULL 
             GROUP BY ${symbolColumn} 
             ORDER BY ${symbolColumn}`
        );
        
        if (allSymbols.length === 0) {
            console.log('   ✅ Tabella vuota o nessun simbolo trovato');
            return { found: [], total: 0 };
        }
        
        // Verifica simboli rimossi
        const foundRemoved = [];
        const foundKept = [];
        const foundUnknown = [];
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const count = parseInt(row.count || 0);
            
            if (SYMBOLS_REMOVED.includes(symbol)) {
                foundRemoved.push({ symbol, count });
            } else if (SYMBOLS_TO_KEEP.includes(symbol)) {
                foundKept.push({ symbol, count });
            } else if (symbol !== 'global') {
                foundUnknown.push({ symbol, count });
            }
        }
        
        // Report
        if (foundRemoved.length > 0) {
            console.log(`   ❌ TROVATI ${foundRemoved.length} SIMBOLI RIMOSSI:`);
            foundRemoved.forEach(({ symbol, count }) => {
                console.log(`      - ${symbol.padEnd(25)} ${count} record`);
            });
        } else {
            console.log(`   ✅ Nessun simbolo rimosso trovato`);
        }
        
        if (foundKept.length > 0) {
            console.log(`   ✅ Simboli mantenuti: ${foundKept.length}`);
        }
        
        if (foundUnknown.length > 0) {
            console.log(`   ⚠️  Simboli sconosciuti: ${foundUnknown.length}`);
            foundUnknown.forEach(({ symbol, count }) => {
                console.log(`      - ${symbol.padEnd(25)} ${count} record`);
            });
        }
        
        console.log(`   📊 Totale simboli unici: ${allSymbols.length}`);
        
        return {
            found: foundRemoved,
            kept: foundKept,
            unknown: foundUnknown,
            total: allSymbols.length
        };
        
    } catch (error) {
        console.error(`   ❌ Errore verifica ${tableName}: ${error.message}`);
        return { found: [], total: 0, error: error.message };
    }
}

async function main() {
    console.log('🔍 VERIFICA RIMOZIONE SIMBOLI CON VOLUMI BASSI\n');
    console.log('='.repeat(80));
    console.log(`Simboli da verificare (rimossi): ${SYMBOLS_REMOVED.length}`);
    console.log(`Simboli da mantenere: ${SYMBOLS_TO_KEEP.length}`);
    console.log('='.repeat(80));
    
    const results = {
        bot_settings: null,
        bot_parameters: null,
        klines: null,
        market_data: null,
        open_positions: null
    };
    
    // Verifica tutte le tabelle
    results.bot_settings = await checkTable('bot_settings');
    results.bot_parameters = await checkTable('bot_parameters');
    results.klines = await checkTable('klines');
    results.market_data = await checkTable('market_data');
    results.open_positions = await checkTable('open_positions');
    
    // Riepilogo finale
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO VERIFICA\n');
    
    let totalFound = 0;
    const allFoundSymbols = new Set();
    
    Object.entries(results).forEach(([table, result]) => {
        if (result && result.found && result.found.length > 0) {
            console.log(`❌ ${table}: ${result.found.length} simboli rimossi trovati`);
            result.found.forEach(({ symbol }) => allFoundSymbols.add(symbol));
            totalFound += result.found.length;
        } else if (result && result.error) {
            console.log(`⚠️  ${table}: Errore - ${result.error}`);
        } else {
            console.log(`✅ ${table}: Pulito`);
        }
    });
    
    console.log('\n' + '─'.repeat(80));
    
    if (totalFound === 0) {
        console.log('✅ VERIFICA COMPLETATA: Nessun simbolo rimosso trovato nel database!');
        console.log('   Tutti i simboli con volume < 1M USDT sono stati rimossi correttamente.');
    } else {
        console.log(`❌ ATTENZIONE: Trovati ${totalFound} riferimenti a simboli rimossi!`);
        console.log(`\n📋 Simboli ancora presenti:`);
        Array.from(allFoundSymbols).sort().forEach(symbol => {
            console.log(`   - ${symbol}`);
        });
        console.log(`\n💡 Questi simboli devono essere rimossi manualmente o lo script deve essere rieseguito.`);
    }
    
    // Verifica simboli mantenuti
    console.log('\n' + '─'.repeat(80));
    console.log('✅ VERIFICA SIMBOLI MANTENUTI\n');
    
    const allKeptSymbols = new Set();
    Object.values(results).forEach(result => {
        if (result && result.kept) {
            result.kept.forEach(({ symbol }) => allKeptSymbols.add(symbol));
        }
    });
    
    console.log(`📊 Simboli mantenuti trovati: ${allKeptSymbols.size}`);
    console.log(`   ${Array.from(allKeptSymbols).sort().join(', ')}`);
    
    const missingKept = SYMBOLS_TO_KEEP.filter(s => !allKeptSymbols.has(s));
    if (missingKept.length > 0) {
        console.log(`\n⚠️  Simboli mantenuti NON trovati: ${missingKept.length}`);
        console.log(`   ${missingKept.join(', ')}`);
    } else {
        console.log(`\n✅ Tutti i simboli da mantenere sono presenti nel database.`);
    }
}

main().catch(console.error);

