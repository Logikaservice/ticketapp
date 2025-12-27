// Script per sincronizzare forzatamente gli interventi mancanti su Google Calendar
// Uso: node scripts/sync-missing-interventi.js [baseUrl]

const https = require('https');
const http = require('http');

const baseUrl = process.argv[2] || 'https://ticket.logikaservice.it';

console.log('🔄 Avvio sincronizzazione interventi mancanti...');
console.log(`📍 URL: ${baseUrl}/api/sync-missing-interventi\n`);

const url = new URL(`${baseUrl}/api/sync-missing-interventi`);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'TicketApp-SyncScript/1.0'
  }
};

const req = client.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (res.statusCode === 200 && result.success) {
        console.log('✅ Sincronizzazione completata con successo!\n');
        console.log(`📊 Eventi creati: ${result.synced || 0}`);
        console.log(`❌ Errori: ${result.errors || 0}`);
        
        if (result.errorDetails && result.errorDetails.length > 0) {
          console.log('\n⚠️ Dettagli errori:');
          result.errorDetails.forEach((error, idx) => {
            console.log(`  ${idx + 1}. Ticket #${error.numero || error.ticketId}: ${error.error}`);
          });
        }
      } else {
        console.log('❌ Sincronizzazione fallita:');
        console.log(result.message || result.error || 'Errore sconosciuto');
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Errore parsing risposta:', err.message);
      console.log('Risposta raw:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Errore richiesta:', error.message);
  process.exit(1);
});

req.end();
