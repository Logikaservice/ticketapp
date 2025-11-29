const express = require('express');
const router = express.Router();

module.exports = (pool, io) => {
    // Middleware per verificare che il pool esista
    const requireDb = (req, res, next) => {
        if (!pool) {
            return res.status(503).json({ error: 'Database PackVision non disponibile' });
        }
        next();
    };

    // GET /api/packvision/messages - Ottieni messaggi attivi
    router.get('/messages', requireDb, async (req, res) => {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT * FROM messages WHERE active = true ORDER BY created_at DESC');
            client.release();
            res.json(result.rows);
        } catch (err) {
            console.error('Errore recupero messaggi PackVision:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // POST /api/packvision/messages - Invia nuovo messaggio
    router.post('/messages', requireDb, async (req, res) => {
        const { content, priority, display_mode } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Contenuto messaggio mancante' });
        }

        try {
            const client = await pool.connect();
            const result = await client.query(
                'INSERT INTO messages (content, priority, display_mode) VALUES ($1, $2, $3) RETURNING *',
                [content, priority || 'info', display_mode || 'single']
            );
            client.release();

            const newMessage = result.rows[0];

            // Notifica via Socket.IO
            if (io) {
                io.emit('packvision:message', newMessage);
            }

            res.status(201).json(newMessage);
        } catch (err) {
            console.error('Errore invio messaggio PackVision:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // DELETE /api/packvision/messages/:id - Rimuovi/Disattiva messaggio
    router.delete('/messages/:id', requireDb, async (req, res) => {
        const { id } = req.params;
        try {
            const client = await pool.connect();
            // Soft delete o hard delete? Facciamo hard delete per pulizia, o active=false
            // active=false è meglio per storico, ma l'utente ha chiesto di cancellare
            await client.query('UPDATE messages SET active = false WHERE id = $1', [id]);
            client.release();

            if (io) {
                io.emit('packvision:clear', { id });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('Errore cancellazione messaggio PackVision:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // GET /api/packvision/settings - Ottieni impostazioni
    router.get('/settings', requireDb, async (req, res) => {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT * FROM settings');
            client.release();

            // Converti array key-value in oggetto
            const settings = result.rows.reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});

            res.json(settings);
        } catch (err) {
            console.error('Errore recupero impostazioni PackVision:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // PUT /api/packvision/settings - Aggiorna impostazioni
    router.put('/settings', requireDb, async (req, res) => {
        const settings = req.body; // { viewMode: 'split', ... }

        try {
            const client = await pool.connect();

            for (const [key, value] of Object.entries(settings)) {
                await client.query(
                    'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
                    [key, value]
                );
            }

            client.release();

            if (io) {
                io.emit('packvision:settings', settings);
            }

            res.json({ success: true });
        } catch (err) {
            console.error('Errore aggiornamento impostazioni PackVision:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    return router;
};
