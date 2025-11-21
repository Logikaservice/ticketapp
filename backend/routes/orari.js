// routes/orari.js - Sistema Orari e Turni (Database separato)

const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

module.exports = (poolOrari) => {
  // Pool per database orari separato
  // Se non fornito, usa lo stesso pool ma con tabella separata
  const pool = poolOrari;

  // Inizializza tabella orari_data se non esiste
  const initOrariTable = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orari_data (
          id SERIAL PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      
      // Inserisci record iniziale con aziende di default se non esiste
      const check = await pool.query('SELECT COUNT(*) FROM orari_data');
      if (parseInt(check.rows[0].count) === 0) {
        const initialData = {
          companies: ['La Torre', 'Mercurio', 'Albatros'],
          departments: {
            'La Torre': ['Cucina'],
            'Mercurio': ['Cucina'],
            'Albatros': ['Cucina']
          },
          employees: {
            'La Torre-Cucina': [],
            'Mercurio-Cucina': [],
            'Albatros-Cucina': []
          },
          schedule: {}
        };
        await pool.query(`
          INSERT INTO orari_data (data) 
          VALUES ($1::jsonb)
        `, [JSON.stringify(initialData)]);
        console.log('✅ Dati iniziali creati con aziende: La Torre, Mercurio, Albatros');
      }
      
      console.log('✅ Tabella orari_data inizializzata');
    } catch (err) {
      console.error('❌ Errore inizializzazione orari_data:', err);
    }
  };

  // Inizializza al caricamento
  initOrariTable();

  // ENDPOINT: Ottieni tutti i dati
  router.get('/data', async (req, res) => {
    try {
      const result = await pool.query('SELECT data FROM orari_data ORDER BY id DESC LIMIT 1');
      
      if (result.rows.length === 0) {
        // Dati iniziali con aziende di default
        const initialData = {
          companies: ['La Torre', 'Mercurio', 'Albatros'],
          departments: {
            'La Torre': ['Cucina'],
            'Mercurio': ['Cucina'],
            'Albatros': ['Cucina']
          },
          employees: {
            'La Torre-Cucina': [],
            'Mercurio-Cucina': [],
            'Albatros-Cucina': []
          },
          schedule: {}
        };
        // Salva i dati iniziali nel database
        await pool.query(
          'INSERT INTO orari_data (data) VALUES ($1)',
          [JSON.stringify(initialData)]
        );
        return res.json(initialData);
      }

      const data = result.rows[0].data || {
        companies: [],
        departments: {},
        employees: {},
        schedule: {}
      };

      res.json(data);
    } catch (err) {
      console.error('❌ Errore lettura dati orari:', err);
      res.status(500).json({ error: 'Errore lettura dati' });
    }
  });

  // ENDPOINT: Salva dati
  router.post('/save', async (req, res) => {
    try {
      const { companies, departments, employees, schedule } = req.body;

      const dataToSave = {
        companies: companies || [],
        departments: departments || {},
        employees: employees || {},
        schedule: schedule || {}
      };

      // Pulisci il JSON per evitare problemi (rimuovi undefined, null, etc.)
      const cleanData = JSON.parse(JSON.stringify(dataToSave));

      // Aggiorna o inserisci
      const check = await pool.query('SELECT id FROM orari_data ORDER BY id DESC LIMIT 1');
      
      if (check.rows.length > 0) {
        const result = await pool.query(
          'UPDATE orari_data SET data = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING id',
          [JSON.stringify(cleanData), check.rows[0].id]
        );
        console.log('✅ Dati orari aggiornati, ID:', result.rows[0].id);
      } else {
        const result = await pool.query(
          'INSERT INTO orari_data (data) VALUES ($1::jsonb) RETURNING id',
          [JSON.stringify(cleanData)]
        );
        console.log('✅ Dati orari inseriti, ID:', result.rows[0].id);
      }

      res.json({ success: true, message: 'Dati salvati con successo' });
    } catch (err) {
      console.error('❌ Errore salvataggio dati orari:', err);
      console.error('❌ Stack:', err.stack);
      res.status(500).json({ error: 'Errore salvataggio dati', details: err.message });
    }
  });

  return router;
};

