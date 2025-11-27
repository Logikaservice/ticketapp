// routes/vivaldi.js - Sistema Vivaldi Annunci Vocali (Database separato)

const express = require('express');
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/authMiddleware');
const SpeechGenClient = require('../utils/speechgen');
const GeminiClient = require('../utils/gemini');
const router = express.Router();

module.exports = (poolVivaldi) => {
  const pool = poolVivaldi;
  const geminiClient = new GeminiClient();
  
  // Inizializza tabelle database Vivaldi
  const initVivaldiTables = async () => {
    try {
      // Tabella configurazione
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vivaldi_config (
          id SERIAL PRIMARY KEY,
          chiave VARCHAR(100) UNIQUE NOT NULL,
          valore TEXT,
          descrizione TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Tabella annunci
      await pool.query(`
        CREATE TABLE IF NOT EXISTS annunci (
          id SERIAL PRIMARY KEY,
          contenuto TEXT NOT NULL,
          contenuto_pulito TEXT,
          speaker VARCHAR(50) DEFAULT 'Giulia',
          velocita DECIMAL(3,2) DEFAULT 1.0,
          tono DECIMAL(3,2) DEFAULT 1.0,
          audio_file_path VARCHAR(255),
          audio_url TEXT,
          tipo VARCHAR(20) DEFAULT 'testuale' CHECK (tipo IN ('testuale', 'audio')),
          priorita VARCHAR(20) DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta', 'Urgente')),
          azienda_id INTEGER NOT NULL,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Tabella schedulazione
      await pool.query(`
        CREATE TABLE IF NOT EXISTS annunci_schedule (
          id SERIAL PRIMARY KEY,
          annuncio_id INTEGER REFERENCES annunci(id) ON DELETE CASCADE,
          priorita VARCHAR(20) DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta', 'Urgente')),
          schedulazione JSONB NOT NULL DEFAULT '{}',
          stato VARCHAR(20) DEFAULT 'attivo' CHECK (stato IN ('attivo', 'pausa', 'completato', 'cancellato')),
          esecuzioni_totali INTEGER DEFAULT 0,
          esecuzioni_completate INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Tabella coda
      await pool.query(`
        CREATE TABLE IF NOT EXISTS annunci_queue (
          id SERIAL PRIMARY KEY,
          annuncio_id INTEGER REFERENCES annunci(id) ON DELETE CASCADE,
          schedule_id INTEGER REFERENCES annunci_schedule(id) ON DELETE CASCADE,
          priorita VARCHAR(20) DEFAULT 'Media' CHECK (priorita IN ('Bassa', 'Media', 'Alta', 'Urgente')),
          azienda_id INTEGER NOT NULL,
          stato VARCHAR(20) DEFAULT 'pending' CHECK (stato IN ('pending', 'playing', 'completed', 'failed')),
          scheduled_for TIMESTAMP NOT NULL,
          executed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Tabella storico
      await pool.query(`
        CREATE TABLE IF NOT EXISTS annunci_history (
          id SERIAL PRIMARY KEY,
          annuncio_id INTEGER REFERENCES annunci(id) ON DELETE CASCADE,
          schedule_id INTEGER REFERENCES annunci_schedule(id) ON DELETE SET NULL,
          azienda_id INTEGER NOT NULL,
          priorita VARCHAR(20),
          eseguito_at TIMESTAMP DEFAULT NOW(),
          audio_url TEXT,
          durata_secondi INTEGER,
          stato VARCHAR(20) DEFAULT 'success' CHECK (stato IN ('success', 'failed', 'cancelled'))
        )
      `);

      // Indici
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_annunci_azienda ON annunci(azienda_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_annunci_priorita ON annunci(priorita)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_schedule_stato ON annunci_schedule(stato)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_queue_pending ON annunci_queue(stato, azienda_id, scheduled_for)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_history_azienda ON annunci_history(azienda_id, eseguito_at)`);

      // Inserisci configurazione default se non esiste
      const configCheck = await pool.query('SELECT COUNT(*) FROM vivaldi_config WHERE chiave = $1', ['speechgen_api_key']);
      if (parseInt(configCheck.rows[0].count) === 0) {
        await pool.query(`
          INSERT INTO vivaldi_config (chiave, valore, descrizione) VALUES
          ('speechgen_api_key', '', 'API Key per SpeechGen.io'),
          ('speechgen_email', '', 'Email per SpeechGen.io'),
          ('gemini_api_key', '', 'API Key per Google Gemini')
        `);
      }

      console.log('✅ Tabelle Vivaldi inizializzate');
    } catch (error) {
      console.error('❌ Errore inizializzazione tabelle Vivaldi:', error);
      throw error;
    }
  };

  // Inizializza al caricamento del modulo
  initVivaldiTables().catch(err => {
    console.error('❌ Errore critico inizializzazione Vivaldi:', err);
  });

  // Middleware per verificare accesso al progetto Vivaldi
  const requireVivaldiAccess = (req, res, next) => {
    if (req.user?.ruolo === 'admin' || req.user?.ruolo === 'tecnico') {
      return next();
    }

    const enabledProjects = req.user?.enabled_projects || ['ticket'];
    if (!enabledProjects.includes('vivaldi')) {
      return res.status(403).json({
        error: 'Accesso negato: non hai i permessi per accedere a Vivaldi',
        code: 'VIVALDI_ACCESS_DENIED'
      });
    }

    next();
  };

  // GET /api/vivaldi/config - Ottieni configurazione
  router.get('/config', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const result = await pool.query('SELECT chiave, valore, descrizione FROM vivaldi_config');
      const config = {};
      result.rows.forEach(row => {
        config[row.chiave] = row.valore;
      });
      res.json(config);
    } catch (error) {
      console.error('❌ Errore recupero config:', error);
      res.status(500).json({ error: 'Errore recupero configurazione' });
    }
  });

  // PUT /api/vivaldi/config - Aggiorna configurazione
  router.put('/config', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const { chiave, valore } = req.body;
      if (!chiave) {
        return res.status(400).json({ error: 'Chiave richiesta' });
      }

      await pool.query(
        'INSERT INTO vivaldi_config (chiave, valore, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (chiave) DO UPDATE SET valore = $2, updated_at = NOW()',
        [chiave, valore || '']
      );

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Errore aggiornamento config:', error);
      res.status(500).json({ error: 'Errore aggiornamento configurazione' });
    }
  });

  // GET /api/vivaldi/speakers - Ottieni lista speaker da SpeechGen
  router.get('/speakers', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      // Recupera API key da config
      const configResult = await pool.query(
        'SELECT chiave, valore FROM vivaldi_config WHERE chiave IN ($1, $2)',
        ['speechgen_api_key', 'speechgen_email']
      );
      
      const config = { apiKey: '', email: '' };
      configResult.rows.forEach(row => {
        if (row.chiave === 'speechgen_api_key') config.apiKey = row.valore || '';
        if (row.chiave === 'speechgen_email') config.email = row.valore || '';
      });

      if (!config.apiKey) {
        return res.status(400).json({ error: 'API Key SpeechGen non configurata' });
      }

      const speechGen = new SpeechGenClient(config.apiKey, config.email);
      const speakers = await speechGen.getSpeakers();
      res.json({ speakers });
    } catch (error) {
      console.error('❌ Errore recupero speaker:', error);
      res.status(500).json({ error: 'Errore recupero speaker' });
    }
  });

  // POST /api/vivaldi/parse - Parsa comando con Gemini
  router.post('/parse', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Messaggio richiesto' });
      }

      const parsed = await geminiClient.parseAnnouncementCommand(message);
      res.json(parsed);
    } catch (error) {
      console.error('❌ Errore parsing comando:', error);
      res.status(500).json({ error: 'Errore parsing comando' });
    }
  });

  // POST /api/vivaldi/annunci - Crea nuovo annuncio
  router.post('/annunci', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const {
        contenuto,
        contenuto_pulito,
        speaker = 'Giulia',
        velocita = 1.0,
        tono = 1.0,
        priorita = 'Media',
        tipo = 'testuale',
        audio_file_path,
        azienda_id
      } = req.body;

      if (!contenuto) {
        return res.status(400).json({ error: 'Contenuto richiesto' });
      }

      const aziendaId = azienda_id || req.user.azienda_id || 1;

      const result = await pool.query(
        `INSERT INTO annunci (contenuto, contenuto_pulito, speaker, velocita, tono, priorita, tipo, audio_file_path, azienda_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [contenuto, contenuto_pulito || contenuto, speaker, velocita, tono, priorita, tipo, audio_file_path || null, aziendaId, req.user.id]
      );

      res.json({ success: true, annuncio: result.rows[0] });
    } catch (error) {
      console.error('❌ Errore creazione annuncio:', error);
      res.status(500).json({ error: 'Errore creazione annuncio' });
    }
  });

  // GET /api/vivaldi/annunci - Lista annunci
  router.get('/annunci', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const { azienda_id } = req.query;
      const aziendaId = azienda_id || req.user.azienda_id;

      let query = 'SELECT * FROM annunci WHERE 1=1';
      const params = [];
      
      if (aziendaId) {
        params.push(aziendaId);
        query += ` AND azienda_id = $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      res.json({ annunci: result.rows });
    } catch (error) {
      console.error('❌ Errore recupero annunci:', error);
      res.status(500).json({ error: 'Errore recupero annunci' });
    }
  });

  // POST /api/vivaldi/annunci/:id/schedule - Crea schedulazione
  router.post('/annunci/:id/schedule', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { priorita, ripetizione_ogni, ripetizione_fino_a } = req.body;

      // Recupera annuncio
      const annuncioResult = await pool.query('SELECT * FROM annunci WHERE id = $1', [id]);
      if (annuncioResult.rows.length === 0) {
        return res.status(404).json({ error: 'Annuncio non trovato' });
      }

      const annuncio = annuncioResult.rows[0];
      const prioritaFinale = priorita || annuncio.priorita;
      
      // Calcola ripetizione_ogni dalla priorità se non specificato
      const ripetizioneOggi = ripetizione_ogni || geminiClient.getDefaultRepetition(prioritaFinale);
      
      // Calcola ripetizione_fino_a
      let ripetizioneFinoA = ripetizione_fino_a;
      if (!ripetizioneFinoA) {
        ripetizioneFinoA = new Date(Date.now() + 2 * 60 * 60 * 1000); // Default 2 ore
      } else if (typeof ripetizioneFinoA === 'string') {
        ripetizioneFinoA = new Date(ripetizioneFinoA);
      }

      const schedulazione = {
        ripetizione_ogni: ripetizioneOggi,
        ripetizione_fino_a: ripetizioneFinoA.toISOString(),
        prossima_esecuzione: new Date().toISOString()
      };

      const result = await pool.query(
        `INSERT INTO annunci_schedule (annuncio_id, priorita, schedulazione, stato)
         VALUES ($1, $2, $3, 'attivo') RETURNING *`,
        [id, prioritaFinale, JSON.stringify(schedulazione)]
      );

      res.json({ success: true, schedule: result.rows[0] });
    } catch (error) {
      console.error('❌ Errore creazione schedulazione:', error);
      res.status(500).json({ error: 'Errore creazione schedulazione' });
    }
  });

  // GET /api/vivaldi/queue - Ottieni coda annunci
  router.get('/queue', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      // Verifica database corretto
      const dbCheck = await pool.query('SELECT current_database()');
      const currentDb = dbCheck.rows[0].current_database;
      if (currentDb !== 'vivaldi_db') {
        console.error(`❌ Route /api/vivaldi/queue: database sbagliato: ${currentDb}`);
        return res.status(500).json({ error: `Database errato: ${currentDb}` });
      }

      const { azienda_id } = req.query;
      const aziendaId = azienda_id || req.user.azienda_id;

      const result = await pool.query(
        `SELECT q.*, a.contenuto, a.contenuto_pulito, a.speaker, a.audio_url
         FROM annunci_queue q
         JOIN annunci a ON q.annuncio_id = a.id
         WHERE q.azienda_id = $1 AND q.stato = 'pending'
         ORDER BY 
           CASE q.priorita
             WHEN 'Urgente' THEN 1
             WHEN 'Alta' THEN 2
             WHEN 'Media' THEN 3
             WHEN 'Bassa' THEN 4
           END,
           q.scheduled_for ASC
         LIMIT 50`,
        [aziendaId]
      );

      res.json({ queue: result.rows });
    } catch (error) {
      console.error('❌ Errore recupero coda:', error);
      res.status(500).json({ error: 'Errore recupero coda' });
    }
  });

  // GET /api/vivaldi/history - Ottieni storico
  router.get('/history', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const { azienda_id, limit = 100 } = req.query;
      const aziendaId = azienda_id || req.user.azienda_id;

      const result = await pool.query(
        `SELECT h.*, a.contenuto, a.contenuto_pulito
         FROM annunci_history h
         JOIN annunci a ON h.annuncio_id = a.id
         WHERE h.azienda_id = $1
         ORDER BY h.eseguito_at DESC
         LIMIT $2`,
        [aziendaId, limit]
      );

      res.json({ history: result.rows });
    } catch (error) {
      console.error('❌ Errore recupero storico:', error);
      res.status(500).json({ error: 'Errore recupero storico' });
    }
  });

  // DELETE /api/vivaldi/history/:id - Elimina record storico
  router.delete('/history/:id', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      await pool.query('DELETE FROM annunci_history WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Errore eliminazione storico:', error);
      res.status(500).json({ error: 'Errore eliminazione record' });
    }
  });

  // POST /api/vivaldi/annunci/:id/generate-audio - Genera audio da testo
  router.post('/annunci/:id/generate-audio', authenticateToken, requireVivaldiAccess, async (req, res) => {
    try {
      const { id } = req.params;

      // Recupera annuncio
      const annuncioResult = await pool.query('SELECT * FROM annunci WHERE id = $1', [id]);
      if (annuncioResult.rows.length === 0) {
        return res.status(404).json({ error: 'Annuncio non trovato' });
      }

      const annuncio = annuncioResult.rows[0];

      // Recupera API key
      const configResult = await pool.query(
        'SELECT chiave, valore FROM vivaldi_config WHERE chiave IN ($1, $2)',
        ['speechgen_api_key', 'speechgen_email']
      );

      const config = { apiKey: '', email: '' };
      configResult.rows.forEach(row => {
        if (row.chiave === 'speechgen_api_key') config.apiKey = row.valore || '';
        if (row.chiave === 'speechgen_email') config.email = row.valore || '';
      });

      if (!config.apiKey) {
        return res.status(400).json({ error: 'API Key SpeechGen non configurata' });
      }

      const speechGen = new SpeechGenClient(config.apiKey, config.email);
      const testo = annuncio.contenuto_pulito || annuncio.contenuto;
      
      const audioResult = await speechGen.generateAudio(
        testo,
        annuncio.speaker,
        parseFloat(annuncio.velocita),
        parseFloat(annuncio.tono)
      );

      // Aggiorna annuncio con URL audio
      await pool.query(
        'UPDATE annunci SET audio_url = $1, updated_at = NOW() WHERE id = $2',
        [audioResult.audioUrl, id]
      );

      res.json({ success: true, audioUrl: audioResult.audioUrl, duration: audioResult.duration });
    } catch (error) {
      console.error('❌ Errore generazione audio:', error);
      res.status(500).json({ error: 'Errore generazione audio' });
    }
  });

  return router;
};

