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

                    // Chiama direttamente la funzione di sincronizzazione Google Calendar
                    // Estrai la logica di sincronizzazione in una funzione riutilizzabile
                    const syncContractToGoogleCalendar = async (contract, events) => {
                        try {
                            const { google } = require('googleapis');
                            
                            // Verifica che le credenziali Service Account siano configurate
                            if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
                                console.log('⚠️ Credenziali Google Service Account non configurate');
                                return;
                            }
                            
                            // Configura Google Auth
                            const auth = new google.auth.GoogleAuth({
                                credentials: {
                                    type: "service_account",
                                    project_id: process.env.GOOGLE_PROJECT_ID || "ticketapp-b2a2a",
                                    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
                                    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                                    client_email: process.env.GOOGLE_CLIENT_EMAIL,
                                    client_id: process.env.GOOGLE_CLIENT_ID,
                                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                                    token_uri: "https://oauth2.googleapis.com/token",
                                    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                                    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
                                    universe_domain: "googleapis.com"
                                },
                                scopes: ['https://www.googleapis.com/auth/calendar']
                            });
                            
                            const authClient = await auth.getClient();
                            const calendar = google.calendar({ version: 'v3', auth: authClient });
                            
                            // Trova il calendario corretto
                            let calendarId = 'primary';
                            try {
                                const calendarList = await calendar.calendarList.list();
                                const ticketAppCalendar = calendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
                                if (ticketAppCalendar) {
                                    calendarId = ticketAppCalendar.id;
                                } else if (calendarList.data.items && calendarList.data.items.length > 0) {
                                    calendarId = calendarList.data.items[0].id;
                                }
                            } catch (calErr) {
                                console.log('⚠️ Errore ricerca calendario, uso primary:', calErr.message);
                            }
                            
                            // Crea eventi per ogni evento del contratto
                            let createdCount = 0;
                            if (events && Array.isArray(events)) {
                                for (const eventData of events) {
                                    if (!eventData.event_date) {
                                        continue;
                                    }
                                    
                                    // Gestisci la data - eventi di un giorno intero
                                    let eventDate;
                                    if (eventData.event_date.includes('T')) {
                                        eventDate = new Date(eventData.event_date);
                                    } else {
                                        eventDate = new Date(eventData.event_date + 'T00:00:00+02:00');
                                    }
                                    
                                    if (isNaN(eventDate.getTime())) {
                                        continue;
                                    }
                                    
                                    const eventDateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
                                    
                                    // Costruisci la descrizione
                                    let description = `CONTRATTO: ${contract.title}\n`;
                                    description += `CLIENTE: ${contract.client_name || 'N/D'}\n`;
                                    description += `DESCRIZIONE: ${eventData.description || eventData.title || 'Fatturazione'}\n`;
                                    if (eventData.amount) {
                                        description += `IMPORTO: € ${parseFloat(eventData.amount).toFixed(2)}\n`;
                                    }
                                    description += `FREQUENZA: ${contract.billing_frequency || 'N/D'}\n`;
                                    description += `LINK: ${process.env.FRONTEND_URL || 'https://ticket.logikaservice.it'}/contracts/${contract.id}`;
                                    
                                    const event = {
                                        summary: `Contratto: ${contract.title} - ${eventData.description || eventData.title || 'Fatturazione'}`,
                                        description: description,
                                        start: {
                                            date: eventDateStr,
                                            timeZone: 'Europe/Rome'
                                        },
                                        end: {
                                            date: eventDateStr,
                                            timeZone: 'Europe/Rome'
                                        },
                                        colorId: '5', // Giallo per contratti
                                        source: {
                                            title: 'TicketApp - Contratto',
                                            url: `${process.env.FRONTEND_URL || 'https://ticket.logikaservice.it'}/contracts/${contract.id}`
                                        }
                                    };
                                    
                                    try {
                                        const result = await calendar.events.insert({
                                            calendarId: calendarId,
                                            resource: event,
                                            sendUpdates: 'none',
                                            conferenceDataVersion: 0
                                        });
                                        
                                        if (result.data?.id && eventData.id) {
                                            // Salva l'ID dell'evento Google Calendar nel database
                                            await client.query(
                                                'UPDATE contract_events SET googlecalendareventid = $1 WHERE id = $2',
                                                [result.data.id, eventData.id]
                                            );
                                        }
                                        
                                        createdCount++;
                                    } catch (eventErr) {
                                        console.error(`⚠️ Errore creazione evento contratto:`, eventErr.message);
                                    }
                                }
                            }
                            
                            if (createdCount > 0) {
                                console.log(`✅ ${createdCount} eventi contratto sincronizzati con Google Calendar`);
                            }
                        } catch (err) {
                            console.error('❌ Errore sincronizzazione contratto Google Calendar:', err.message);
                        }
                    };
                    
                    // Chiama la funzione di sincronizzazione
                    await syncContractToGoogleCalendar(contract, contractEvents);
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

    // POST /api/contracts/:id/upload - Upload PDF (supporta più file)
    router.post('/:id/upload', upload.array('contractPdf', 10), async (req, res) => {
        const { id } = req.params;
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        try {
            const client = await pool.connect();
            
            // Recupera i file esistenti
            const existingResult = await client.query(`
                SELECT contract_file_path FROM contracts WHERE id = $1
            `, [id]);
            
            let existingFiles = [];
            if (existingResult.rows.length > 0 && existingResult.rows[0].contract_file_path) {
                try {
                    // Prova a parsare come JSON (se è un array)
                    const parsed = JSON.parse(existingResult.rows[0].contract_file_path);
                    if (Array.isArray(parsed)) {
                        existingFiles = parsed;
                    } else {
                        // Se è una stringa singola (retrocompatibilità), convertila in array
                        existingFiles = [existingResult.rows[0].contract_file_path];
                    }
                } catch (e) {
                    // Se non è JSON, è una stringa singola (retrocompatibilità)
                    existingFiles = [existingResult.rows[0].contract_file_path];
                }
            }
            
            // Aggiungi i nuovi file
            const newFiles = req.files.map(file => ({
                filename: file.filename,
                path: `/uploads/contracts/${file.filename}`,
                size: file.size,
                mimetype: file.mimetype,
                uploadedAt: new Date().toISOString()
            }));
            
            const allFiles = [...existingFiles, ...newFiles];
            
            // Salva come JSON array
            await client.query(`
                UPDATE contracts SET contract_file_path = $1 WHERE id = $2
            `, [JSON.stringify(allFiles), id]);
            
            client.release();
            res.json({ 
                success: true, 
                files: allFiles,
                message: `${req.files.length} file caricati con successo`
            });
        } catch (err) {
            console.error('Error updating contract files:', err);
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
