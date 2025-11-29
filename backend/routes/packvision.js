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

    // GET /api/packvision/health - Verifica connessione database
    router.get('/health', requireDb, async (req, res) => {
        let client = null;
        try {
            console.log('🔍 [PackVision] Verifica connessione database...');
            
            // Timeout per la connessione (5 secondi)
            const connectPromise = pool.connect();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout connessione database (5s)')), 5000);
            });
            
            client = await Promise.race([connectPromise, timeoutPromise]);
            
            // Test query semplice
            await client.query('SELECT 1 as test');
            
            // Verifica che la tabella messages esista
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'messages'
                )
            `);
            
            if (client) {
                client.release();
            }
            
            const tableExists = tableCheck.rows[0]?.exists || false;
            
            res.json({
                status: 'ok',
                database: 'connected',
                table_exists: tableExists,
                message: tableExists ? 'Database e tabella verificati' : 'Database connesso ma tabella messages non trovata'
            });
        } catch (err) {
            if (client) {
                try {
                    client.release();
                } catch (releaseErr) {
                    console.error('⚠️ [PackVision] Errore rilascio client:', releaseErr.message);
                }
            }
            
            console.error('❌ [PackVision] Errore verifica health:', err);
            
            res.status(503).json({
                status: 'error',
                database: 'disconnected',
                error: err.message,
                code: err.code
            });
        }
    });

    // GET /api/packvision/messages - Ottieni messaggi attivi (filtra quelli scaduti)
    router.get('/messages', requireDb, async (req, res) => {
        let client = null;
        try {
            // Timeout per la connessione (5 secondi)
            const connectPromise = pool.connect();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout connessione database (5s)')), 5000);
            });
            
            client = await Promise.race([connectPromise, timeoutPromise]);
            
            // Disattiva automaticamente i messaggi scaduti
            await client.query(`
                UPDATE messages 
                SET active = false 
                WHERE active = true 
                AND expires_at IS NOT NULL 
                AND expires_at < NOW()
            `);
            
            // Ottieni solo messaggi attivi e non scaduti
            const result = await client.query(`
                SELECT * FROM messages 
                WHERE active = true 
                AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY 
                    CASE WHEN priority = 'danger' THEN 0 ELSE 1 END,
                    created_at DESC
            `);
            
            if (client) {
                client.release();
            }
            
            res.json(result.rows);
        } catch (err) {
            if (client) {
                try {
                    client.release();
                } catch (releaseErr) {
                    console.error('⚠️ [PackVision] Errore rilascio client:', releaseErr.message);
                }
            }
            
            console.error('❌ [PackVision] Errore recupero messaggi:', err);
            console.error('❌ [PackVision] Stack:', err.stack);
            
            // Se è un errore di connessione al database
            if (err.message.includes('Timeout') || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
                return res.status(503).json({ 
                    error: 'Database PackVision non disponibile',
                    details: 'Impossibile connettersi al database. Verifica che il database packvision_db esista e sia accessibile.'
                });
            }
            
            res.status(500).json({ 
                error: 'Errore interno del server',
                details: err.message 
            });
        }
    });

    // POST /api/packvision/messages - Invia nuovo messaggio
    router.post('/messages', requireDb, async (req, res) => {
        const { content, priority, display_mode, duration_hours, expires_at } = req.body;

        console.log('📨 [PackVision] Nuovo messaggio ricevuto:', { content, priority, display_mode, duration_hours, expires_at });

        if (!content || !content.trim()) {
            console.error('❌ [PackVision] Contenuto messaggio mancante o vuoto');
            return res.status(400).json({ error: 'Contenuto messaggio mancante' });
        }

        let client = null;
        try {
            // Timeout per la connessione (5 secondi)
            const connectPromise = pool.connect();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout connessione database (5s)')), 5000);
            });
            
            client = await Promise.race([connectPromise, timeoutPromise]);
            
            // Calcola expires_at se duration_hours è fornito (o usa quello passato direttamente)
            let expiresAt = expires_at || null;
            if (!expiresAt && duration_hours) {
                const expiresDate = new Date();
                expiresDate.setHours(expiresDate.getHours() + parseInt(duration_hours, 10));
                expiresAt = expiresDate.toISOString();
            }

            // Verifica se la colonna order_index esiste
            let hasOrderIndex = false;
            try {
                const columnCheck = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'messages' AND column_name = 'order_index'
                `);
                hasOrderIndex = columnCheck.rows.length > 0;
            } catch (checkErr) {
                console.warn('⚠️ [PackVision] Impossibile verificare colonna order_index:', checkErr.message);
            }

            // Ottieni il massimo order_index per il nuovo messaggio (se la colonna esiste)
            let orderIndex = null;
            if (hasOrderIndex) {
                try {
                    const maxOrderResult = await client.query('SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM messages WHERE active = true');
                    orderIndex = parseInt(maxOrderResult.rows[0]?.next_order || 0, 10);
                } catch (orderErr) {
                    console.warn('⚠️ [PackVision] Errore calcolo order_index, uso default 0:', orderErr.message);
                    orderIndex = 0;
                }
            }

            // Costruisci la query INSERT in base alle colonne disponibili
            let insertQuery, insertValues;
            
            if (hasOrderIndex) {
                insertQuery = `
                    INSERT INTO messages (content, priority, display_mode, duration_hours, expires_at, active, order_index) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7) 
                    RETURNING *
                `;
                insertValues = [
                    content.trim(),
                    priority || 'info',
                    display_mode || 'single',
                    duration_hours ? parseInt(duration_hours, 10) : null,
                    expiresAt,
                    true,
                    orderIndex
                ];
            } else {
                insertQuery = `
                    INSERT INTO messages (content, priority, display_mode, duration_hours, expires_at, active) 
                    VALUES ($1, $2, $3, $4, $5, $6) 
                    RETURNING *
                `;
                insertValues = [
                    content.trim(),
                    priority || 'info',
                    display_mode || 'single',
                    duration_hours ? parseInt(duration_hours, 10) : null,
                    expiresAt,
                    true
                ];
            }

            console.log('💾 [PackVision] Esecuzione INSERT con query:', insertQuery);
            console.log('💾 [PackVision] Valori:', insertValues);

            // Timeout per la query (10 secondi)
            const queryPromise = client.query(insertQuery, insertValues);
            const queryTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout query database (10s)')), 10000);
            });
            
            const result = await Promise.race([queryPromise, queryTimeoutPromise]);
            
            if (client) {
                client.release();
            }

            const newMessage = result.rows[0];
            console.log('✅ [PackVision] Messaggio creato con successo:', newMessage.id);

            // Notifica via Socket.IO
            if (io) {
                io.emit('packvision:message', newMessage);
            }

            res.status(201).json(newMessage);
        } catch (err) {
            // Rilascia il client se è stato acquisito
            if (client) {
                try {
                    client.release();
                } catch (releaseErr) {
                    console.error('⚠️ [PackVision] Errore rilascio client:', releaseErr.message);
                }
            }
            
            console.error('❌ [PackVision] Errore invio messaggio:', err);
            console.error('❌ [PackVision] Stack:', err.stack);
            console.error('❌ [PackVision] Dettagli errore:', {
                message: err.message,
                code: err.code,
                detail: err.detail,
                constraint: err.constraint,
                errno: err.errno,
                syscall: err.syscall
            });
            
            // Se è un errore di connessione al database
            if (err.message.includes('Timeout') || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
                return res.status(503).json({ 
                    error: 'Database PackVision non disponibile',
                    details: 'Impossibile connettersi al database. Verifica che il database packvision_db esista e sia accessibile.'
                });
            }
            
            res.status(500).json({ 
                error: 'Errore interno del server',
                details: err.message 
            });
        }
    });

    // PUT /api/packvision/messages/:id - Aggiorna messaggio
    router.put('/messages/:id', requireDb, async (req, res) => {
        const { id } = req.params;
        const { content, priority, duration_hours } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Contenuto messaggio mancante' });
        }

        try {
            const client = await pool.connect();
            
            // Calcola expires_at se duration_hours è fornito
            let expiresAt = null;
            if (duration_hours) {
                const expiresDate = new Date();
                expiresDate.setHours(expiresDate.getHours() + parseInt(duration_hours));
                expiresAt = expiresDate.toISOString();
            }

            const result = await client.query(
                'UPDATE messages SET content = $1, priority = $2, duration_hours = $3, expires_at = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
                [content, priority || 'info', duration_hours || null, expiresAt, id]
            );
            client.release();

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Messaggio non trovato' });
            }

            const updatedMessage = result.rows[0];

            if (io) {
                io.emit('packvision:message', updatedMessage);
            }

            res.json(updatedMessage);
        } catch (err) {
            console.error('Errore aggiornamento messaggio PackVision:', err);
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
