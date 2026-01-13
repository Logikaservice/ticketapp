/**
 * Script per contare quanti record di cambiamenti rete sono presenti nel database
 * Uso: node backend/scripts/conta-cambiamenti-rete.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

async function contaCambiamenti() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('📊 CONTO CAMBIAMENTI RETE NEL DATABASE');
    console.log('============================================================\n');

    // Conta totale record
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM network_changes');
    const total = parseInt(totalResult.rows[0].total, 10);

    // Conta per tipo di cambiamento
    const typeResult = await pool.query(`
      SELECT change_type, COUNT(*) as count 
      FROM network_changes 
      GROUP BY change_type 
      ORDER BY count DESC
    `);

    // Conta per periodo (ultimi 7, 30, 90 giorni)
    const periodResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days') as ultimi_7_giorni,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '30 days') as ultimi_30_giorni,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '90 days') as ultimi_90_giorni,
        MIN(detected_at) as primo_cambiamento,
        MAX(detected_at) as ultimo_cambiamento
      FROM network_changes
    `);

    // Conta per agent
    const agentResult = await pool.query(`
      SELECT 
        na.agent_name,
        COUNT(*) as count
      FROM network_changes nc
      INNER JOIN network_agents na ON nc.agent_id = na.id
      GROUP BY na.agent_name
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log(`📋 TOTALE RECORD: ${total.toLocaleString()}\n`);

    console.log('📊 PER TIPO DI CAMBIAMENTO:');
    console.log('─'.repeat(60));
    typeResult.rows.forEach(row => {
      const percent = ((parseInt(row.count, 10) / total) * 100).toFixed(1);
      console.log(`   ${row.change_type.padEnd(20)} ${parseInt(row.count, 10).toLocaleString().padStart(10)} (${percent}%)`);
    });
    console.log('');

    console.log('📅 PER PERIODO:');
    console.log('─'.repeat(60));
    const period = periodResult.rows[0];
    console.log(`   Ultimi 7 giorni:   ${parseInt(period.ultimi_7_giorni, 10).toLocaleString().padStart(10)}`);
    console.log(`   Ultimi 30 giorni:  ${parseInt(period.ultimi_30_giorni, 10).toLocaleString().padStart(10)}`);
    console.log(`   Ultimi 90 giorni:  ${parseInt(period.ultimi_90_giorni, 10).toLocaleString().padStart(10)}`);
    console.log(`   Primo cambiamento:  ${period.primo_cambiamento ? new Date(period.primo_cambiamento).toLocaleString('it-IT') : 'N/A'}`);
    console.log(`   Ultimo cambiamento: ${period.ultimo_cambiamento ? new Date(period.ultimo_cambiamento).toLocaleString('it-IT') : 'N/A'}`);
    console.log('');

    if (agentResult.rows.length > 0) {
      console.log('🤖 TOP 10 AGENT:');
      console.log('─'.repeat(60));
      agentResult.rows.forEach((row, index) => {
        console.log(`   ${(index + 1).toString().padStart(2)}. ${row.agent_name.padEnd(30)} ${parseInt(row.count, 10).toLocaleString().padStart(10)}`);
      });
      console.log('');
    }

    console.log('============================================================');
    console.log('✅ Conteggio completato!');
    console.log('============================================================\n');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Errore:', err.message);
    if (err.stack) {
      console.error('\nStack trace:');
      console.error(err.stack);
    }
    await pool.end();
    process.exit(1);
  }
}

contaCambiamenti();
