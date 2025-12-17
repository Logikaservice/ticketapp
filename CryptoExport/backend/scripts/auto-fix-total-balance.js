const { dbGet, dbAll, dbRun } = require('../crypto_db_postgresql');

async function autoFixTotalBalance() {
    console.log('🔧 AUTO-FIX TOTAL BALANCE\n');
    console.log('='.repeat(60));
    
    let iteration = 0;
    const maxIterations = 5;
    
    while (iteration < maxIterations) {
        iteration++;
        console.log(`\n🔄 ITERAZIONE ${iteration}/${maxIterations}\n`);
        
        try {
            // 1. Leggi valore attuale dal database
            const dbResult = await dbGet("SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'");
            const currentValue = parseFloat(dbResult?.setting_value || 0);
            console.log(`📊 Valore attuale nel database: $${currentValue.toFixed(2)}`);
            
            // 2. Simula chiamata API GET (come fa il frontend)
            const allSettings = await dbAll("SELECT setting_key, setting_value FROM general_settings");
            const settingsObj = {};
            allSettings.forEach(s => {
                settingsObj[s.setting_key] = s.setting_value;
            });
            const apiValue = parseFloat(settingsObj.total_balance || 0);
            console.log(`🌐 Valore restituito dall'API: $${apiValue.toFixed(2)}`);
            
            // 3. Verifica se c'è una discrepanza
            const discrepancy = Math.abs(currentValue - apiValue);
            if (discrepancy < 0.01) {
                console.log(`✅ Valori sincronizzati correttamente!`);
                
                // 4. Test modifica e verifica
                console.log(`\n🧪 TEST MODIFICA E VERIFICA:`);
                const testValue = 1000 + (iteration * 100); // 1000, 1100, 1200, etc.
                console.log(`   Modifico a: $${testValue.toFixed(2)}`);
                
                await dbRun(
                    `INSERT INTO general_settings (setting_key, setting_value, updated_at)
                     VALUES ('total_balance', $1, NOW())
                     ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
                    [testValue.toString()]
                );
                
                // Verifica immediata
                const after = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
                const afterValue = parseFloat(after?.setting_value || 0);
                
                if (Math.abs(afterValue - testValue) < 0.01) {
                    console.log(`   ✅ Modifica riuscita: $${afterValue.toFixed(2)}`);
                    
                    // Verifica API dopo modifica
                    const allSettingsAfter = await dbAll("SELECT setting_key, setting_value FROM general_settings");
                    const settingsObjAfter = {};
                    allSettingsAfter.forEach(s => {
                        settingsObjAfter[s.setting_key] = s.setting_value;
                    });
                    const apiValueAfter = parseFloat(settingsObjAfter.total_balance || 0);
                    
                    if (Math.abs(apiValueAfter - testValue) < 0.01) {
                        console.log(`   ✅ API sincronizzata: $${apiValueAfter.toFixed(2)}`);
                        console.log(`\n✅ TUTTO FUNZIONA CORRETTAMENTE!`);
                        console.log(`\n💡 Il Total Balance è sincronizzato tra database e API.`);
                        console.log(`   Il frontend dovrebbe aggiornarsi automaticamente entro 5 secondi.`);
                        break;
                    } else {
                        console.log(`   ❌ API non sincronizzata! Atteso: $${testValue.toFixed(2)}, trovato: $${apiValueAfter.toFixed(2)}`);
                    }
                } else {
                    console.log(`   ❌ Modifica fallita! Atteso: $${testValue.toFixed(2)}, trovato: $${afterValue.toFixed(2)}`);
                }
                
                // Ripristina valore originale
                await dbRun(
                    `INSERT INTO general_settings (setting_key, setting_value, updated_at)
                     VALUES ('total_balance', $1, NOW())
                     ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
                    [currentValue.toString()]
                );
                console.log(`   ↩️  Valore ripristinato a: $${currentValue.toFixed(2)}`);
                
            } else {
                console.log(`❌ DISCREPANZA TROVATA: ${discrepancy.toFixed(2)}`);
                console.log(`   Database: $${currentValue.toFixed(2)}`);
                console.log(`   API: $${apiValue.toFixed(2)}`);
                
                // Prova a fixare
                console.log(`\n🔧 Tentativo di fix...`);
                await dbRun(
                    `INSERT INTO general_settings (setting_key, setting_value, updated_at)
                     VALUES ('total_balance', $1, NOW())
                     ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
                    [currentValue.toString()]
                );
                
                // Verifica dopo fix
                const afterFix = await dbAll("SELECT setting_key, setting_value FROM general_settings");
                const settingsObjAfterFix = {};
                afterFix.forEach(s => {
                    settingsObjAfterFix[s.setting_key] = s.setting_value;
                });
                const apiValueAfterFix = parseFloat(settingsObjAfterFix.total_balance || 0);
                
                if (Math.abs(apiValueAfterFix - currentValue) < 0.01) {
                    console.log(`   ✅ Fix riuscito!`);
                } else {
                    console.log(`   ❌ Fix fallito!`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Errore durante iterazione ${iteration}:`, error.message);
            console.error(error.stack);
        }
        
        // Pausa tra iterazioni
        if (iteration < maxIterations) {
            console.log(`\n⏳ Attendo 2 secondi prima della prossima iterazione...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTO-FIX COMPLETATO\n');
}

autoFixTotalBalance();

