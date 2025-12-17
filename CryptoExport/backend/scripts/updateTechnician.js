// scripts/updateTechnician.js

// Usa fetch nativo di Node.js (disponibile dalla versione 18+)
const fetch = globalThis.fetch || require('node-fetch');

// Configurazione
const API_URL = process.env.API_URL || 'https://ticket.logikaservice.it';
const TECHNICIAN_EMAIL = 'tecnico@example.com';
const NEW_PASSWORD = 'nuovaPasswordSicura123!';

async function updateTechnician() {
  console.log('🔄 Aggiornamento credenziali tecnico...');
  console.log('📧 Email tecnico:', TECHNICIAN_EMAIL);
  console.log('🔐 Nuova password:', NEW_PASSWORD);
  
  try {
    // Prima fai login per ottenere il token
    console.log('🔑 Login tecnico...');
    const loginResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TECHNICIAN_EMAIL,
        password: 'tecnico123' // Password attuale
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login fallito:', loginResponse.status);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login riuscito');
    
    // Ora aggiorna le credenziali
    console.log('🔄 Aggiornamento credenziali...');
    const updateResponse = await fetch(`${API_URL}/api/users/${loginData.user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        email: TECHNICIAN_EMAIL,
        password: NEW_PASSWORD,
        nome: loginData.user.nome,
        cognome: loginData.user.cognome,
        telefono: loginData.user.telefono,
        azienda: loginData.user.azienda
      })
    });
    
    if (!updateResponse.ok) {
      console.error('❌ Aggiornamento fallito:', updateResponse.status);
      const errorText = await updateResponse.text();
      console.error('Errore:', errorText);
      return;
    }
    
    const updateData = await updateResponse.json();
    console.log('✅ Credenziali aggiornate con successo');
    console.log('📧 Nuova email:', updateData.email);
    console.log('🔐 Password hashata e aggiornata');
    
    // Testa il login con le nuove credenziali
    console.log('🧪 Test login con nuove credenziali...');
    const testLoginResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TECHNICIAN_EMAIL,
        password: NEW_PASSWORD
      })
    });
    
    if (!testLoginResponse.ok) {
      console.error('❌ Test login fallito');
      return;
    }
    
    console.log('✅ Test login riuscito con nuove credenziali');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

// Esegui lo script
if (require.main === module) {
  updateTechnician();
}

module.exports = { updateTechnician };
