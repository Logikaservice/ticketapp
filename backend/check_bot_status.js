/**
 * 🔍 Script per Verificare Stato Bot
 * 
 * Verifica:
 * 1. Bot attivo per simbolo
 * 2. Bot in esecuzione
 * 3. Parametri configurazione
 * 4. Log recenti
 */

const { dbAll, dbGet } = require('./crypto_db');

async function checkBotStatus(symbol) {
    console.log(`\n🔍 VERIFICA STATO BOT PER ${symbol.toUpperCase()}`);
    console.log('='.repeat(60));
    
    try {
        // 1. Verifica bot attivo
        const botSettings = await dbAll(
            "SELECT * FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
            [symbol, 'RSI_Strategy']
        );
        
        if (botSettings.length === 0) {
            console.log(`❌ Nessun bot configurato per ${symbol}`);
            console.log(`   Crea una entry in bot_settings con:`);
            console.log(`   - symbol: '${symbol}'`);
            console.log(`   - strategy_name: 'RSI_Strategy'`);
            console.log(`   - is_active: 1`);
            return;
        }
        
        const bot = botSettings[0];
        console.log(`✅ Bot configurato per ${symbol}:`);
        console.log(`   ID: ${bot.id}`);
        console.log(`   Attivo: ${bot.is_active === 1 ? '✅ SÌ' : '❌ NO'}`);
        console.log(`   Strategia: ${bot.strategy_name}`);
        
        if (bot.is_active !== 1) {
            console.log(`\n⚠️ BOT NON ATTIVO! Attivalo con:`);
            console.log(`   UPDATE bot_settings SET is_active = 1 WHERE symbol = '${symbol}';`);
            return;
        }
        
        // 2. Verifica parametri bot
        const botParams = await dbGet(
            "SELECT * FROM bot_parameters WHERE symbol = $1",
            [symbol]
        ).catch(() => null);
        
        if (botParams) {
            console.log(`\n📊 Parametri Bot:`);
            console.log(`   Min Strength: ${botParams.min_signal_strength || 'default (60/70)'}`);
            console.log(`   Min Confirmations LONG: ${botParams.min_confirmations_long || 'default (3)'}`);
            console.log(`   Min Confirmations SHORT: ${botParams.min_confirmations_short || 'default (4)'}`);
        } else {
            console.log(`\n⚠️ Nessun parametro personalizzato per ${symbol} (usa default)`);
        }
        
        // 3. Verifica posizioni aperte
        const openPositions = await dbAll(
            "SELECT * FROM open_positions WHERE symbol = $1 AND status = $2",
            [symbol, 'open']
        );
        
        console.log(`\n📈 Posizioni Aperte: ${openPositions.length}`);
        if (openPositions.length > 0) {
            openPositions.forEach(pos => {
                console.log(`   - ${pos.type.toUpperCase()}: ${pos.volume} @ $${pos.entry_price} (P&L: ${pos.profit_loss_pct}%)`);
            });
        }
        
        // 4. Verifica klines
        const klines = await dbAll(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
            [symbol, '15m']
        );
        
        const klinesCount = klines[0]?.count || 0;
        console.log(`\n📊 Klines disponibili: ${klinesCount}`);
        if (klinesCount < 50) {
            console.log(`   ⚠️ Klines insufficienti (minimo 50 richiesti)`);
        }
        
        // 5. Verifica volume 24h
        const volumeData = await dbGet(
            "SELECT volume_24h FROM market_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1",
            [symbol]
        ).catch(() => null);
        
        if (volumeData) {
            const volume24h = volumeData.volume_24h || 0;
            console.log(`\n💰 Volume 24h: $${volume24h.toLocaleString()}`);
            if (volume24h < 500000) {
                console.log(`   ⚠️ Volume insufficiente (minimo $500,000 richiesto)`);
            }
        } else {
            console.log(`\n⚠️ Volume 24h non disponibile`);
        }
        
        // 6. Conclusione
        console.log(`\n📋 STATO FINALE:`);
        const issues = [];
        if (bot.is_active !== 1) issues.push('Bot non attivo');
        if (klinesCount < 50) issues.push('Klines insufficienti');
        if (volumeData && volumeData.volume_24h < 500000) issues.push('Volume 24h insufficiente');
        
        if (issues.length === 0) {
            console.log(`✅ Tutto OK - Il bot dovrebbe funzionare correttamente`);
            console.log(`   Controlla i log del backend per vedere perché non apre posizioni`);
        } else {
            console.log(`❌ Problemi trovati:`);
            issues.forEach(issue => console.log(`   - ${issue}`));
        }
        
    } catch (error) {
        console.error(`❌ Errore durante verifica:`, error.message);
        console.error(error.stack);
    }
}

async function main() {
    const symbols = process.argv.slice(2);
    
    if (symbols.length === 0) {
        console.log('Uso: node check_bot_status.js <symbol1> [symbol2] ...');
        console.log('Esempio: node check_bot_status.js ethereum avax_usdt');
        return;
    }
    
    for (const symbol of symbols) {
        await checkBotStatus(symbol);
    }
}

main().catch(console.error);

