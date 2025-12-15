const { dbAll, dbGet } = require('../crypto_db');

async function checkDatabaseValues() {
    console.log('🔍 VERIFICA VALORI NEL DATABASE');
    console.log('='.repeat(60));

    try {
        // 1. Portfolio
        console.log('\n💰 PORTFOLIO:');
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        if (portfolio) {
            console.log(`   Balance USD: $${parseFloat(portfolio.balance_usd || 0).toFixed(2)}`);
            console.log(`   Holdings: ${portfolio.holdings || '{}'}`);
        } else {
            console.log('   ❌ Portfolio non trovato');
        }

        // 2. Posizioni aperte
        console.log('\n📊 POSIZIONI APERTE:');
        const openPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        console.log(`   Totale: ${openPositions[0]?.count || 0}`);
        
        if (openPositions[0]?.count > 0) {
            const positions = await dbAll("SELECT ticket_id, symbol, type, volume, entry_price, profit_loss FROM open_positions WHERE status = 'open' LIMIT 5");
            positions.forEach(pos => {
                console.log(`   - ${pos.ticket_id}: ${pos.symbol} ${pos.type} ${parseFloat(pos.volume || 0).toFixed(4)} @ $${parseFloat(pos.entry_price || 0).toFixed(2)} (P&L: $${parseFloat(pos.profit_loss || 0).toFixed(2)})`);
            });
            if (openPositions[0].count > 5) {
                console.log(`   ... e altre ${openPositions[0].count - 5} posizioni`);
            }
        }

        // 3. Posizioni chiuse (ultime 5)
        console.log('\n📉 ULTIME POSIZIONI CHIUSE:');
        const closedPositions = await dbAll(`
            SELECT ticket_id, symbol, type, volume, entry_price, profit_loss, closed_at 
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken') 
            ORDER BY closed_at DESC 
            LIMIT 5
        `);
        if (closedPositions.length > 0) {
            closedPositions.forEach(pos => {
                console.log(`   - ${pos.ticket_id}: ${pos.symbol} ${pos.type} P&L: $${parseFloat(pos.profit_loss || 0).toFixed(2)} (chiusa: ${pos.closed_at ? new Date(pos.closed_at).toLocaleString() : 'N/A'})`);
            });
        } else {
            console.log('   Nessuna posizione chiusa');
        }

        // 4. Bot Settings (per vedere se c'è qualche configurazione)
        console.log('\n🤖 BOT SETTINGS:');
        const botSettings = await dbAll("SELECT strategy_name, symbol, is_active FROM bot_settings LIMIT 5");
        if (botSettings.length > 0) {
            botSettings.forEach(bs => {
                console.log(`   - ${bs.strategy_name} / ${bs.symbol}: ${bs.is_active ? 'ATTIVO' : 'INATTIVO'}`);
            });
        } else {
            console.log('   Nessuna configurazione bot');
        }

        // 5. Verifica se esiste una tabella per impostazioni generali
        console.log('\n⚙️  IMPOSTAZIONI:');
        try {
            const settingsTable = await dbAll(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE '%setting%' OR table_name LIKE '%config%'
            `);
            if (settingsTable.length > 0) {
                console.log(`   Tabelle trovate: ${settingsTable.map(t => t.table_name).join(', ')}`);
            } else {
                console.log('   ⚠️  Nessuna tabella impostazioni nel database');
                console.log('   ℹ️  Le impostazioni Total Balance sono salvate in localStorage (browser), non nel database');
            }
        } catch (e) {
            console.log('   ⚠️  Impossibile verificare tabelle impostazioni');
        }

        // 6. Calcolo rapido
        console.log('\n📈 CALCOLO RAPIDO:');
        const portfolioBalance = parseFloat(portfolio?.balance_usd || 0);
        const totalOpenPositions = openPositions[0]?.count || 0;
        console.log(`   Cash (balance_usd): $${portfolioBalance.toFixed(2)}`);
        console.log(`   Posizioni aperte: ${totalOpenPositions}`);
        console.log(`\n   💡 NOTA: Il Total Balance è salvato in localStorage del browser, non nel database.`);
        console.log(`   Per vedere il valore, apri la console del browser e digita:`);
        console.log(`   JSON.parse(localStorage.getItem('crypto_general_settings'))?.totalBalance`);

    } catch (error) {
        console.error('❌ Errore durante la verifica:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    checkDatabaseValues();
}

module.exports = { checkDatabaseValues };

