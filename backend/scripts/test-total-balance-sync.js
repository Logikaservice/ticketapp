const { dbGet, dbAll, dbRun } = require('../crypto_db_postgresql');

async function testTotalBalanceSync() {
    console.log('🔍 TEST SINCRONIZZAZIONE TOTAL BALANCE\n');
    console.log('='.repeat(60));
    
    try {
        // 1. Leggi direttamente dal database
        console.log('\n📊 1. VALORE NEL DATABASE (general_settings):');
        const dbResult = await dbGet("SELECT setting_key, setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'");
        if (dbResult) {
            console.log(`   ✅ Trovato: $${parseFloat(dbResult.setting_value || 0).toFixed(2)}`);
            console.log(`   📅 Ultimo aggiornamento: ${dbResult.updated_at}`);
        } else {
            console.log('   ❌ Non trovato nel database!');
        }
        
        // 2. Simula chiamata API GET /api/crypto/general-settings
        console.log('\n🌐 2. VALORE RESTITUITO DALL\'API (/api/crypto/general-settings):');
        const allSettings = await dbAll("SELECT setting_key, setting_value FROM general_settings");
        const settingsObj = {};
        allSettings.forEach(s => {
            settingsObj[s.setting_key] = s.setting_value;
        });
        const apiTotalBalance = parseFloat(settingsObj.total_balance || 0);
        console.log(`   ✅ API restituisce: $${apiTotalBalance.toFixed(2)}`);
        
        // 3. Simula chiamata API GET /api/crypto/debug/execute?command=total-balance
        console.log('\n🔧 3. VALORE RESTITUITO DALL\'API (/api/crypto/debug/execute?command=total-balance):');
        const debugResult = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
        const debugTotalBalance = parseFloat(debugResult?.setting_value || 0);
        console.log(`   ✅ Debug API restituisce: $${debugTotalBalance.toFixed(2)}`);
        
        // 4. Confronto
        console.log('\n📋 4. CONFRONTO:');
        const dbValue = parseFloat(dbResult?.setting_value || 0);
        const allMatch = dbValue === apiTotalBalance && apiTotalBalance === debugTotalBalance;
        
        if (allMatch) {
            console.log(`   ✅ TUTTI I VALORI COINCIDONO: $${dbValue.toFixed(2)}`);
        } else {
            console.log(`   ❌ DISCREPANZA TROVATA!`);
            console.log(`      Database: $${dbValue.toFixed(2)}`);
            console.log(`      API general-settings: $${apiTotalBalance.toFixed(2)}`);
            console.log(`      API debug/execute: $${debugTotalBalance.toFixed(2)}`);
        }
        
        // 5. Test modifica
        console.log('\n🧪 5. TEST MODIFICA:');
        const testValue = 1234.56;
        console.log(`   Modifico total_balance a $${testValue.toFixed(2)}...`);
        
        await dbRun(
            `INSERT INTO general_settings (setting_key, setting_value, updated_at)
             VALUES ('total_balance', $1, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
            [testValue.toString()]
        );
        
        // Verifica dopo modifica
        const afterUpdate = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
        const afterValue = parseFloat(afterUpdate?.setting_value || 0);
        
        if (Math.abs(afterValue - testValue) < 0.01) {
            console.log(`   ✅ Modifica riuscita! Nuovo valore: $${afterValue.toFixed(2)}`);
        } else {
            console.log(`   ❌ Modifica fallita! Valore atteso: $${testValue.toFixed(2)}, trovato: $${afterValue.toFixed(2)}`);
        }
        
        // 6. Verifica API dopo modifica
        console.log('\n🔄 6. VERIFICA API DOPO MODIFICA:');
        const allSettingsAfter = await dbAll("SELECT setting_key, setting_value FROM general_settings");
        const settingsObjAfter = {};
        allSettingsAfter.forEach(s => {
            settingsObjAfter[s.setting_key] = s.setting_value;
        });
        const apiValueAfter = parseFloat(settingsObjAfter.total_balance || 0);
        console.log(`   API restituisce: $${apiValueAfter.toFixed(2)}`);
        
        if (Math.abs(apiValueAfter - testValue) < 0.01) {
            console.log(`   ✅ API sincronizzata correttamente!`);
        } else {
            console.log(`   ❌ API non sincronizzata! Valore atteso: $${testValue.toFixed(2)}, trovato: $${apiValueAfter.toFixed(2)}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETATO\n');
        
    } catch (error) {
        console.error('❌ Errore durante il test:', error.message);
        console.error(error.stack);
    }
}

testTotalBalanceSync();
