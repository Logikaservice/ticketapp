const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    // Conta utenti
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('👥 Utenti nel database:', usersResult.rows[0].count);
    
    // Conta ticket
    const ticketsResult = await pool.query('SELECT COUNT(*) as count FROM tickets');
    console.log('🎫 Ticket nel database:', ticketsResult.rows[0].count);
    
    // Lista utenti
    const usersList = await pool.query('SELECT id, email, ruolo, nome, azienda FROM users ORDER BY id');
    console.log('\n📋 Lista utenti:');
    usersList.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.ruolo}) - ${user.nome} - ${user.azienda}`);
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
    
    pool.end();
  } catch (err) {
    console.error('❌ Errore:', err.message);
    pool.end();
  }
}

checkDatabase();

