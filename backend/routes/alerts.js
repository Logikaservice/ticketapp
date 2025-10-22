// backend/routes/alerts.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function createAlertsRouter(pool) {
  const router = express.Router();

  // Configurazione multer per upload allegati
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'alerts');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `alert-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Solo file immagine sono permessi!'), false);
      }
    }
  });

  // GET /api/alerts - lista avvisi
  router.get('/', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire", attachments FROM alerts ORDER BY created_at DESC'
      );
      res.json(rows);
    } catch (err) {
      console.error('Errore GET /alerts:', err);
      res.status(500).json({ error: 'Errore nel recupero degli avvisi' });
    }
  });

  // POST /api/alerts - crea avviso (solo tecnico)
  router.post('/', upload.array('attachments', 5), async (req, res) => {
    try {
      const { title, body, level, ticketId, createdBy, clients, isPermanent, daysToExpire } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: 'title e body sono obbligatori' });

      // Controllo ruolo semplice da body (in attesa di auth reale)
      // In produzione sostituire con auth token/sessione
      if (!req.headers['x-user-role'] && !req.body?.role) {
        return res.status(401).json({ error: 'Ruolo mancante' });
      }
      const role = (req.headers['x-user-role'] || req.body.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono creare avvisi' });

      // Gestione allegati
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/alerts/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        }));
      }

      const { rows } = await pool.query(
        'INSERT INTO alerts (title, body, level, ticket_id, created_by, clients, is_permanent, days_to_expire, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire", attachments',
        [title, body, level || 'warning', ticketId || null, createdBy || null, JSON.stringify(clients || []), isPermanent !== false, daysToExpire || 7, JSON.stringify(attachments)]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Errore POST /alerts:', err);
      res.status(500).json({ error: 'Errore nella creazione dell\'avviso' });
    }
  });

  // PUT /api/alerts/:id - modifica avviso (solo tecnico)
  router.put('/:id', upload.array('attachments', 5), async (req, res) => {
    try {
      const { id } = req.params;
      const { title, body, level, ticketId, createdBy, clients, isPermanent, daysToExpire, existingAttachments } = req.body || {};
      
      if (!id) return res.status(400).json({ error: 'ID mancante' });
      if (!title || !body) return res.status(400).json({ error: 'title e body sono obbligatori' });

      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono modificare avvisi' });

      // Gestione allegati esistenti e nuovi
      let attachments = [];
      try {
        attachments = existingAttachments ? JSON.parse(existingAttachments) : [];
      } catch (e) {
        attachments = [];
      }

      // Aggiungi nuovi allegati
      if (req.files && req.files.length > 0) {
        const newAttachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/alerts/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        }));
        attachments = [...attachments, ...newAttachments];
      }

      const { rows } = await pool.query(
        'UPDATE alerts SET title = $1, body = $2, level = $3, ticket_id = $4, created_by = $5, clients = $6, is_permanent = $7, days_to_expire = $8, attachments = $9 WHERE id = $10 RETURNING id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire", attachments',
        [title, body, level || 'warning', ticketId || null, createdBy || null, JSON.stringify(clients || []), isPermanent !== false, daysToExpire || 7, JSON.stringify(attachments), id]
      );
      
      if (rows.length === 0) return res.status(404).json({ error: 'Avviso non trovato' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Errore PUT /alerts/:id:', err);
      res.status(500).json({ error: 'Errore nella modifica dell\'avviso' });
    }
  });

  // DELETE /api/alerts/:id - elimina avviso (solo tecnico)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID mancante' });

      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono eliminare avvisi' });

      await pool.query('DELETE FROM alerts WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Errore DELETE /alerts/:id:', err);
      res.status(500).json({ error: 'Errore nell\'eliminazione dell\'avviso' });
    }
  });

  return router;
};


