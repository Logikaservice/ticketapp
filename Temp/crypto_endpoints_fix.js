
// ✅ FIX: Alias per compatibilità frontend - system-health
const healthStatusHandler = async (req, res) => {
    try {
        const status = HealthCheckService.getLastStatus();
        
        if (!status) {
            const newStatus = await HealthCheckService.performCheck();
            return res.json({
                success: true,
                status: newStatus,
                message: 'Prima verifica eseguita'
            });
        }

        res.json({
            success: true,
            status,
            message: status.overall === 'healthy' ? 'Sistema operativo' : 'Problemi rilevati'
        });
    } catch (error) {
        console.error('❌ [API] Errore health status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Alias per /system-health
router.get('/system-health', healthStatusHandler);

// ✅ FIX: POST endpoint per /positions/update-pnl (frontend chiama POST)
const updatePnLHandler = async (req, res) => {
    try {
        const { symbol } = req.body || req.query;
        const targetSymbol = symbol || 'bitcoin';

        let currentPrice = 0;
        try {
            currentPrice = await getSymbolPrice(targetSymbol);
            if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
                return res.status(500).json({ error: 'Could not fetch current price' });
            }
        } catch (e) {
            console.error(`❌ Error fetching price for ${targetSymbol}:`, e.message);
            return res.status(500).json({ error: 'Could not fetch current price' });
        }

        const updatedCount = await updatePositionsPnL();
        res.json({ success: true, updated: updatedCount, current_price: currentPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST endpoint per update-pnl
router.post('/positions/update-pnl', updatePnLHandler);

