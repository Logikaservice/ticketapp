// Script per resettare tutti i dispositivi di Theorica (Agent ID 11)
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const THEORICA_AGENT_ID = 11;

async function resetTheorica() {
    console.log(`\n🗑️  === RESET DISPOSITIVI THEORICA (Agent ID ${THEORICA_AGENT_ID}) ===\n`);

    try {
        // Conta dispositivi prima
        const beforeCount = await pool.query(
            'SELECT COUNT(*) FROM network_devices WHERE agent_id = $1',
            [THEORICA_AGENT_ID]
        );

        console.log(`📊 Dispositivi attuali: ${beforeCount.rows[0].count}\n`);

        if (beforeCount.rows[0].count === '0') {
            console.log('⚠️  Nessun dispositivo da eliminare\n');
            return;
        }

        // Conferma
        console.log('⚠️  ATTENZIONE: Questa operazione eliminerà TUTTI i dispositivi di Theorica!\n');
        console.log('🔄 Procedendo con l\'eliminazione...\n');

        // Prima rimuovi i riferimenti parent_device_id che puntano a dispositivi di Theorica
        await pool.query(`
      UPDATE network_devices 
      SET parent_device_id = NULL 
      WHERE parent_device_id IN (
        SELECT id FROM network_devices WHERE agent_id = $1
      )
    `, [THEORICA_AGENT_ID]);

        console.log('✅ Rimossi riferimenti parent_device_id\n');

        // Elimina tutti i dispositivi
        const deleteResult = await pool.query(
            'DELETE FROM network_devices WHERE agent_id = $1',
            [THEORICA_AGENT_ID]
        );

        console.log(`✅ Eliminati ${deleteResult.rowCount} dispositivi\n`);

        // Verifica
        const afterCount = await pool.query(
            'SELECT COUNT(*) FROM network_devices WHERE agent_id = $1',
            [THEORICA_AGENT_ID]
        );

        console.log(`📊 Dispositivi rimanenti: ${afterCount.rows[0].count}\n`);

        console.log('✅ === RESET COMPLETATO ===\n');
        console.log('🔄 L\'agent ricaricherà i dispositivi al prossimo scan\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

resetTheorica();
