// Script per cancellare TUTTI i dispositivi di TUTTI gli agent di Theorica
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function deleteAllTheoricaDevices() {
    console.log('\n🗑️  === CANCELLAZIONE COMPLETA DISPOSITIVI THEORICA ===\n');

    try {
        // Trova tutti gli agent di Theorica
        const agentsResult = await pool.query(`
      SELECT na.id, na.agent_name, u.azienda 
      FROM network_agents na 
      LEFT JOIN users u ON na.azienda_id = u.id 
      WHERE LOWER(u.azienda) LIKE '%theorica%' OR LOWER(na.agent_name) LIKE '%theorica%'
    `);

        if (agentsResult.rows.length === 0) {
            console.log('❌ Nessun agent trovato per Theorica\n');
            return;
        }

        console.log(`📌 Trovati ${agentsResult.rows.length} agent per Theorica:\n`);
        agentsResult.rows.forEach(a => {
            console.log(`   - Agent ID: ${a.id}, Nome: ${a.agent_name}, Azienda: ${a.azienda}`);
        });

        const agentIds = agentsResult.rows.map(a => a.id);

        // Conta dispositivi prima
        const beforeCount = await pool.query(
            'SELECT COUNT(*) FROM network_devices WHERE agent_id = ANY($1::int[])',
            [agentIds]
        );

        console.log(`\n📊 Dispositivi totali da eliminare: ${beforeCount.rows[0].count}\n`);

        if (beforeCount.rows[0].count === '0') {
            console.log('⚠️  Nessun dispositivo da eliminare\n');
            return;
        }

        console.log('🔄 Procedendo con l\'eliminazione...\n');

        // Rimuovi riferimenti parent_device_id
        await pool.query(`
      UPDATE network_devices 
      SET parent_device_id = NULL 
      WHERE parent_device_id IN (
        SELECT id FROM network_devices WHERE agent_id = ANY($1::int[])
      )
    `, [agentIds]);

        console.log('✅ Rimossi riferimenti parent_device_id\n');

        // Elimina tutti i dispositivi
        const deleteResult = await pool.query(
            'DELETE FROM network_devices WHERE agent_id = ANY($1::int[])',
            [agentIds]
        );

        console.log(`✅ Eliminati ${deleteResult.rowCount} dispositivi\n`);

        // Verifica
        const afterCount = await pool.query(
            'SELECT COUNT(*) FROM network_devices WHERE agent_id = ANY($1::int[])',
            [agentIds]
        );

        console.log(`📊 Dispositivi rimanenti: ${afterCount.rows[0].count}\n`);

        console.log('✅ === CANCELLAZIONE COMPLETATA ===\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

deleteAllTheoricaDevices();
