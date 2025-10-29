#!/usr/bin/env node

/**
 * Script per sincronizzare tutti i ticket esistenti con Google Calendar
 * Aggiorna i titoli degli eventi con i nomi delle aziende corrette
 */

// Usa fetch nativo di Node.js (disponibile dalla versione 18+)

// Configurazione
const API_URL = process.env.API_URL || 'https://ticketapp-backend-ton5.onrender.com';
const ENDPOINT = '/api/bulk-sync-google-calendar';

async function bulkSyncCalendar() {
  try {
    console.log('🚀 Avvio sincronizzazione massa Google Calendar...');
    console.log(`📡 Endpoint: ${API_URL}${ENDPOINT}`);
    
    const response = await fetch(`${API_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Sincronizzazione completata con successo!');
      console.log(`📊 Risultati:`);
      console.log(`   - Aggiornati: ${result.updated} ticket`);
      console.log(`   - Errori: ${result.errors} ticket`);
      
      if (result.errorDetails && result.errorDetails.length > 0) {
        console.log('\n❌ Dettagli errori:');
        result.errorDetails.forEach(error => {
          console.log(`   - Ticket #${error.numero}: ${error.error}`);
        });
      }
    } else {
      console.error('❌ Errore durante la sincronizzazione:', result.message);
      if (result.error) {
        console.error('   Dettaglio:', result.error);
      }
    }
    
  } catch (err) {
    console.error('❌ Errore durante l\'esecuzione dello script:', err.message);
    process.exit(1);
  }
}

// Esegui lo script
bulkSyncCalendar();
