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

    // Funzione helper per inizializzare automaticamente le colonne mancanti
    const ensureColumns = async (client) => {
        try {
            // Verifica e aggiungi colonne mancanti
            await client.query(`
                ALTER TABLE messages 
                ADD COLUMN IF NOT EXISTS duration_hours INTEGER,
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS order_index INTEGER,
                ADD COLUMN IF NOT EXISTS monitors INTEGER[]
            `);
            
            // Crea indice se non esiste
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_expires_at 
                ON messages(expires_at)
            `);
        } catch (err) {
            // Ignora errori se le colonne esistono già
            if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
                console.warn('⚠️ [PackVision] Errore durante inizializzazione colonne:', err.message);
            }
        }
    };

    // GET /api/packvision/test - Test endpoint semplice (per debug)
    router.get('/test', (req, res) => {
        res.json({ 
            success: true, 
            message: 'PackVision routes funzionano',
            pool_exists: !!pool,
            timestamp: new Date().toISOString()
        });
    });

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
            
            // Assicurati che le colonne esistano (inizializzazione automatica al primo accesso)
            await ensureColumns(client);
            
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
        const { content, priority, display_mode, duration_hours, expires_at, monitors } = req.body;

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
            
            // Assicurati che le colonne esistano (inizializzazione automatica)
            await ensureColumns(client);
            
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

            // Normalizza monitors: array di interi o default [1,2,3,4]
            const monitorsArray = Array.isArray(monitors) && monitors.length > 0 
                ? monitors.map(m => parseInt(m, 10)).filter(m => m >= 1 && m <= 4)
                : [1, 2, 3, 4]; // Default: tutti i monitor

            // Costruisci la query INSERT in base alle colonne disponibili
            let insertQuery, insertValues;
            
            if (hasOrderIndex) {
                insertQuery = `
                    INSERT INTO messages (content, priority, display_mode, duration_hours, expires_at, active, order_index, monitors) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                    RETURNING *
                `;
                insertValues = [
                    content.trim(),
                    priority || 'info',
                    display_mode || 'single',
                    duration_hours ? parseInt(duration_hours, 10) : null,
                    expiresAt,
                    true,
                    orderIndex,
                    monitorsArray
                ];
            } else {
                insertQuery = `
                    INSERT INTO messages (content, priority, display_mode, duration_hours, expires_at, active, monitors) 
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
                    monitorsArray
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
        const { content, priority, duration_hours, monitors } = req.body;

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

            // Normalizza monitors: array di interi o mantieni quelli esistenti
            let monitorsArray = null;
            if (monitors !== undefined) {
                monitorsArray = Array.isArray(monitors) && monitors.length > 0 
                    ? monitors.map(m => parseInt(m, 10)).filter(m => m >= 1 && m <= 4)
                    : [1, 2, 3, 4]; // Default: tutti i monitor
            }

            // Costruisci la query UPDATE dinamicamente
            const updateFields = ['content = $1', 'priority = $2', 'duration_hours = $3', 'expires_at = $4', 'updated_at = NOW()'];
            const updateValues = [content, priority || 'info', duration_hours || null, expiresAt];
            
            if (monitorsArray !== null) {
                updateFields.push('monitors = $' + (updateValues.length + 1));
                updateValues.push(monitorsArray);
            }
            
            updateValues.push(id); // ID per WHERE clause

            const result = await client.query(
                `UPDATE messages SET ${updateFields.join(', ')} WHERE id = $${updateValues.length} RETURNING *`,
                updateValues
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

    // Funzione helper per creare tabella monitor_authorizations se non esiste
    const ensureMonitorAuthTable = async (client) => {
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS monitor_authorizations (
                    id SERIAL PRIMARY KEY,
                    monitor_id INTEGER NOT NULL,
                    authorization_code VARCHAR(6) NOT NULL,
                    token VARCHAR(255) UNIQUE,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    authorized BOOLEAN DEFAULT FALSE,
                    authorized_at TIMESTAMPTZ,
                    authorized_by INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes')
                )
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_monitor_auth_code ON monitor_authorizations(authorization_code);
                CREATE INDEX IF NOT EXISTS idx_monitor_auth_token ON monitor_authorizations(token);
                CREATE INDEX IF NOT EXISTS idx_monitor_auth_monitor ON monitor_authorizations(monitor_id);
            `);
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.warn('⚠️ [PackVision] Errore creazione tabella monitor_authorizations:', err.message);
            }
        }
    };

    // Genera codice di autorizzazione univoco a 6 cifre
    const generateAuthCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    // Genera token univoco per monitor autorizzato
    const generateMonitorToken = (monitorId) => {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex') + '_' + monitorId + '_' + Date.now();
    };

    // POST /api/packvision/monitor/request - Richiedi autorizzazione monitor
    // Route PUBBLICA - non richiede autenticazione
    router.post('/monitor/request', requireDb, async (req, res) => {
        console.log('📥 [PackVision] Richiesta autorizzazione monitor ricevuta:', req.body);
        
        const { monitor_id } = req.body;
        const ip_address = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const user_agent = req.headers['user-agent'] || 'unknown';

        if (!monitor_id || monitor_id < 1 || monitor_id > 4) {
            console.error('❌ [PackVision] Monitor ID non valido:', monitor_id);
            return res.status(400).json({ error: 'Monitor ID non valido (deve essere 1-4)' });
        }

        if (!pool) {
            console.error('❌ [PackVision] Pool database non disponibile');
            return res.status(503).json({ error: 'Database PackVision non disponibile' });
        }

        let client = null;
        try {
            console.log('🔍 [PackVision] Tentativo connessione database...');
            client = await pool.connect();
            console.log('✅ [PackVision] Database connesso, creo tabella se necessario...');
            await ensureMonitorAuthTable(client);
            console.log('✅ [PackVision] Tabella verificata');

            // Verifica se esiste già una richiesta pendente per questo monitor
            const existingRequest = await client.query(`
                SELECT id, expires_at, authorized
                FROM monitor_authorizations
                WHERE monitor_id = $1 
                AND authorized = false 
                AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            `, [monitor_id]);

            if (existingRequest.rows.length > 0) {
                const existing = existingRequest.rows[0];
                client.release();
                console.log(`⚠️ [PackVision] Richiesta già esistente per monitor ${monitor_id}, ID: ${existing.id}`);
                return res.status(409).json({ 
                    error: 'Esiste già una richiesta in attesa per questo monitor',
                    request_id: existing.id,
                    expires_at: existing.expires_at
                });
            }

            // Genera codice univoco
            let authCode;
            let codeExists = true;
            let attempts = 0;
            
            while (codeExists && attempts < 10) {
                authCode = generateAuthCode();
                const checkResult = await client.query(
                    'SELECT id FROM monitor_authorizations WHERE authorization_code = $1 AND expires_at > NOW()',
                    [authCode]
                );
                codeExists = checkResult.rows.length > 0;
                attempts++;
            }

            if (codeExists) {
                return res.status(500).json({ error: 'Impossibile generare codice univoco' });
            }

            // Inserisci richiesta di autorizzazione con scadenza di 15 minuti
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15);

            const result = await client.query(`
                INSERT INTO monitor_authorizations (monitor_id, authorization_code, ip_address, user_agent, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, authorization_code, created_at, expires_at
            `, [monitor_id, authCode, ip_address, user_agent, expiresAt.toISOString()]);

            const request = result.rows[0];

            client.release();
            res.json({
                success: true,
                message: 'Richiesta di autorizzazione creata con successo.',
                request_id: request.id,
                authorization_code: authCode,
                expires_at: request.expires_at
            });

        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore richiesta autorizzazione monitor:', err);
            console.error('❌ [PackVision] Stack:', err.stack);
            
            // Assicurati di restituire sempre JSON, non HTML
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Errore interno del server',
                    details: process.env.NODE_ENV === 'development' ? err.message : undefined
                });
            }
        }
    });

    // GET /api/packvision/monitor/requests - Ottieni richieste di autorizzazione in attesa
    router.get('/monitor/requests', requireDb, async (req, res) => {
        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            const result = await client.query(`
                SELECT id, monitor_id, authorization_code, ip_address, user_agent, 
                       authorized, created_at, expires_at,
                       CASE WHEN expires_at < NOW() THEN true ELSE false END as expired
                FROM monitor_authorizations
                WHERE authorized = false AND expires_at > NOW()
                ORDER BY created_at DESC
            `);

            // Rimuovi automaticamente le richieste scadute
            await client.query(`
                DELETE FROM monitor_authorizations
                WHERE authorized = false AND expires_at <= NOW()
            `);

            client.release();
            res.json(result.rows);
        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore recupero richieste monitor:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // POST /api/packvision/monitor/approve - Approva richiesta monitor
    router.post('/monitor/approve', requireDb, async (req, res) => {
        const { request_id } = req.body;
        const authorized_by = req.user?.id || null; // Se c'è autenticazione

        if (!request_id) {
            return res.status(400).json({ error: 'request_id richiesto' });
        }

        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            // Ottieni la richiesta
            const requestResult = await client.query(
                'SELECT * FROM monitor_authorizations WHERE id = $1',
                [request_id]
            );

            if (requestResult.rows.length === 0) {
                client.release();
                return res.status(404).json({ error: 'Richiesta non trovata' });
            }

            const request = requestResult.rows[0];

            if (request.authorized) {
                client.release();
                return res.status(400).json({ error: 'Richiesta già autorizzata' });
            }

            if (new Date(request.expires_at) < new Date()) {
                client.release();
                return res.status(400).json({ error: 'Richiesta scaduta' });
            }

            // Genera token permanente
            const token = generateMonitorToken(request.monitor_id);

            // Aggiorna richiesta come autorizzata
            await client.query(`
                UPDATE monitor_authorizations
                SET authorized = true,
                    authorized_at = NOW(),
                    authorized_by = $1,
                    token = $2
                WHERE id = $3
            `, [authorized_by, token, request_id]);

            // Disattiva altre autorizzazioni per lo stesso monitor (una sola autorizzazione attiva)
            await client.query(`
                UPDATE monitor_authorizations
                SET authorized = false
                WHERE monitor_id = $1 AND id != $2 AND authorized = true
            `, [request.monitor_id, request_id]);

            client.release();

            // Notifica via Socket.IO
            if (io) {
                io.emit('packvision:monitor-authorized', { monitor_id: request.monitor_id, token });
            }

            res.json({
                success: true,
                token: token,
                monitor_id: request.monitor_id,
                message: 'Monitor autorizzato con successo'
            });

        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore approvazione monitor:', err);
            res.status(500).json({ error: 'Errore interno del server', details: err.message });
        }
    });

    // POST /api/packvision/monitor/verify - Verifica token monitor
    router.post('/monitor/verify', requireDb, async (req, res) => {
        const { token, monitor_id } = req.body;

        if (!token || !monitor_id) {
            return res.status(400).json({ error: 'Token e monitor_id richiesti' });
        }

        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            const result = await client.query(`
                SELECT * FROM monitor_authorizations
                WHERE token = $1 AND monitor_id = $2 AND authorized = true
            `, [token, monitor_id]);

            client.release();

            if (result.rows.length === 0) {
                return res.status(401).json({ 
                    authorized: false,
                    error: 'Token non valido o monitor non autorizzato'
                });
            }

            const auth = result.rows[0];
            res.json({
                authorized: true,
                monitor_id: auth.monitor_id,
                authorized_at: auth.authorized_at
            });

        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore verifica token monitor:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // GET /api/packvision/monitor/list - Lista monitor autorizzati
    router.get('/monitor/list', requireDb, async (req, res) => {
        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            const result = await client.query(`
                SELECT monitor_id, authorized_at, ip_address, user_agent, created_at
                FROM monitor_authorizations
                WHERE authorized = true
                ORDER BY monitor_id, authorized_at DESC
            `);

            client.release();
            res.json(result.rows);
        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore lista monitor autorizzati:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // DELETE /api/packvision/monitor/revoke/:monitor_id - Revoca autorizzazione monitor
    router.delete('/monitor/revoke/:monitor_id', requireDb, async (req, res) => {
        const { monitor_id } = req.params;

        if (!monitor_id || monitor_id < 1 || monitor_id > 4) {
            return res.status(400).json({ error: 'Monitor ID non valido' });
        }

        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            await client.query(`
                UPDATE monitor_authorizations
                SET authorized = false
                WHERE monitor_id = $1 AND authorized = true
            `, [monitor_id]);

            client.release();

            if (io) {
                io.emit('packvision:monitor-revoked', { monitor_id: parseInt(monitor_id) });
            }

            res.json({ success: true, message: `Autorizzazione monitor ${monitor_id} revocata` });

        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore revoca autorizzazione monitor:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // DELETE /api/packvision/monitor/request/:request_id - Cancella una richiesta di autorizzazione
    router.delete('/monitor/request/:request_id', requireDb, async (req, res) => {
        const { request_id } = req.params;

        if (!request_id) {
            return res.status(400).json({ error: 'request_id richiesto' });
        }

        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            const result = await client.query(`
                DELETE FROM monitor_authorizations
                WHERE id = $1 AND authorized = false
                RETURNING monitor_id
            `, [request_id]);

            client.release();

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Richiesta non trovata o già autorizzata' });
            }

            res.json({ 
                success: true, 
                message: `Richiesta ${request_id} cancellata`,
                monitor_id: result.rows[0].monitor_id
            });

        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore cancellazione richiesta monitor:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // DELETE /api/packvision/monitor/requests/cleanup - Cancella tutte le richieste pendenti (scadute e non)
    router.delete('/monitor/requests/cleanup', requireDb, async (req, res) => {
        let client = null;
        try {
            client = await pool.connect();
            await ensureMonitorAuthTable(client);

            // Cancella tutte le richieste non autorizzate (sia scadute che non)
            const result = await client.query(`
                DELETE FROM monitor_authorizations
                WHERE authorized = false
                RETURNING id, monitor_id
            `);

            client.release();

            res.json({ 
                success: true, 
                message: `${result.rows.length} richieste cancellate`,
                deleted_count: result.rows.length,
                deleted_requests: result.rows
            });

        } catch (err) {
            if (client) client.release();
            console.error('❌ [PackVision] Errore pulizia richieste monitor:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    return router;
};
