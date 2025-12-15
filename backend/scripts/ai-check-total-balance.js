/**
 * Script per controllo autonomo Total Balance da parte dell'AI
 * Esegui questo script sul server: node scripts/ai-check-total-balance.js
 */

const { dbGet, dbAll } = require('../crypto_db_postgresql');

async function checkAndVerifyTotalBalance() {
    console.log('🔍 CONTROLLO E VERIFICA TOTAL BALANCE\n');
    console.log('='.repeat(60));
    
    try {
        // 1. Leggi dal database
        console.log('\n📊 1. VALORE NEL DATABASE:');
        const dbResult = await dbGet("SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'");
        const dbValue = parseFloat(dbResult?.setting_value || 0);
        console.log(`   Database: $${dbValue.toFixed(2)}`);
        console.log(`   Ultimo aggiornamento: ${dbResult?.updated_at || 'N/A'}`);
        
        // 2. Simula API GET (come fa il frontend)
        console.log('\n🌐 2. VALORE RESTITUITO DALL\'API (simulazione):');
        const allSettings = await dbAll("SELECT setting_key, setting_value FROM general_settings");
        const settingsObj = {};
        allSettings.forEach(s => {
            settingsObj[s.setting_key] = s.setting_value;
        });
        const apiValue = parseFloat(settingsObj.total_balance || 0);
        console.log(`   API: $${apiValue.toFixed(2)}`);
        
        // 3. Confronto
        console.log('\n📋 3. CONFRONTO:');
        const match = Math.abs(dbValue - apiValue) < 0.01;
        if (match) {
            console.log(`   ✅ Valori sincronizzati correttamente!`);
            console.log(`   💡 Il frontend dovrebbe visualizzare: $${dbValue.toFixed(2)}`);
        } else {
            console.log(`   ❌ DISCREPANZA: ${Math.abs(dbValue - apiValue).toFixed(2)}`);
            console.log(`   Database: $${dbValue.toFixed(2)}`);
            console.log(`   API: $${apiValue.toFixed(2)}`);
        }
        
        // 4. Riepilogo
        console.log('\n📊 4. RIEPILOGO COMPLETO:');
        const portfolio = await dbGet("SELECT balance_usd FROM portfolio WHERE id = 1");
        const openPositions = await dbAll("SELECT COUNT(*) as count, COALESCE(SUM(profit_loss), 0) as total_pnl FROM open_positions WHERE status = 'open'");
        
        console.log(`   Total Balance (Equity): $${dbValue.toFixed(2)}`);
        console.log(`   Cash (balance_usd): $${parseFloat(portfolio?.balance_usd || 0).toFixed(2)}`);
        console.log(`   Posizioni aperte: ${parseInt(openPositions[0]?.count || 0)}`);
        console.log(`   P&L totale (aperte): $${parseFloat(openPositions[0]?.total_pnl || 0).toFixed(2)}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ CONTROLLO COMPLETATO\n');
        
        return {
            totalBalance: dbValue,
            cash: parseFloat(portfolio?.balance_usd || 0),
            openPositions: parseInt(openPositions[0]?.count || 0),
            totalPnL: parseFloat(openPositions[0]?.total_pnl || 0),
            synchronized: match
        };
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    checkAndVerifyTotalBalance()
        .then((result) => {
            console.log('📋 Risultato:', JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { checkAndVerifyTotalBalance };

