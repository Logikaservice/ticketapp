/**
 * Script per trovare CHI crea klines per simboli non validi
 * 
 * Analizza i log del bot per identificare da dove arrivano i simboli non validi
 */

const path = require('path');
const crypto_db = require('../crypto_db');

// Simboli non validi da monitorare
const INVALID_SYMBOLS = ['algo', 'litecoin', 'litecoin_usdt', 'shiba', 'sui', 'trx', 'vet', 'xlm'];

async function main() {
    try {
        console.log('🔍 ANALISI: Chi Crea Klines per Simboli Non Validi\n');
        console.log('='.repeat(80));

        // 1. Verifica klines esistenti
        console.log('\n📊 1. KLINES ESISTENTI PER SIMBOLI NON VALIDI\n');
        
        for (const symbol of INVALID_SYMBOLS) {
            const klines = await crypto_db.dbAll(
                "SELECT COUNT(*) as count, MIN(open_time) as prima, MAX(close_time) as ultima FROM klines WHERE symbol = $1",
                [symbol]
            );
            
            if (klines[0].count > 0) {
                const prima = klines[0].prima ? new Date(parseInt(klines[0].prima)).toISOString() : 'N/A';
                const ultima = klines[0].ultima ? new Date(parseInt(klines[0].ultima)).toISOString() : 'N/A';
                
                console.log(`   ${symbol.padEnd(20)} → ${klines[0].count} klines | Prima: ${prima} | Ultima: ${ultima}`);
            }
        }

        // 2. Verifica bot_settings
        console.log('\n⚙️  2. BOT_SETTINGS PER SIMBOLI NON VALIDI\n');
        
        for (const symbol of INVALID_SYMBOLS) {
            const settings = await crypto_db.dbGet(
                "SELECT is_active, strategy_name, created_at FROM bot_settings WHERE symbol = $1",
                [symbol]
            );
            
            if (settings) {
                console.log(`   ${symbol.padEnd(20)} → is_active: ${settings.is_active}, strategy: ${settings.strategy_name}`);
            }
        }

        // 3. Verifica varianti (con/senza suffisso)
        console.log('\n🔍 3. VERIFICA VARIANTI SIMBOLI\n');
        
        const variants = {
            'trx': ['trx_eur', 'tron', 'trxusdt'],
            'xlm': ['xlm_eur', 'stellar', 'xlmusdt'],
            'sui': ['sui_eur', 'suiusdt'],
            'shiba': ['shiba_eur', 'shiba_inu', 'shibusdt'],
            'algo': ['algorand', 'algousdt'],
            'litecoin': ['litecoin_eur', 'ltc', 'ltcusdt'],
            'vet': ['vechain', 'vetusdt']
        };

        for (const [invalid, validVariants] of Object.entries(variants)) {
            console.log(`\n   ${invalid}:`);
            
            // Verifica se le varianti valide hanno klines
            for (const variant of validVariants) {
                const count = await crypto_db.dbGet(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1",
                    [variant]
                );
                
                if (count.count > 0) {
                    console.log(`      ✅ ${variant.padEnd(20)} → ${count.count} klines (VALIDO)`);
                }
            }
            
            // Verifica simbolo non valido
            const invalidCount = await crypto_db.dbGet(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1",
                [invalid]
            );
            
            if (invalidCount.count > 0) {
                console.log(`      ❌ ${invalid.padEnd(20)} → ${invalidCount.count} klines (NON VALIDO)`);
            }
        }

        // 4. Verifica timestamp recenti
        console.log('\n⏰ 4. KLINES CREATE NELLE ULTIME ORE\n');
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const symbol of INVALID_SYMBOLS) {
            const recent = await crypto_db.dbGet(
                "SELECT COUNT(*) as count, MAX(close_time) as ultima FROM klines WHERE symbol = $1 AND close_time >= $2",
                [symbol, oneHourAgo]
            );
            
            if (recent.count > 0) {
                const ultima = recent.ultima ? new Date(parseInt(recent.ultima)).toISOString() : 'N/A';
                console.log(`   🚨 ${symbol.padEnd(20)} → ${recent.count} klines create nell'ultima ora (ultima: ${ultima})`);
            }
        }

        // 5. Raccomandazioni
        console.log('\n💡 5. RACCOMANDAZIONI\n');
        console.log('='.repeat(80));
        console.log('\nSe le klines continuano a essere ricreate:');
        console.log('1. Verifica log del bot: pm2 logs ticketapp-backend | grep -i "algo\\|litecoin\\|shiba\\|sui\\|trx\\|vet\\|xlm"');
        console.log('2. Cerca messaggi "BLOCCATO" - se non ci sono, il filtro non viene chiamato');
        console.log('3. Verifica se ci sono altri script o servizi che creano klines');
        console.log('4. Controlla se il simbolo viene normalizzato prima di essere salvato');

        console.log('\n✅ Analisi completata');

    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (crypto_db.pool && typeof crypto_db.pool.end === 'function') {
            await crypto_db.pool.end();
        }
    }
}

main();
