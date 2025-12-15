/**
 * 🏥 CHECK SYSTEM HEALTH
 * 
 * Verifica stato sistema completo e mostra report
 */

const HealthCheckService = require('../services/HealthCheckService');

async function main() {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('🏥 VERIFICA SALUTE SISTEMA');
        console.log('='.repeat(80) + '\n');

        const status = await HealthCheckService.performCheck();

        console.log('\n' + '='.repeat(80));
        console.log('📋 AZIONI RACCOMANDATE');
        console.log('='.repeat(80) + '\n');

        if (status.overall === 'healthy') {
            console.log('🎉 Sistema completamente funzionante!');
            console.log('\n   Tutto ok:');
            console.log('   ✅ Backend attivo e risponde');
            console.log('   ✅ Database accessibile');
            console.log('   ✅ WebSocket connesso e salva dati');
            console.log('   ✅ Aggregatore crea klines automaticamente');
            console.log('\n   Il bot può operare senza problemi.');
        } else {
            console.log('🚨 Sistema ha problemi - RICHIEDE INTERVENTO\n');
            
            if (!status.backend.healthy) {
                console.log('1️⃣  BACKEND OFFLINE (Critico)');
                console.log('   Causa: Backend non risponde sulla porta 3001');
                console.log('   Impatto: WebSocket non può funzionare, bot non operativo');
                console.log('   Soluzione:');
                console.log('   → Windows: Doppio click su start-backend.bat');
                console.log('   → Manuale: cd backend && node index.js');
                console.log('');
            }

            if (!status.database.healthy) {
                console.log('2️⃣  DATABASE NON ACCESSIBILE (Critico)');
                console.log('   Causa:', status.database.error || 'Sconosciuta');
                console.log('   Impatto: Nessun dato può essere letto/scritto');
                console.log('   Soluzione:');
                console.log('   → Verifica connessione PostgreSQL');
                console.log('   → Controlla DATABASE_URL_CRYPTO in .env');
                console.log('');
            }

            if (!status.websocket.healthy && status.backend.healthy) {
                console.log('3️⃣  WEBSOCKET INATTIVO (Alto)');
                console.log('   Causa: Backend attivo ma WebSocket non salva dati');
                console.log('   Impatto: Nessun nuovo dato, gap continua');
                console.log('   Soluzione:');
                console.log('   → Riavvia backend: stop-backend.bat + start-backend.bat');
                console.log('   → Verifica log: cd backend && Get-Content -Wait backend.log');
                console.log('');
            }

            if (!status.aggregator.healthy && status.websocket.healthy) {
                console.log('4️⃣  AGGREGATORE NON CREA KLINES (Medio)');
                console.log('   Causa: WebSocket funziona ma aggregatore non crea klines');
                console.log('   Impatto: Klines non aggiornate, analisi tecniche imprecise');
                console.log('   Soluzione:');
                console.log('   → Verifica errori nei log');
                console.log('   → Riavvia backend');
                console.log('');
            }
        }

        console.log('='.repeat(80));
        console.log('💡 COMANDI UTILI');
        console.log('='.repeat(80) + '\n');
        console.log('   Avvia backend:   start-backend.bat');
        console.log('   Ferma backend:   stop-backend.bat');
        console.log('   Verifica stato:  node backend/scripts/check-system-health.js');
        console.log('   Log backend:     cd backend && Get-Content -Wait backend.log');
        console.log('\n' + '='.repeat(80) + '\n');

        process.exit(status.overall === 'healthy' ? 0 : 1);
    } catch (error) {
        console.error('❌ Errore verifica:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();



