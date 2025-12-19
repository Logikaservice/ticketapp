const fs = require('fs');
const path = '/var/www/crypto/backend/routes/cryptoRoutes.js';

let content = fs.readFileSync(path, 'utf8');

// Cerca il handler GET esistente
const getHandlerStart = content.indexOf("router.get('/positions/update-pnl'");

if (getHandlerStart === -1) {
    console.error('❌ Endpoint GET non trovato');
    process.exit(1);
}

// Trova la fine del handler GET (trova la chiusura della funzione)
let braceCount = 0;
let inHandler = false;
let handlerEnd = -1;

for (let i = getHandlerStart; i < content.length; i++) {
    if (content[i] === '{') {
        inHandler = true;
        braceCount++;
    } else if (content[i] === '}') {
        braceCount--;
        if (inHandler && braceCount === 0) {
            handlerEnd = i + 1;
            break;
        }
    }
}

if (handlerEnd === -1) {
    console.error('❌ Fine handler non trovata');
    process.exit(1);
}

// Estrai il corpo del handler
const handlerBody = content.substring(getHandlerStart, handlerEnd);

// Verifica se POST alias già esiste
if (content.includes("router.post('/positions/update-pnl'")) {
    console.log('✅ Alias POST già presente');
    process.exit(0);
}

// Crea il POST alias che chiama lo stesso handler
const postAlias = `\n\n// ✅ FIX: Alias POST per compatibilità frontend OpenPositions.jsx\nrouter.post('/positions/update-pnl', ${handlerBody.substring(handlerBody.indexOf('async'))}\n`;

// Inserisci il POST alias dopo il GET handler
const newContent = content.substring(0, handlerEnd) + postAlias + content.substring(handlerEnd);

fs.writeFileSync(path, newContent, 'utf8');
console.log('✅ Alias POST /positions/update-pnl aggiunto con successo!');

