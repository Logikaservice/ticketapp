const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

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

            // Fetch next events for all
            const contracts = result.rows;
            for (let contract of contracts) {
                const eventRes = await client.query(`
                    SELECT * FROM contract_events 
                    WHERE contract_id = $1 AND event_date >= CURRENT_DATE 
                    ORDER BY event_date ASC 
                    LIMIT 1
                `, [contract.id]);
                contract.next_event = eventRes.rows[0] || null;
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

            // For each contract, get next upcoming event
            for (let contract of contracts) {
                const eventRes = await client.query(`
                    SELECT * FROM contract_events 
                    WHERE contract_id = $1 AND event_date >= CURRENT_DATE 
                    ORDER BY event_date ASC 
                    LIMIT 1
                `, [contract.id]);
                contract.next_event = eventRes.rows[0] || null;
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
                    await client.query(`
                        INSERT INTO contract_events (contract_id, event_date, event_type, title, description, amount)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [contractId, event.date, event.type || 'invoice', event.title || 'Scadenza', event.description, amount]);
                }
            } else {
                // Auto-generate if not provided
                const autoEvents = calculateEvents(start_date, end_date, billing_frequency);
                for (let event of autoEvents) {
                    await client.query(`
                        INSERT INTO contract_events (contract_id, event_date, event_type, title, description, amount)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [contractId, event.date, 'invoice', 'Fattura Periodica', `Fatturazione ${billing_frequency}`, amount]);
                }
            }

            await client.query('COMMIT');
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

    return router;
};
