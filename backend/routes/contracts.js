const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const http = require('http');

module.exports = (pool, upload) => {

    // Helper to calculate next dates
    const calculateEvents = (startDate, endDate, frequency) => {
        const events = [];
        let currentDate = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)); // Default 1 year if null

        // Avoid infinite loops
        let safetyCounter = 0;

        while (currentDate <= end && safetyCounter < 100) {
            events.push({
                date: new Date(currentDate), // clone
                type: 'invoice',
                description: `Fattura ${frequency}`
            });

            // Increment based on frequency
            if (frequency === 'monthly') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (frequency === 'quarterly') {
                currentDate.setMonth(currentDate.getMonth() + 3);
            } else if (frequency === 'semiannual') {
                currentDate.setMonth(currentDate.getMonth() + 6);
            } else if (frequency === 'annual') {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
            } else {
                break; // One off or custom
            }
            safetyCounter++;
        }
        return events;
    };

    // GET /api/contracts - Get all active contracts (for admin)
    router.get('/', async (req, res) => {
        try {
            const client = await pool.connect();
            const result = await client.query(`
                SELECT c.*, u.nome, u.cognome, u.azienda 
                FROM contracts c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.active = true 
                ORDER BY c.created_at DESC
            `);

            // Fetch all events for all contracts (ordered by date)
            const contracts = result.rows;
            for (let contract of contracts) {
                const eventRes = await client.query(`
                    SELECT * FROM contract_events 
                    WHERE contract_id = $1 
                    ORDER BY event_date ASC
                `, [contract.id]);
                contract.events = eventRes.rows || [];
                // Keep next_event for backward compatibility (first non-processed event)
                contract.next_event = eventRes.rows.find(e => !e.is_processed && new Date(e.event_date) >= new Date()) || null;
            }

            client.release();
            res.json(contracts);
        } catch (err) {
            console.error('Error fetching all contracts:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/contracts/user/:userId - Get all active contracts for a user
    router.get('/user/:userId', async (req, res) => {
        const { userId } = req.params;
        try {
            const client = await pool.connect();
            // Get contracts
            const contractsRes = await client.query(`
                SELECT * FROM contracts 
                WHERE user_id = $1 AND active = true 
                ORDER BY created_at DESC
            `, [userId]);

            const contracts = contractsRes.rows;

            // For each contract, get all events (ordered by date)
            for (let contract of contracts) {
                const eventRes = await client.query(`
                    SELECT * FROM contract_events 
                    WHERE contract_id = $1 
                    ORDER BY event_date ASC
                `, [contract.id]);
                contract.events = eventRes.rows || [];
                // Keep next_event for backward compatibility (first non-processed event)
                contract.next_event = eventRes.rows.find(e => !e.is_processed && new Date(e.event_date) >= new Date()) || null;
            }

            client.release();
            res.json(contracts);
        } catch (err) {
            console.error('Error fetching user contracts:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/contracts/preview-schedule - Generate preview dates
    router.post('/preview-schedule', (req, res) => {
        const { startDate, endDate, frequency } = req.body;
        if (!startDate || !frequency) return res.status(400).json({ error: 'Missing parameters' });

        const events = calculateEvents(startDate, endDate, frequency);
        res.json(events);
    });

    // POST /api/contracts - Create new contract
    router.post('/', async (req, res) => {
        const { user_id, title, client_name, start_date, end_date, billing_frequency, amount, notes, events } = req.body;

        if (!user_id || !title || !start_date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create Contract
            const contractRes = await client.query(`
                INSERT INTO contracts (user_id, title, client_name, start_date, end_date, billing_frequency, amount, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [user_id, title, client_name, start_date, end_date, billing_frequency, amount, notes]);

            const contractId = contractRes.rows[0].id;

            // 2. Create Events (if provided from preview)
            if (events && Array.isArray(events)) {
                for (let event of events) {
                    // Usa l'amount dell'evento se presente, altrimenti usa l'amount del contratto
                    const eventAmount = event.amount !== undefined && event.amount !== null ? event.amount : amount;
                    await client.query(`
                        INSERT INTO contract_events (contract_id, event_date, event_type, title, description, amount)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [contractId, event.date, event.type || 'invoice', event.title || 'Scadenza', event.description || `Fatturazione ${billing_frequency}`, eventAmount]);
                }
            } else {
                // Auto-generate if not provided
                const autoEvents = calculateEvents(start_date, end_date, billing_frequency);
                for (let event of autoEvents) {
                    await client.query(`
                        INSERT INTO contract_events (contract_id, event_date, event_type, title, description, amount)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [contractId, event.date.toISOString().split('T')[0], 'invoice', 'Fattura Periodica', `Fatturazione ${billing_frequency}`, amount]);
                }
            }

            await client.query('COMMIT');

            // 3. Sync to Google Calendar (only for technicians)
            if (req.user && req.user.ruolo === 'tecnico') {
                try {
                    // Recupera il contratto completo con gli eventi
                    const contractResult = await client.query(`
                        SELECT * FROM contracts WHERE id = $1
                    `, [contractId]);
                    const contract = contractResult.rows[0];

                    const eventsResult = await client.query(`
                        SELECT * FROM contract_events WHERE contract_id = $1 ORDER BY event_date ASC
                    `, [contractId]);
                    const contractEvents = eventsResult.rows;

                    // Chiama l'endpoint di sincronizzazione Google Calendar
                    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
                    const syncUrl = `${apiUrl}/api/sync-contract-google-calendar`;
                    
                    const syncPayload = JSON.stringify({
                        contract: contract,
                        events: contractEvents
                    });

                    const url = new URL(syncUrl);
                    const options = {
                        hostname: url.hostname,
                        port: url.port || (url.protocol === 'https:' ? 443 : 80),
                        path: url.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(syncPayload),
                            'Authorization': req.headers.authorization || ''
                        }
                    };

                    const syncReq = http.request(options, (syncRes) => {
                        let data = '';
                        syncRes.on('data', (chunk) => { data += chunk; });
                        syncRes.on('end', () => {
                            if (syncRes.statusCode === 200) {
                                console.log('✅ Contratto sincronizzato con Google Calendar');
                            } else {
                                console.log('⚠️ Errore sincronizzazione Google Calendar:', data);
                            }
                        });
                    });

                    syncReq.on('error', (err) => {
                        console.error('⚠️ Errore chiamata sincronizzazione Google Calendar:', err.message);
                    });

                    syncReq.write(syncPayload);
                    syncReq.end();
                } catch (syncErr) {
                    // Non bloccare la risposta se la sincronizzazione fallisce
                    console.error('⚠️ Errore sincronizzazione Google Calendar (non bloccante):', syncErr.message);
                }
            }

            res.status(201).json({ success: true, contractId });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error creating contract:', err);
            res.status(500).json({ error: 'Creation failed' });
        } finally {
            client.release();
        }
    });

    // POST /api/contracts/:id/upload - Upload PDF
    router.post('/:id/upload', upload.single('contractPdf'), async (req, res) => {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Generate relative path for DB
        const relativePath = `/uploads/contracts/${req.file.filename}`;

        try {
            const client = await pool.connect();
            await client.query(`
                UPDATE contracts SET contract_file_path = $1 WHERE id = $2
            `, [relativePath, id]);
            client.release();
            res.json({ success: true, filePath: relativePath });
        } catch (err) {
            console.error('Error updating contract file:', err);
            res.status(500).json({ error: 'Database update failed' });
        }
    });

    // GET /api/contracts/:id/events - Get specific events for timeline
    router.get('/:id/events', async (req, res) => {
        const { id } = req.params;
        try {
            const client = await pool.connect();
            const result = await client.query(`
                SELECT * FROM contract_events 
                WHERE contract_id = $1 
                ORDER BY event_date ASC
            `, [id]);
            client.release();
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // PUT /api/contracts/:contractId/events/:eventId - Mark event as executed/not executed
    router.put('/:contractId/events/:eventId', async (req, res) => {
        const { contractId, eventId } = req.params;
        const { is_processed } = req.body;
        
        try {
            const client = await pool.connect();
            
            // Verify event belongs to contract
            const checkRes = await client.query(`
                SELECT id FROM contract_events 
                WHERE id = $1 AND contract_id = $2
            `, [eventId, contractId]);
            
            if (checkRes.rows.length === 0) {
                client.release();
                return res.status(404).json({ error: 'Evento non trovato' });
            }
            
            // Update event
            const result = await client.query(`
                UPDATE contract_events 
                SET is_processed = $1
                WHERE id = $2 AND contract_id = $3
                RETURNING *
            `, [is_processed === true, eventId, contractId]);
            
            client.release();
            
            if (result.rowCount > 0) {
                res.json({ success: true, event: result.rows[0] });
            } else {
                res.status(404).json({ error: 'Evento non trovato' });
            }
        } catch (err) {
            console.error('Error updating event:', err);
            res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'evento' });
        }
    });

    // DELETE /api/contracts/:id - Delete (deactivate) a contract
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const client = await pool.connect();
            
            // Soft delete: set active = false instead of actually deleting
            const result = await client.query(`
                UPDATE contracts 
                SET active = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [id]);
            
            client.release();
            
            if (result.rowCount > 0) {
                console.log(`✅ Contratto ${id} disattivato con successo`);
                res.json({ success: true, message: 'Contratto disattivato con successo' });
            } else {
                res.status(404).json({ error: 'Contratto non trovato' });
            }
        } catch (err) {
            console.error('Error deleting contract:', err);
            res.status(500).json({ error: 'Errore durante la disattivazione del contratto' });
        }
    });

    return router;
};
