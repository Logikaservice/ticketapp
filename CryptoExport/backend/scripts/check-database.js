const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    console.log('📊 Verifica completa del database:\n');
    
    // Conta utenti
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('👥 Utenti nel database:', usersResult.rows[0].count);
    
    // Conta ticket
    const ticketsResult = await pool.query('SELECT COUNT(*) as count FROM tickets');
    console.log('🎫 Ticket nel database:', ticketsResult.rows[0].count);
    
    // Conta alerts
    const alertsResult = await pool.query('SELECT COUNT(*) as count FROM alerts');
    console.log('📢 Avvisi nel database:', alertsResult.rows[0].count);
    
    // Conta access_logs
    const accessLogsResult = await pool.query('SELECT COUNT(*) as count FROM access_logs');
    console.log('📝 Log accessi nel database:', accessLogsResult.rows[0].count);
    
    // Verifica duplicati utenti
    const duplicatesResult = await pool.query(`
      SELECT email, COUNT(*) as count 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);
    if (duplicatesResult.rows.length > 0) {
      console.log('\n⚠️  Utenti duplicati trovati:');
      duplicatesResult.rows.forEach(dup => {
        console.log(`  - ${dup.email}: ${dup.count} occorrenze`);
      });
    }
    
    // Lista utenti
    const usersList = await pool.query('SELECT id, email, ruolo, nome, azienda FROM users ORDER BY id');
    console.log('\n📋 Lista utenti:');
    usersList.rows.forEach(user => {
      console.log(`  - ID: ${user.id} | ${user.email} (${user.ruolo}) - ${user.nome || 'N/A'} - ${user.azienda || 'N/A'}`);
    });
    
    // Lista ticket (primi 5)
    const ticketsList = await pool.query('SELECT id, numero, titolo, stato, clienteid FROM tickets ORDER BY id LIMIT 5');
    if (ticketsList.rows.length > 0) {
      console.log('\n🎫 Primi 5 ticket:');
      ticketsList.rows.forEach(ticket => {
        console.log(`  - ${ticket.numero}: ${ticket.titolo} (${ticket.stato})`);
      });
    } else {
      console.log('\n🎫 Nessun ticket nel database');
    }
    
    // Verifica tabelle esistenti
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('\n📑 Tabelle nel database:');
    tablesResult.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    pool.end();
  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error(err.stack);
    pool.end();
  }
}

checkDatabase();

