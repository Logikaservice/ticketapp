const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp',
  ssl: { rejectUnauthorized: false }
});

async function fixDuplicateUser() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔍 Verifica utenti duplicati...');
    
    // Trova utenti duplicati
    const duplicates = await client.query(`
      SELECT id, email, ruolo, nome, cognome, azienda, created_at
      FROM users 
      WHERE email = 'info@logikaservice.it'
      ORDER BY id
    `);
    
    if (duplicates.rows.length < 2) {
      console.log('✅ Nessun duplicato trovato');
      await client.query('COMMIT');
      return;
    }
    
    console.log(`⚠️  Trovati ${duplicates.rows.length} utenti con email info@logikaservice.it:`);
    duplicates.rows.forEach(user => {
      console.log(`  - ID: ${user.id} | Creato: ${user.created_at || 'N/A'}`);
    });
    
    // Mantieni l'utente con ID più basso (ID 1)
    const keepUserId = duplicates.rows[0].id;
    const removeUserIds = duplicates.rows.slice(1).map(u => u.id);
    
    console.log(`\n✅ Mantengo utente ID: ${keepUserId}`);
    console.log(`🗑️  Rimuovo utenti ID: ${removeUserIds.join(', ')}`);
    
    // Verifica riferimenti in altre tabelle
    console.log('\n🔍 Verifica riferimenti in altre tabelle...');
    
    for (const removeId of removeUserIds) {
      // Verifica tickets
      const ticketsRef = await client.query(
        'SELECT COUNT(*) as count FROM tickets WHERE clienteid = $1 OR tecnicoid = $1',
        [removeId]
      );
      if (ticketsRef.rows[0].count > 0) {
        console.log(`  ⚠️  Ticket collegati all'utente ID ${removeId}: ${ticketsRef.rows[0].count}`);
        console.log(`  🔄 Aggiorno ticket per usare utente ID ${keepUserId}...`);
        await client.query(
          'UPDATE tickets SET clienteid = $1 WHERE clienteid = $2',
          [keepUserId, removeId]
        );
        await client.query(
          'UPDATE tickets SET tecnicoid = $1 WHERE tecnicoid = $2',
          [keepUserId, removeId]
        );
      }
      
      // Verifica access_logs
      const accessLogsRef = await client.query(
        'SELECT COUNT(*) as count FROM access_logs WHERE user_id = $1',
        [removeId]
      );
      if (accessLogsRef.rows[0].count > 0) {
        console.log(`  ⚠️  Log accessi collegati all'utente ID ${removeId}: ${accessLogsRef.rows[0].count}`);
        console.log(`  🔄 Aggiorno log accessi per usare utente ID ${keepUserId}...`);
        await client.query(
          'UPDATE access_logs SET user_id = $1 WHERE user_id = $2',
          [keepUserId, removeId]
        );
      }
      
      // Verifica keepass_entries (se esiste campo user_id)
      try {
        const keepassRef = await client.query(
          'SELECT COUNT(*) as count FROM keepass_entries WHERE user_id = $1',
          [removeId]
        );
        if (keepassRef.rows[0].count > 0) {
          console.log(`  ⚠️  Credenziali KeePass collegate all'utente ID ${removeId}: ${keepassRef.rows[0].count}`);
          console.log(`  🔄 Aggiorno credenziali KeePass per usare utente ID ${keepUserId}...`);
          await client.query(
            'UPDATE keepass_entries SET user_id = $1 WHERE user_id = $2',
            [keepUserId, removeId]
          );
        }
      } catch (err) {
        // Tabella potrebbe non avere campo user_id, ignora
      }
      
      // Rimuovi utente duplicato
      console.log(`  🗑️  Rimuovo utente ID ${removeId}...`);
      await client.query('DELETE FROM users WHERE id = $1', [removeId]);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Duplicati rimossi con successo!');
    
    // Verifica finale
    const finalCheck = await client.query(
      "SELECT COUNT(*) as count FROM users WHERE email = 'info@logikaservice.it'"
    );
    console.log(`\n📊 Utenti rimanenti con email info@logikaservice.it: ${finalCheck.rows[0].count}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Errore:', err.message);
    console.error(err.stack);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

fixDuplicateUser();

