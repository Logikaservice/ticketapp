/**
 * Script per accesso autonomo al database da parte dell'AI
 * Questo script può essere eseguito direttamente sul server
 */

const { dbGet, dbAll, dbRun } = require('../crypto_db_postgresql');

/**
 * Controlla il Total Balance nel database e confronta con API
 */
async function checkTotalBalance() {
    console.log('🔍 CONTROLLO TOTAL BALANCE\n');
    
    try {
        // 1. Leggi dal database
        const dbResult = await dbGet("SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'");
        const dbValue = parseFloat(dbResult?.setting_value || 0);
        console.log(`📊 Database: $${dbValue.toFixed(2)}`);
        console.log(`   Ultimo aggiornamento: ${dbResult?.updated_at || 'N/A'}`);
        
        // 2. Simula API GET
        const allSettings = await dbAll("SELECT setting_key, setting_value FROM general_settings");
        const settingsObj = {};
        allSettings.forEach(s => {
            settingsObj[s.setting_key] = s.setting_value;
        });
        const apiValue = parseFloat(settingsObj.total_balance || 0);
        console.log(`🌐 API restituisce: $${apiValue.toFixed(2)}`);
        
        // 3. Confronto
        const match = Math.abs(dbValue - apiValue) < 0.01;
        if (match) {
            console.log(`✅ Valori sincronizzati correttamente!`);
        } else {
            console.log(`❌ DISCREPANZA: ${Math.abs(dbValue - apiValue).toFixed(2)}`);
        }
        
        return { dbValue, apiValue, match };
    } catch (error) {
        console.error('❌ Errore:', error.message);
        throw error;
    }
}

/**
 * Modifica il Total Balance e verifica
 */
async function modifyAndVerifyTotalBalance(newValue) {
    console.log(`\n🔄 MODIFICA TOTAL BALANCE A: $${newValue.toFixed(2)}\n`);
    
    try {
        // 1. Leggi valore attuale
        const before = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
        const beforeValue = parseFloat(before?.setting_value || 0);
        console.log(`📊 Valore prima: $${beforeValue.toFixed(2)}`);
        
        // 2. Modifica
        await dbRun(
            `INSERT INTO general_settings (setting_key, setting_value, updated_at)
             VALUES ('total_balance', $1, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
            [newValue.toString()]
        );
        
        // 3. Verifica dopo modifica
        const after = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
        const afterValue = parseFloat(after?.setting_value || 0);
        console.log(`📊 Valore dopo: $${afterValue.toFixed(2)}`);
        
        // 4. Verifica API
        const allSettings = await dbAll("SELECT setting_key, setting_value FROM general_settings");
        const settingsObj = {};
        allSettings.forEach(s => {
            settingsObj[s.setting_key] = s.setting_value;
        });
        const apiValue = parseFloat(settingsObj.total_balance || 0);
        console.log(`🌐 API restituisce: $${apiValue.toFixed(2)}`);
        
        // 5. Risultato
        const dbMatch = Math.abs(afterValue - newValue) < 0.01;
        const apiMatch = Math.abs(apiValue - newValue) < 0.01;
        
        if (dbMatch && apiMatch) {
            console.log(`✅ Modifica e sincronizzazione riuscite!`);
            return { success: true, beforeValue, afterValue, apiValue };
        } else {
            console.log(`❌ Problema nella modifica:`);
            if (!dbMatch) console.log(`   - Database non aggiornato correttamente`);
            if (!apiMatch) console.log(`   - API non sincronizzata`);
            return { success: false, beforeValue, afterValue, apiValue };
        }
    } catch (error) {
        console.error('❌ Errore:', error.message);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'check') {
        checkTotalBalance()
            .then(() => process.exit(0))
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    } else if (command === 'modify' && args[1]) {
        const value = parseFloat(args[1]);
        modifyAndVerifyTotalBalance(value)
            .then(() => process.exit(0))
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    } else {
        console.log('Usage:');
        console.log('  node ai-db-access.js check                    - Controlla Total Balance');
        console.log('  node ai-db-access.js modify <value>          - Modifica Total Balance');
    }
}

module.exports = {
    checkTotalBalance,
    modifyAndVerifyTotalBalance
};

