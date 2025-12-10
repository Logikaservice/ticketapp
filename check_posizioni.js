/**
 * Script semplice per verificare posizioni aperte
 */

const { dbAll } = require('./backend/crypto_db');

async function checkPosizioni() {
    try {
        const aperte = await dbAll(
            "SELECT symbol, type, entry_price, current_price, profit_loss_pct, opened_at FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );
        
        console.log(`\n📊 POSIZIONI APERTE: ${aperte.length}\n`);
        
        if (aperte.length === 0) {
            console.log('Nessuna posizione aperta');
        } else {
            aperte.forEach((pos, idx) => {
                const entry = parseFloat(pos.entry_price || 0);
                const current = parseFloat(pos.current_price || entry);
                const pnl = parseFloat(pos.profit_loss_pct || 0);
                const pnlColor = pnl >= 0 ? '✅' : '❌';
                
                console.log(`${idx + 1}. ${pos.symbol.toUpperCase()} | ${pos.type.toUpperCase()}`);
                console.log(`   Entry: $${entry.toFixed(6)} | Prezzo: $${current.toFixed(6)}`);
                console.log(`   P&L: ${pnlColor} ${pnl.toFixed(2)}%`);
                console.log('');
            });
        }
        
        const chiuse = await dbAll(
            "SELECT COUNT(*) as count FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')"
        );
        console.log(`📋 Posizioni chiuse: ${chiuse[0]?.count || 0}`);
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkPosizioni().then(() => process.exit(0)).catch(() => process.exit(1));

