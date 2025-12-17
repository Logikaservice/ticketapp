/**
 * Script per verificare klines per tutti i simboli con posizioni aperte
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;

async function checkAllKlines() {
    try {
        console.log('🔍 Verifica klines per tutti i simboli con posizioni aperte...\n');

        // Recupera tutte le posizioni aperte
        const openPositions = await dbAll("SELECT DISTINCT symbol FROM open_positions WHERE status = 'open'");
        
        if (openPositions.length === 0) {
            console.log('❌ Nessuna posizione aperta trovata');
            return;
        }

        console.log(`📊 Trovate ${openPositions.length} posizioni aperte con simboli unici:\n`);

        const results = [];

        for (const pos of openPositions) {
            const symbol = pos.symbol;
            
            // Conta klines per questo simbolo
            const klinesCount = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                [symbol]
            );

            const count = parseInt(klinesCount[0]?.count || 0);
            const hasEnough = count >= 20;
            
            results.push({
                symbol,
                klinesCount: count,
                hasEnough,
                status: hasEnough ? '✅ OK' : '❌ INSUFFICIENTI'
            });

            console.log(`${hasEnough ? '✅' : '❌'} ${symbol.toUpperCase()}: ${count} klines ${hasEnough ? '(sufficienti)' : '(INSUFFICIENTI - serve almeno 20)'}`);
        }

        console.log('\n📋 Riepilogo:');
        const insufficient = results.filter(r => !r.hasEnough);
        
        if (insufficient.length === 0) {
            console.log('✅ Tutti i simboli hanno klines sufficienti!');
        } else {
            console.log(`\n⚠️ ${insufficient.length} simbolo/i con klines insufficienti:`);
            insufficient.forEach(r => {
                console.log(`   - ${r.symbol.toUpperCase()}: ${r.klinesCount} klines (serve almeno 20)`);
            });
            console.log('\n💡 Esegui download_klines.js per scaricare i dati mancanti.');
        }

        // Verifica anche altri simboli comuni (anche senza posizioni aperte)
        console.log('\n\n🔍 Verifica klines per simboli comuni (anche senza posizioni aperte)...\n');
        
        const commonSymbols = [
            'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 
            'chainlink', 'litecoin', 'ripple', 'binance_coin',
            'sand', 'mana', 'axs', 'gala', 'enj', 'bonk', 'shiba_inu'
        ];

        const commonResults = [];
        for (const symbol of commonSymbols) {
            const klinesCount = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                [symbol]
            );
            const count = parseInt(klinesCount[0]?.count || 0);
            const hasEnough = count >= 20;
            
            commonResults.push({
                symbol,
                klinesCount: count,
                hasEnough
            });
        }

        // Mostra solo quelli con problemi
        const commonInsufficient = commonResults.filter(r => !r.hasEnough);
        if (commonInsufficient.length > 0) {
            console.log('⚠️ Simboli comuni con klines insufficienti:');
            commonInsufficient.forEach(r => {
                console.log(`   - ${r.symbol.toUpperCase()}: ${r.klinesCount} klines`);
            });
        } else {
            console.log('✅ Tutti i simboli comuni hanno klines sufficienti!');
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    }
}

checkAllKlines().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

