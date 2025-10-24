// routes/tickets.js

const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // ENDPOINT: Prende tutti i ticket
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM tickets ORDER BY dataapertura DESC');
      
      // Parse dei campi JSON
      const tickets = result.rows.map(ticket => ({
        ...ticket,
        timelogs: ticket.timelogs ? (typeof ticket.timelogs === 'string' ? JSON.parse(ticket.timelogs) : ticket.timelogs) : null,
        messaggi: ticket.messaggi ? (typeof ticket.messaggi === 'string' ? JSON.parse(ticket.messaggi) : ticket.messaggi) : []
      }));
      
      client.release();
      res.json(tickets);
    } catch (err) {
      console.error('Errore nel prendere i ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Crea un nuovo ticket
  router.post('/', async (req, res) => {
    const { clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria } = req.body;
    
    try {
      const client = await pool.connect();
      
      // Genera ID semplice e pulito
      let numero;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!isUnique && attempts < maxAttempts) {
        // Genera numero semplice: anno + numero sequenziale
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 999) + 1; // 1-999
        numero = `TKT-${year}-${randomNum}`;
        
        // Verifica se l'ID esiste già
        const checkQuery = 'SELECT id FROM tickets WHERE numero = $1';
        const checkResult = await client.query(checkQuery, [numero]);
        
        if (checkResult.rows.length === 0) {
          isUnique = true;
        } else {
          attempts++;
          console.log(`⚠️ ID duplicato ${numero}, tentativo ${attempts + 1}`);
        }
      }
      
      if (!isUnique) {
        client.release();
        throw new Error('Impossibile generare ID unico dopo 10 tentativi');
      }
      
      console.log(`✅ ID ticket generato: ${numero}`);
      
      const query = `
        INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria, dataapertura, last_read_by_client, last_read_by_tecnico) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'Europe/Rome', NOW(), NOW()) 
        RETURNING *;
      `;
      const values = [numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria || 'assistenza'];
      const result = await client.query(query, values);
      client.release();
      
      // Invia notifica email al cliente
      if (result.rows[0]) {
        try {
          console.log('📧 === INVIO NOTIFICA EMAIL CLIENTE ===');
          console.log('📧 Ticket creato:', result.rows[0].id, result.rows[0].titolo);
          console.log('📧 Cliente ID:', clienteid);
          
          // Ottieni i dati del cliente
          const clientData = await pool.query('SELECT email, nome, cognome FROM users WHERE id = $1', [clienteid]);
          console.log('📧 Dati cliente trovati:', clientData.rows.length > 0);
          
          if (clientData.rows.length > 0 && clientData.rows[0].email) {
            const client = clientData.rows[0];
            console.log('📧 Email cliente:', client.email);
            console.log('📧 Nome cliente:', client.nome, client.cognome);
            
            // Determina il tipo di notifica
            const isSelfCreated = req.body.createdBy === 'cliente' || req.body.selfCreated;
            const emailType = isSelfCreated ? 'notify-ticket-created' : 'notify-ticket-assigned';
            console.log('📧 Tipo notifica:', emailType, '(isSelfCreated:', isSelfCreated, ')');
            
            // Invia email di notifica
            const emailUrl = `${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/${emailType}`;
            console.log('📧 URL email:', emailUrl);
            console.log('📧 API_URL configurato:', process.env.API_URL ? 'SÌ' : 'NO');
            
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const emailResponse = await fetch(emailUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: result.rows[0],
                clientEmail: client.email,
                clientName: `${client.nome} ${client.cognome}`,
                clientAzienda: client.azienda,
                isSelfCreated: isSelfCreated
              })
            });
            
            if (emailResponse.ok) {
              const responseData = await emailResponse.json();
              console.log(`✅ Email notifica inviata al cliente: ${client.email} (${emailType})`);
              console.log('📧 Risposta email:', responseData);
            } else {
              const errorText = await emailResponse.text();
              console.log(`❌ Errore invio email al cliente: ${client.email}`);
              console.log('📧 Status:', emailResponse.status);
              console.log('📧 Errore:', errorText);
            }
          }
        } catch (emailErr) {
          console.log('⚠️ Errore invio email notifica:', emailErr.message);
        }
      }
      
      // Invia notifica email ai tecnici
      try {
        console.log('📧 === INVIO NOTIFICA EMAIL TECNICI ===');
        const techniciansData = await pool.query('SELECT email, nome, cognome FROM users WHERE ruolo = \'tecnico\' AND email IS NOT NULL');
        console.log('📧 Tecnici trovati:', techniciansData.rows.length);
        
        for (const technician of techniciansData.rows) {
          try {
            console.log('📧 Invio email a tecnico:', technician.email);
            const techEmailUrl = `${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/notify-technician-new-ticket`;
            console.log('📧 URL tecnico:', techEmailUrl);
            
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const technicianEmailResponse = await fetch(techEmailUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: result.rows[0],
                technicianEmail: technician.email,
                technicianName: `${technician.nome} ${technician.cognome}`
              })
            });
            
            if (technicianEmailResponse.ok) {
              const responseData = await technicianEmailResponse.json();
              console.log(`✅ Email notifica inviata al tecnico: ${technician.email}`);
              console.log('📧 Risposta tecnico:', responseData);
            } else {
              const errorText = await technicianEmailResponse.text();
              console.log(`❌ Errore invio email al tecnico: ${technician.email}`);
              console.log('📧 Status tecnico:', technicianEmailResponse.status);
              console.log('📧 Errore tecnico:', errorText);
            }
          } catch (techEmailErr) {
            console.log(`⚠️ Errore invio email tecnico ${technician.email}:`, techEmailErr.message);
          }
        }
      } catch (techErr) {
        console.log('⚠️ Errore invio email ai tecnici:', techErr.message);
      }
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nella creazione del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Modifica un ticket completo
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, dataapertura } = req.body;
    
    try {
      const client = await pool.connect();
      const query = `
        UPDATE tickets 
        SET titolo = $1, descrizione = $2, categoria = $3, priorita = $4, nomerichiedente = $5, clienteid = $6, dataapertura = $7
        WHERE id = $8 
        RETURNING *;
      `;
      const values = [titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, dataapertura, id];
      const result = await client.query(query, values);
      client.release();

      if (result.rows.length > 0) {
        console.log(`✅ Ticket aggiornato: ID ${id}`);
        
        // Invia notifica email per aggiornamento ticket
        try {
          const clientData = await pool.query('SELECT email, nome, cognome FROM users WHERE id = $1', [result.rows[0].clienteid]);
          
          if (clientData.rows.length > 0 && clientData.rows[0].email) {
            const client = clientData.rows[0];
            
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const emailResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/notify-ticket-updated`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: result.rows[0],
                clientEmail: client.email,
                clientName: `${client.nome} ${client.cognome}`,
                clientAzienda: client.azienda,
                changes: 'Ticket aggiornato'
              })
            });
            
            if (emailResponse.ok) {
              console.log(`✅ Email aggiornamento inviata al cliente: ${client.email}`);
            }
          }
        } catch (emailErr) {
          console.log('⚠️ Errore invio email aggiornamento:', emailErr.message);
        }
        
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nell\'aggiornamento del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiorna lo stato di un ticket
  router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const client = await pool.connect();
      const query = 'UPDATE tickets SET stato = $1 WHERE id = $2 RETURNING *;';
      const result = await client.query(query, [status, id]);
      client.release();

      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error(`Errore nell'aggiornare il ticket ${id}`, err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi un messaggio a un ticket
  router.post('/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { autore, contenuto, reclamo } = req.body;
    
    try {
      const client = await pool.connect();
      const ticketResult = await client.query('SELECT messaggi FROM tickets WHERE id = $1', [id]);
      
      if (ticketResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      let messaggi = ticketResult.rows[0].messaggi || [];
      const newMessage = {
        id: messaggi.length + 1,
        autore,
        contenuto,
        data: new Date().toISOString(),
        reclamo: reclamo || false
      };
      messaggi.push(newMessage);
      
      await client.query('UPDATE tickets SET messaggi = $1 WHERE id = $2', [JSON.stringify(messaggi), id]);
      client.release();
      
      res.status(201).json(newMessage);
    } catch (err) {
      console.error('Errore nel salvare il messaggio:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Marca i messaggi come letti
  router.patch('/:id/mark-read', async (req, res) => {
    const { id } = req.params;
    const { ruolo } = req.body;
    
    try {
      const client = await pool.connect();
      const column = ruolo === 'cliente' ? 'last_read_by_client' : 'last_read_by_tecnico';
      const query = `UPDATE tickets SET ${column} = NOW() WHERE id = $1 RETURNING *;`;
      const result = await client.query(query, [id]);
      client.release();
      
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('Errore nel marcare come letto:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Salva i timelogs in un ticket
  router.post('/:id/timelogs', async (req, res) => {
    const { id } = req.params;
    const { timeLogs } = req.body;
    
    try {
      const client = await pool.connect();
      const query = 'UPDATE tickets SET timelogs = $1 WHERE id = $2 RETURNING *;';
      const result = await client.query(query, [JSON.stringify(timeLogs), id]);
      client.release();

      if (result.rows.length > 0) {
        console.log(`✅ Timelogs salvati per ticket ID ${id}`);
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nel salvare i timelogs:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina un ticket
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const client = await pool.connect();
      
      // Prima ottieni il ticket per recuperare l'ID dell'evento Google Calendar
      const ticketResult = await client.query('SELECT * FROM tickets WHERE id = $1', [id]);
      
      if (ticketResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      const ticket = ticketResult.rows[0];
      console.log(`🗑️ Ticket #${ticket.id} da eliminare - Google Calendar Event ID: ${ticket.googlecalendareventid || 'NON PRESENTE'}`);
      
      // Elimina il ticket dal database
      const result = await client.query('DELETE FROM tickets WHERE id = $1', [id]);
      client.release();

      if (result.rowCount > 0) {
        // Se il ticket ha un ID evento Google Calendar, sincronizza la cancellazione
        if (ticket.googlecalendareventid) {
          console.log(`🗑️ Ticket #${ticket.id} eliminato, sincronizzazione cancellazione Google Calendar...`);
          
          // Chiama la sincronizzazione Google Calendar
          try {
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const syncResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/sync-google-calendar`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: {
                  ...ticket,
                  googleCalendarEventId: ticket.googlecalendareventid
                },
                action: 'delete'
              })
            });
            
            if (syncResponse.ok) {
              console.log(`✅ Evento Google Calendar cancellato per ticket #${ticket.id}`);
            } else {
              console.log(`⚠️ Errore cancellazione evento Google Calendar per ticket #${ticket.id}`);
            }
          } catch (syncErr) {
            console.log(`⚠️ Errore sincronizzazione cancellazione Google Calendar:`, syncErr.message);
          }
        }
        
        res.status(200).json({ message: 'Ticket eliminato con successo' });
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminazione del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Prende forniture temporanee di un ticket
  router.get('/:id/forniture', async (req, res) => {
    const { id } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT * FROM forniture_temporanee WHERE ticket_id = $1 ORDER BY data_prestito DESC',
        [id]
      );
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare le forniture:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi fornitura temporanea
  router.post('/:id/forniture', async (req, res) => {
    const { id } = req.params;
    const { materiale, quantita } = req.body;
    
    if (!materiale || !quantita) {
      return res.status(400).json({ error: 'Materiale e quantità sono obbligatori' });
    }
    
    try {
      const client = await pool.connect();
      const query = `
        INSERT INTO forniture_temporanee (ticket_id, materiale, quantita) 
        VALUES ($1, $2, $3) 
        RETURNING *;
      `;
      const result = await client.query(query, [id, materiale, parseInt(quantita)]);
      client.release();
      
      console.log(`✅ Fornitura aggiunta al ticket ${id}`);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nell\'aggiungere la fornitura:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina fornitura temporanea (restituita)
  router.delete('/forniture/:fornituraId', async (req, res) => {
    const { fornituraId } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'DELETE FROM forniture_temporanee WHERE id = $1 RETURNING *',
        [fornituraId]
      );
      client.release();
      
      if (result.rowCount > 0) {
        console.log(`✅ Fornitura ${fornituraId} restituita`);
        res.json({ message: 'Fornitura restituita con successo' });
      } else {
        res.status(404).json({ error: 'Fornitura non trovata' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminare la fornitura:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};
