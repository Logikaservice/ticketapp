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
      console.log('📥 Richiesta lettura dati orari');
      const result = await pool.query('SELECT id, data, updated_at FROM orari_data ORDER BY id DESC LIMIT 1');
      
      if (result.rows.length === 0) {
        console.log('📝 Nessun record trovato, creo dati iniziali');
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
        console.log('✅ Dati iniziali creati');
        return res.json(initialData);
      }

      const data = result.rows[0].data || {
        companies: [],
        departments: {},
        employees: {},
        schedule: {}
      };
      
      // Log dei dati restituiti
      const employeeKeys = Object.keys(data.employees || {});
      console.log('📤 Dati restituiti - Chiavi dipendenti:', employeeKeys);
      employeeKeys.forEach(key => {
        const count = Array.isArray(data.employees[key]) ? data.employees[key].length : 0;
        console.log(`   - ${key}: ${count} dipendenti`);
      });

      res.json(data);
    } catch (err) {
      console.error('❌ Errore lettura dati orari:', err);
      console.error('❌ Stack:', err.stack);
      res.status(500).json({ error: 'Errore lettura dati' });
    }
  });

  // ENDPOINT: Verifica stato database (per debug)
  router.get('/debug', async (req, res) => {
    try {
      const result = await pool.query('SELECT id, updated_at, data FROM orari_data ORDER BY id DESC LIMIT 1');
      
      if (result.rows.length === 0) {
        return res.json({ 
          exists: false, 
          message: 'Nessun record trovato nel database' 
        });
      }

      const record = result.rows[0];
      const data = record.data || {};
      const employeeKeys = Object.keys(data.employees || {});
      
      const employeeDetails = {};
      employeeKeys.forEach(key => {
        employeeDetails[key] = {
          count: Array.isArray(data.employees[key]) ? data.employees[key].length : 0,
          employees: data.employees[key] || []
        };
      });

      res.json({
        exists: true,
        recordId: record.id,
        updatedAt: record.updated_at,
        companies: data.companies || [],
        departments: Object.keys(data.departments || {}),
        employeeKeys: employeeKeys,
        employeeDetails: employeeDetails,
        totalEmployees: Object.values(data.employees || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
      });
    } catch (err) {
      console.error('❌ Errore debug orari:', err);
      res.status(500).json({ error: 'Errore debug', details: err.message });
    }
  });

  // ENDPOINT: Salva dati
  router.post('/save', async (req, res) => {
    try {
      console.log('📥 Richiesta salvataggio orari ricevuta');
      const { companies, departments, employees, schedule } = req.body;

      // Log dei dati ricevuti
      console.log('📊 Dati ricevuti:', {
        companies: companies?.length || 0,
        departments: Object.keys(departments || {}).length,
        employees: Object.keys(employees || {}).length,
        schedule: Object.keys(schedule || {}).length
      });

      // Log dettagliato dipendenti
      if (employees) {
        const employeeKeys = Object.keys(employees);
        console.log('👥 Chiavi dipendenti ricevute:', employeeKeys);
        employeeKeys.forEach(key => {
          const count = Array.isArray(employees[key]) ? employees[key].length : 0;
          console.log(`   - ${key}: ${count} dipendenti`);
        });
      }

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
        const recordId = check.rows[0].id;
        console.log(`💾 Aggiornamento record esistente ID: ${recordId}`);
        
        // Log dettagliato prima del salvataggio
        console.log('📤 Dati da salvare (primi 500 caratteri):', JSON.stringify(cleanData).substring(0, 500));
        
        const result = await pool.query(
          'UPDATE orari_data SET data = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING id',
          [JSON.stringify(cleanData), recordId]
        );
        
        if (result.rows.length === 0) {
          console.error('❌ ERRORE: UPDATE non ha aggiornato nessun record!');
          throw new Error('UPDATE fallito');
        }
        
        console.log('✅ Dati orari aggiornati, ID:', result.rows[0].id);
        
        // Verifica immediata che i dati siano stati salvati
        const verify = await pool.query(
          'SELECT data->\'employees\' as employees FROM orari_data WHERE id = $1',
          [recordId]
        );
        
        if (verify.rows.length > 0) {
          const savedEmployees = verify.rows[0].employees;
          const savedKeys = Object.keys(savedEmployees || {});
          console.log('✅ Verifica salvataggio - Chiavi dipendenti nel DB:', savedKeys);
          
          // Conta dipendenti per chiave
          savedKeys.forEach(key => {
            const count = Array.isArray(savedEmployees[key]) ? savedEmployees[key].length : 0;
            console.log(`   - ${key}: ${count} dipendenti`);
          });
        } else {
          console.error('❌ ERRORE: Record non trovato dopo UPDATE!');
        }
      } else {
        console.log('💾 Inserimento nuovo record');
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
      console.error('❌ Body ricevuto:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ error: 'Errore salvataggio dati', details: err.message });
    }
  });

  return router;
};
