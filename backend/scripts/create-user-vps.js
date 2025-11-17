const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp',
  ssl: { rejectUnauthorized: false }
});

const userData = {
  email: 'info@logikaservice.it',
  password: 'Logika000.',
  ruolo: 'tecnico',
  nome: 'Alessandro',
  cognome: 'Rapa',
  azienda: 'Logika Service',
  telefono: null
};

pool.query(`
  INSERT INTO users (email, password, ruolo, nome, cognome, azienda, telefono)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id, email, ruolo, nome, azienda
`, [
  userData.email,
  userData.password,
  userData.ruolo,
  userData.nome,
  userData.cognome,
  userData.azienda,
  userData.telefono
])
  .then(result => {
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Utente creato con successo:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Ruolo:', user.ruolo);
      console.log('  Nome:', user.nome);
      console.log('  Azienda:', user.azienda);
      console.log('');
      console.log('🔐 Password: Logika000.');
    }
    pool.end();
  })
  .catch(err => {
    if (err.code === '23505') { // Unique violation
      console.log('⚠️ Utente già esistente (email duplicata)');
      console.log('💡 Possiamo aggiornare la password se vuoi');
    } else {
      console.error('❌ Errore:', err.message);
    }
    pool.end();
  });

