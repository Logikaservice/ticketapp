const { dbGet, dbAll, dbRun } = require('../crypto_db_postgresql');

async function testTotalBalanceChange() {
    console.log('🧪 TEST MODIFICA E VERIFICA TOTAL BALANCE\n');
    console.log('='.repeat(60));
    
    try {
        // 1. Leggi valore attuale
        console.log('\n📊 1. VALORE ATTUALE NEL DATABASE:');
        const current = await dbGet("SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'");
        const currentValue = parseFloat(current?.setting_value || 0);
        console.log(`   Valore attuale: $${currentValue.toFixed(2)}`);
        console.log(`   Ultimo aggiornamento: ${current?.updated_at || 'N/A'}`);
        
        // 2. Genera un valore di test univoco (basato su timestamp)
        const testValue = 1000 + (Date.now() % 10000) / 100; // Valore tra 1000 e 1100
        console.log(`\n🔄 2. MODIFICO A: $${testValue.toFixed(2)}`);
        
        // 3. Modifica nel database
        await dbRun(
            `INSERT INTO general_settings (setting_key, setting_value, updated_at)
             VALUES ('total_balance', $1, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
            [testValue.toString()]
        );
        
        // 4. Verifica immediatamente dopo modifica
        console.log('\n✅ 3. VERIFICA DOPO MODIFICA:');
        const after = await dbGet("SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'");
        const afterValue = parseFloat(after?.setting_value || 0);
        
        if (Math.abs(afterValue - testValue) < 0.01) {
            console.log(`   ✅ Database aggiornato correttamente: $${afterValue.toFixed(2)}`);
        } else {
            console.log(`   ❌ ERRORE: Valore atteso $${testValue.toFixed(2)}, trovato $${afterValue.toFixed(2)}`);
            return;
        }
        
        // 5. Simula chiamata API GET (come fa il frontend)
        console.log('\n🌐 4. SIMULAZIONE API GET /api/crypto/general-settings:');
        const allSettings = await dbAll("SELECT setting_key, setting_value FROM general_settings");
        const settingsObj = {};
        allSettings.forEach(s => {
            settingsObj[s.setting_key] = s.setting_value;
        });
        const apiValue = parseFloat(settingsObj.total_balance || 0);
        
        if (Math.abs(apiValue - testValue) < 0.01) {
            console.log(`   ✅ API restituisce correttamente: $${apiValue.toFixed(2)}`);
            console.log(`   📦 Oggetto completo:`, JSON.stringify(settingsObj, null, 2));
        } else {
            console.log(`   ❌ ERRORE API: Valore atteso $${testValue.toFixed(2)}, API restituisce $${apiValue.toFixed(2)}`);
        }
        
        // 6. Verifica formato (stringa vs numero)
        console.log('\n🔍 5. VERIFICA FORMATO DATI:');
        console.log(`   Tipo nel database (raw): ${typeof after.setting_value}`);
        console.log(`   Valore raw: "${after.setting_value}"`);
        console.log(`   Valore parsato: ${apiValue}`);
        console.log(`   Valore nel settingsObj: "${settingsObj.total_balance}"`);
        
        // 7. Test con valori diversi
        console.log('\n🔄 6. TEST CON VALORI DIVERSI:');
        const testValues = [500.50, 1500.75, 2000.00, 999.99];
        for (const val of testValues) {
            await dbRun(
                `INSERT INTO general_settings (setting_key, setting_value, updated_at)
                 VALUES ('total_balance', $1, NOW())
                 ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
                [val.toString()]
            );
            
            const verify = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
            const verifyValue = parseFloat(verify?.setting_value || 0);
            
            if (Math.abs(verifyValue - val) < 0.01) {
                console.log(`   ✅ $${val.toFixed(2)} → $${verifyValue.toFixed(2)} ✓`);
            } else {
                console.log(`   ❌ $${val.toFixed(2)} → $${verifyValue.toFixed(2)} ✗`);
            }
        }
        
        // 8. Ripristina valore originale
        console.log(`\n↩️  7. RIPRISTINO VALORE ORIGINALE: $${currentValue.toFixed(2)}`);
        await dbRun(
            `INSERT INTO general_settings (setting_key, setting_value, updated_at)
             VALUES ('total_balance', $1, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
            [currentValue.toString()]
        );
        
        const restored = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
        const restoredValue = parseFloat(restored?.setting_value || 0);
        
        if (Math.abs(restoredValue - currentValue) < 0.01) {
            console.log(`   ✅ Valore ripristinato: $${restoredValue.toFixed(2)}`);
        } else {
            console.log(`   ⚠️  Valore ripristinato: $${restoredValue.toFixed(2)} (atteso: $${currentValue.toFixed(2)})`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETATO\n');
        console.log('💡 PROSSIMI PASSI:');
        console.log('   1. Esegui questo script sul server');
        console.log('   2. Controlla il frontend - dovrebbe aggiornarsi automaticamente ogni 5 secondi');
        console.log('   3. Se non si aggiorna, verifica la console del browser per errori\n');
        
    } catch (error) {
        console.error('❌ Errore durante il test:', error.message);
        console.error(error.stack);
    }
}

testTotalBalanceChange();
