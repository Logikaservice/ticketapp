const { dbGet, dbRun } = require('../crypto_db_postgresql');

async function testTotalBalanceChange() {
    console.log('🧪 TEST MODIFICA TOTAL BALANCE\n');
    console.log('='.repeat(60));
    
    try {
        // 1. Leggi valore attuale
        console.log('\n📊 1. VALORE ATTUALE NEL DATABASE:');
        const current = await dbGet(
            "SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'"
        );
        
        if (current) {
            const currentValue = parseFloat(current.setting_value || 0);
            console.log(`   ✅ Total Balance attuale: $${currentValue.toFixed(2)}`);
            console.log(`   📅 Ultimo aggiornamento: ${current.updated_at}`);
        } else {
            console.log(`   ❌ Total Balance non trovato - creo valore di default $1000.00`);
            await dbRun(
                `INSERT INTO general_settings (setting_key, setting_value, updated_at)
                 VALUES ('total_balance', '1000.0', NOW())
                 ON CONFLICT (setting_key) DO NOTHING`
            );
        }
        
        // 2. Modifica a valore di test
        const testValue = 2500.75;
        console.log(`\n🔄 2. MODIFICA A: $${testValue.toFixed(2)}`);
        
        await dbRun(
            `INSERT INTO general_settings (setting_key, setting_value, updated_at)
             VALUES ('total_balance', $1, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
            [testValue.toString()]
        );
        
        // 3. Verifica modifica
        const updated = await dbGet(
            "SELECT setting_value, updated_at FROM general_settings WHERE setting_key = 'total_balance'"
        );
        const updatedValue = parseFloat(updated.setting_value || 0);
        
        console.log(`   ✅ Valore dopo modifica: $${updatedValue.toFixed(2)}`);
        console.log(`   📅 Aggiornato: ${updated.updated_at}`);
        
        if (Math.abs(updatedValue - testValue) < 0.01) {
            console.log(`   ✅ MODIFICA RIUSCITA!`);
        } else {
            console.log(`   ❌ ERRORE: Valore non corrisponde! Atteso: $${testValue.toFixed(2)}, Trovato: $${updatedValue.toFixed(2)}`);
        }
        
        // 4. Istruzioni per verificare nel frontend
        console.log('\n' + '='.repeat(60));
        console.log('📋 VERIFICA NEL FRONTEND:');
        console.log(`   1. Apri la console del browser (F12)`);
        console.log(`   2. Cerca i log: [TOTAL-BALANCE]`);
        console.log(`   3. Il Total Balance visualizzato dovrebbe essere: $${updatedValue.toFixed(2)}`);
        console.log(`   4. Se non corrisponde, controlla i log per errori`);
        console.log(`   5. Il frontend si aggiorna automaticamente ogni 5 secondi`);
        
        console.log('\n💡 PROSSIMI TEST:');
        console.log(`   - Modifica il valore nelle Impostazioni Generali`);
        console.log(`   - Verifica che si salvi nel database`);
        console.log(`   - Verifica che si aggiorni automaticamente nel frontend`);
        
    } catch (error) {
        console.error('❌ ERRORE durante il test:', error.message);
        console.error(error.stack);
    }
}

testTotalBalanceChange();

