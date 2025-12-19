// Script per correggere l'endpoint POST positions/update-pnl
const fs = require('fs');

const filePath = '/var/www/crypto/backend/routes/cryptoRoutes.js';
let content = fs.readFileSync(filePath, 'utf8');

// Trova e sostituisci l'endpoint POST attuale
const oldPostHandler = `router.post('/positions/update-pnl', (req, res, next) => {
    // Converti POST in GET e richiama lo stesso handler
    req.method = 'GET';
    next();
});`;

const newPostHandler = `// ✅ FIX: Endpoint POST per aggiornare P&L di tutte le posizioni (compatibilità frontend)
router.post('/positions/update-pnl', async (req, res) => {
    try {
        console.log('🔄 [UPDATE-PNL] Starting P&L update for all positions...');

        // ✅ FIX: updatePositionsPnL aggiorna TUTTE le posizioni automaticamente
        const updatedCount = await updatePositionsPnL();

        console.log(\`✅ [UPDATE-PNL] Successfully updated \${updatedCount} positions\`);
        res.json({
            success: true,
            updated: updatedCount,
            message: 'P&L updated for all positions'
        });
    } catch (err) {
        console.error('❌ [UPDATE-PNL] Error:', err.message);
        res.status(500).json({
            error: err.message,
            message: 'Failed to update positions P&L'
        });
    }
});`;

content = content.replace(oldPostHandler, newPostHandler);
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Endpoint POST /positions/update-pnl corretto!');
