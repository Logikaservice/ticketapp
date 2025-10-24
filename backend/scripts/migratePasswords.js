// scripts/migratePasswords.js

const { Pool } = require('pg');
const { hashPassword, isPasswordHashed } = require('../utils/passwordUtils');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Migra tutte le password in chiaro a hash
 */
async function migrateAllPasswords() {
  console.log('🔄 Inizio migrazione password esistenti...');
  
  try {
    const client = await pool.connect();
    
    // Ottieni tutti gli utenti
    const result = await client.query('SELECT id, email, password FROM users');
    const users = result.rows;
    
    console.log(`📊 Trovati ${users.length} utenti da verificare`);
    
    let migratedCount = 0;
    let alreadyHashedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        const { id, email, password } = user;
        
        // Verifica se la password è già hashata
        if (isPasswordHashed(password)) {
          console.log(`✅ Password già hashata per: ${email}`);
          alreadyHashedCount++;
          continue;
        }
        
        // Hasha la password in chiaro
        const hashedPassword = await hashPassword(password);
        
        // Aggiorna nel database
        await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
        
        console.log(`🔐 Password migrata per: ${email}`);
        migratedCount++;
        
      } catch (userErr) {
        console.error(`❌ Errore migrazione per ${user.email}:`, userErr.message);
        errorCount++;
      }
    }
    
    client.release();
    
    console.log('\n📈 Riepilogo migrazione:');
    console.log(`✅ Password migrate: ${migratedCount}`);
    console.log(`✅ Password già hashate: ${alreadyHashedCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    console.log(`📊 Totale utenti: ${users.length}`);
    
    if (migratedCount > 0) {
      console.log('\n🎉 Migrazione completata con successo!');
    } else {
      console.log('\n✅ Tutte le password erano già hashate!');
    }
    
  } catch (err) {
    console.error('❌ Errore critico durante la migrazione:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Verifica lo stato delle password nel database
 */
async function checkPasswordStatus() {
  console.log('🔍 Verifica stato password nel database...');
  
  try {
    const client = await pool.connect();
    
    const result = await client.query('SELECT id, email, password FROM users');
    const users = result.rows;
    
    let hashedCount = 0;
    let plainCount = 0;
    
    for (const user of users) {
      if (isPasswordHashed(user.password)) {
        hashedCount++;
      } else {
        plainCount++;
        console.log(`⚠️ Password in chiaro per: ${user.email}`);
      }
    }
    
    client.release();
    
    console.log(`\n📊 Stato password:`);
    console.log(`🔐 Password hashate: ${hashedCount}`);
    console.log(`⚠️ Password in chiaro: ${plainCount}`);
    console.log(`📊 Totale utenti: ${users.length}`);
    
  } catch (err) {
    console.error('❌ Errore verifica password:', err);
  } finally {
    await pool.end();
  }
}

// Esegui lo script se chiamato direttamente
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'migrate') {
    migrateAllPasswords();
  } else if (command === 'check') {
    checkPasswordStatus();
  } else {
    console.log('Uso: node migratePasswords.js [migrate|check]');
    console.log('  migrate - Migra tutte le password in chiaro a hash');
    console.log('  check   - Verifica lo stato delle password');
  }
}

module.exports = { migrateAllPasswords, checkPasswordStatus };
