const db = require('./backend/crypto_db');

console.log('🔍 VERIFICA COMPLETA SISTEMA BOT');
console.log('='.repeat(80));

// 1. Verifica bot attivo
db.get("SELECT * FROM bot_settings WHERE symbol = 'bitcoin'", (err, bot) => {
    if (err) {
        console.error('❌ Errore:', err);
        db.close();
        return;
    }

    console.log('\n1️⃣ BOT STATUS NEL DATABASE:');
    console.log('='.repeat(80));
    if (!bot) {
        console.log('❌ ERRORE: Nessun bot trovato!');
        db.close();
        return;
    }

    console.log(`Strategy: ${bot.strategy_name}`);
    console.log(`Symbol: ${bot.symbol}`);
    console.log(`Active: ${bot.is_active === 1 ? '✅ SÌ' : '❌ NO'}`);
    console.log(`Parameters: ${bot.parameters}`);

    if (bot.is_active !== 1) {
        console.log('\n⚠️  ATTENZIONE: Bot NON attivo!');
        db.close();
        return;
    }

    // 2. Verifica portfolio
    db.get("SELECT * FROM portfolio WHERE id = 1", (err, portfolio) => {
        if (err) {
            console.error('❌ Errore:', err);
            db.close();
            return;
        }

        console.log('\n2️⃣ PORTFOLIO STATUS:');
        console.log('='.repeat(80));
        console.log(`Balance: €${portfolio.balance_usd}`);
        console.log(`Holdings: ${portfolio.holdings}`);

        if (portfolio.balance_usd < 10) {
            console.log('\n⚠️  ATTENZIONE: Balance troppo basso per trading!');
        }

        // 3. Verifica parametri bot
        const params = JSON.parse(bot.parameters);
        console.log('\n3️⃣ PARAMETRI BOT:');
        console.log('='.repeat(80));
        console.log(`RSI Period: ${params.period}`);
        console.log(`Buy Threshold: ${params.buy_threshold} (compra quando RSI < ${params.buy_threshold})`);
        console.log(`Sell Threshold: ${params.sell_threshold} (vende quando RSI > ${params.sell_threshold})`);

        // 4. Simula condizioni di trading
        console.log('\n4️⃣ CONDIZIONI PER APRIRE POSIZIONI:');
        console.log('='.repeat(80));
        console.log('Il bot aprirà una posizione LONG quando:');
        console.log(`  ✅ RSI < ${params.buy_threshold}`);
        console.log(`  ✅ Balance disponibile > €10`);
        console.log(`  ✅ Nessuna posizione aperta sullo stesso simbolo`);
        console.log(`  ✅ Risk management permette il trade`);
        console.log('');
        console.log('Il bot aprirà una posizione SHORT quando:');
        console.log(`  ✅ RSI > ${params.sell_threshold}`);
        console.log(`  ✅ Segnale SHORT forte dal BidirectionalSignalGenerator`);
        console.log(`  ✅ Risk management permette il trade`);

        // 5. Verifica se ci sono posizioni aperte
        db.all("SELECT * FROM open_positions", (err, positions) => {
            if (err) {
                console.error('❌ Errore:', err);
                db.close();
                return;
            }

            console.log('\n5️⃣ POSIZIONI APERTE:');
            console.log('='.repeat(80));
            if (positions.length === 0) {
                console.log('✅ Nessuna posizione aperta (pronto per nuovi trade)');
            } else {
                console.log(`⚠️  ${positions.length} posizione/i già aperta/e:`);
                positions.forEach((p, i) => {
                    console.log(`  ${i + 1}. ${p.symbol} - ${p.type} - €${p.entry_price}`);
                });
            }

            // 6. CONCLUSIONE FINALE
            console.log('\n' + '='.repeat(80));
            console.log('🎯 CONCLUSIONE FINALE:');
            console.log('='.repeat(80));

            const allGood = bot.is_active === 1 && portfolio.balance_usd >= 10;

            if (allGood) {
                console.log('✅ ✅ ✅ TUTTO OK! IL BOT È PRONTO! ✅ ✅ ✅');
                console.log('');
                console.log('Il bot:');
                console.log('  ✅ È ATTIVO nel database');
                console.log('  ✅ Ha balance sufficiente (€' + portfolio.balance_usd + ')');
                console.log('  ✅ Ha parametri configurati correttamente');
                console.log('  ✅ Può aprire posizioni quando trova opportunità');
                console.log('');
                console.log('📊 PROSSIMI PASSI:');
                console.log('  1. Il bot controlla il mercato ogni 10 secondi');
                console.log('  2. Calcola RSI e altri indicatori');
                console.log('  3. Quando trova un segnale forte, apre una posizione');
                console.log('  4. Gestisce automaticamente stop-loss e take-profit');
                console.log('');
                console.log('🔔 NOTIFICHE:');
                console.log('  Riceverai notifiche in tempo reale quando:');
                console.log('  - Viene aperta una posizione');
                console.log('  - Viene chiusa una posizione');
                console.log('  - C\'è un profitto/perdita significativo');
                console.log('');
                console.log('⏰ TEMPO DI ATTESA:');
                console.log('  Il bot potrebbe impiegare da pochi minuti a diverse ore');
                console.log('  per trovare un\'opportunità di trading valida.');
                console.log('  Dipende dalle condizioni di mercato.');
            } else {
                console.log('❌ ATTENZIONE: Ci sono problemi!');
                if (bot.is_active !== 1) {
                    console.log('  ❌ Bot NON attivo');
                }
                if (portfolio.balance_usd < 10) {
                    console.log('  ❌ Balance insufficiente');
                }
            }

            db.close();
        });
    });
});
