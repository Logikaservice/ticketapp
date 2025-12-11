/**
 * 🧹 Pulizia Completa Simboli Rimossi
 * 
 * Rimuove tutti i simboli rimossi ancora presenti nel database,
 * inclusi quelli trovati nella verifica.
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');

// Lista simboli che DOVREBBERO essere stati rimossi
const SYMBOLS_TO_REMOVE = [
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

// Simboli sconosciuti/varianti da rimuovere (trovati nella verifica)
const UNKNOWN_SYMBOLS_TO_REMOVE = [
    'avalancheeur',      // Variante senza underscore
    'binancecoin_eur',   // Variante
    'dogecoineur',       // Variante senza underscore
    'polpolygon',        // Variante senza underscore (1169 record!)
    'rippleeur',         // Variante senza underscore
    'solanaeur',         // Variante senza underscore
    'stellar',           // Nome alternativo
    'trxeur',            // Variante senza underscore
    'usdcoin'            // Nome alternativo per USDC
];

// Lista simboli da mantenere
const SYMBOLS_TO_KEEP = [
    'aave', 'avax_usdt', 'binance_coin', 'bitcoin', 'bonk',
    'cardano', 'chainlink_usdt', 'ethereum', 'floki', 'gala',
    'imx', 'litecoin', 'mana', 'matic', 'pepe', 'polkadot',
    'pol_polygon', 'ripple', 'sand', 'sei', 'solana', 'uniswap'
];

const removeFromTable = async (tableName, symbolColumn = 'symbol') => {
    console.log(`\n🧹 Pulizia tabella: ${tableName}`);
    console.log('─'.repeat(60));
    
    try {
        // Rimuovi simboli dalla lista principale
        let totalRemoved = 0;
        
        for (const symbol of SYMBOLS_TO_REMOVE) {
            const result = await dbRun(
                `DELETE FROM ${tableName} WHERE ${symbolColumn} = $1`,
                [symbol]
            );
            const removed = result.changes || 0;
            if (removed > 0) {
                console.log(`   ✅ Rimosso ${symbol}: ${removed} record`);
                totalRemoved += removed;
            }
        }
        
        // Rimuovi simboli sconosciuti/varianti
        for (const symbol of UNKNOWN_SYMBOLS_TO_REMOVE) {
            const result = await dbRun(
                `DELETE FROM ${tableName} WHERE ${symbolColumn} = $1`,
                [symbol]
            );
            const removed = result.changes || 0;
            if (removed > 0) {
                console.log(`   ✅ Rimosso ${symbol} (variante): ${removed} record`);
                totalRemoved += removed;
            }
        }
        
        if (totalRemoved === 0) {
            console.log(`   ✅ Nessun record da rimuovere`);
        } else {
            console.log(`   📊 Totale record rimossi: ${totalRemoved}`);
        }
        
        return totalRemoved;
        
    } catch (error) {
        console.error(`   ❌ Errore pulizia ${tableName}: ${error.message}`);
        return 0;
    }
};

async function main() {
    console.log('🧹 PULIZIA COMPLETA SIMBOLI RIMOSSI\n');
    console.log('='.repeat(80));
    console.log(`Simboli da rimuovere: ${SYMBOLS_TO_REMOVE.length}`);
    console.log(`Simboli varianti/unknown: ${UNKNOWN_SYMBOLS_TO_REMOVE.length}`);
    console.log('='.repeat(80));
    
    const results = {
        bot_settings: 0,
        bot_parameters: 0,
        klines: 0,
        market_data: 0,
        open_positions: 0
    };
    
    // Pulisci tutte le tabelle
    results.bot_settings = await removeFromTable('bot_settings');
    results.bot_parameters = await removeFromTable('bot_parameters');
    results.klines = await removeFromTable('klines');
    results.market_data = await removeFromTable('market_data');
    results.open_positions = await removeFromTable('open_positions');
    
    // Riepilogo
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO PULIZIA\n');
    
    const totalRemoved = Object.values(results).reduce((sum, val) => sum + val, 0);
    
    Object.entries(results).forEach(([table, count]) => {
        if (count > 0) {
            console.log(`✅ ${table}: ${count} record rimossi`);
        } else {
            console.log(`✅ ${table}: Già pulito`);
        }
    });
    
    console.log(`\n📊 Totale record rimossi: ${totalRemoved}`);
    
    if (totalRemoved > 0) {
        console.log('\n✅ Pulizia completata!');
        console.log('\n💡 Esegui di nuovo verify_symbols_removed.js per verificare che tutto sia pulito.');
    } else {
        console.log('\n✅ Database già pulito - nessun record da rimuovere.');
    }
}

main().catch(console.error);

