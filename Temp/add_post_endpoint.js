const fs = require('fs');
const filePath = '/var/www/crypto/backend/routes/cryptoRoutes.js';

// Leggi il file
let content = fs.readFileSync(filePath, 'utf8');

// Verifica se POST già esiste
if (content.includes('router.post(\'/positions/update-pnl\'')) {
    console.log('✅ Endpoint POST già esistente');
    process.exit(0);
}

// Trova l'handler GET
const getHandlerPattern = /router\.get\('\/positions\/update-pnl',\s*async\s*\(req,\s*res\)\s*=>\s*\{/;
const match = content.match(getHandlerPattern);

if (!match) {
    console.error('❌ Handler GET non trovato');
    process.exit(1);
}

// Inserisci POST alias che chiama lo stesso endpoint GET
const postHandler = `
// ✅ FIX: Alias POST per compatibilità frontend OpenPositions.jsx
router.post('/positions/update-pnl', (req, res, next) => {
    // Converti POST in GET e richiama lo stesso handler
    req.method = 'GET';
    next();
});

`;

// Inserisci il POST handler prima del GET handler
const index = content.indexOf(match[0]);
content = content.slice(0, index) + postHandler + content.slice(index);

// Scrivi il file modificato
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Endpoint POST aggiunto con successo!');

