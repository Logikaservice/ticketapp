/**
 * 🔧 Script per analizzare e correggere posizioni con importi sbagliati
 * 
 * Questo script:
 * 1. Identifica posizioni con importi diversi da trade_size_usdt configurato
 * 2. Suggerisce di chiuderle per riaprirle con l'importo corretto
 */

const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

async function analyzePositionSizes() {
    try {
        console.log('🔍 ANALISI POSIZIONI CON IMPORTI SBAGLIATI\n');
        console.log('='.repeat(80));
        console.log('');

        // 1. Recupera configurazione
        const globalParams = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        
        if (!globalParams || !globalParams.parameters) {
            console.log('❌ Configurazione globale non trovata');
            return;
        }

        const params = typeof globalParams.parameters === 'string' 
            ? JSON.parse(globalParams.parameters) 
            : globalParams.parameters;
        
        const tradeSize = parseFloat(params.trade_size_usdt || params.trade_size_eur) || 100;
        const maxPositions = parseInt(params.max_positions) || 10;

        console.log(`📊 Configurazione attesa:`);
        console.log(`   - trade_size: $${tradeSize}`);
        console.log(`   - max_positions: ${maxPositions}\n`);

        // 2. Recupera posizioni aperte
        const openPositions = await dbAll(
            `SELECT ticket_id, symbol, type, volume, entry_price, 
             (volume * entry_price) as invested, opened_at 
             FROM open_positions 
             WHERE status = 'open' 
             ORDER BY opened_at DESC`
        );

        console.log(`📊 Posizioni aperte: ${openPositions.length}\n`);

        // 3. Analizza ogni posizione
        const wrongSizedPositions = [];
        const totalInvested = 0;

        for (const pos of openPositions) {
            const invested = parseFloat(pos.invested) || 0;
            const diff = Math.abs(invested - tradeSize);
            const tolerance = 5; // Tolleranza ±$5

            if (diff > tolerance) {
                wrongSizedPositions.push({
                    ...pos,
                    invested,
                    diff: diff.toFixed(2),
                    percentage: ((invested / tradeSize) * 100).toFixed(1)
                });
            }
        }

        if (wrongSizedPositions.length === 0) {
            console.log('✅ Tutte le posizioni hanno l\'importo corretto!\n');
            return;
        }

        console.log(`❌ Trovate ${wrongSizedPositions.length} posizioni con importo sbagliato:\n`);
        
        for (const pos of wrongSizedPositions) {
            console.log(`   ${pos.ticket_id}: ${pos.symbol} (${pos.type})`);
            console.log(`      Investito: $${pos.invested.toFixed(2)} (${pos.percentage}% di $${tradeSize})`);
            console.log(`      Differenza: $${pos.diff}`);
            console.log(`      Aperta: ${new Date(pos.opened_at).toLocaleString()}`);
            console.log('');
        }

        // 4. Raccomandazioni
        console.log('💡 RACCOMANDAZIONI:\n');
        console.log('   1. Le posizioni con importi sbagliati sono state aperte prima della configurazione');
        console.log('   2. Per correggere:');
        console.log('      - Chiudi manualmente le posizioni con importi sbagliati');
        console.log('      - Oppure chiama /api/crypto/cleanup-positions per chiudere quelle in eccesso');
        console.log('   3. Le nuove posizioni useranno sempre $' + tradeSize + ' (se configurato correttamente)');
        console.log('   4. Verifica che ci sia abbastanza cash per aprire posizioni da $' + tradeSize + '\n');

        // 5. Verifica cash disponibile
        const portfolio = await dbGet("SELECT balance_usd FROM portfolio WHERE id = 1");
        const cashBalance = parseFloat(portfolio?.balance_usd || 0);
        
        console.log(`💰 Cash disponibile: $${cashBalance.toFixed(2)}`);
        console.log(`   Per aprire ${maxPositions} posizioni da $${tradeSize} servono: $${(maxPositions * tradeSize).toFixed(2)}`);
        
        if (cashBalance < (maxPositions * tradeSize)) {
            console.log(`   ⚠️  Cash insufficiente! Servono $${((maxPositions * tradeSize) - cashBalance).toFixed(2)} in più\n`);
        } else {
            console.log(`   ✅ Cash sufficiente\n`);
        }

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
    }
}

analyzePositionSizes();
