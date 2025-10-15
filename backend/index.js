// Importa i pacchetti necessari
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURAZIONE DATABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- MIDDLEWARE ---
const corsOptions = {
  origin: 'https://ticketapp-frontend-ton5.onrender.com'
};
app.use(cors(corsOptions));
app.use(express.json());

// --- ROUTES ---
app.get('/api', (req, res) => {
  res.json({ message: "API del sistema di ticketing funzionante." });
});

// ENDPOINT: Keepalive per Supabase
app.get('/api/keepalive', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({ 
      status: 'Database attivo', 
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    console.error('Errore keepalive:', err);
    res.status(500).json({ error: 'Errore keepalive' });
  }
});

// ENDPOINT: Login utente
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
        client.release();

        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.password;
            res.json(user);
        } else {
            res.status(401).json({ error: 'Credenziali non valide' });
        }
    } catch (err) {
        console.error('Errore durante il login:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Prende tutti gli utenti (per il tecnico)
app.get('/api/users', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT id, email, password, ruolo, nome, cognome, telefono, azienda FROM users');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel prendere gli utenti', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Crea un nuovo cliente (utente)
app.post('/api/users', async (req, res) => {
    const { email, password, telefono, azienda, ruolo, nome, cognome } = req.body;

    if (!email || !password || !azienda) {
        return res.status(400).json({ error: 'Email, password e azienda sono obbligatori' });
    }

    if (!nome || !cognome) {
        return res.status(400).json({ error: 'Nome e cognome sono obbligatori' });
    }

    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO users (email, password, telefono, azienda, ruolo, nome, cognome) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, email, ruolo, nome, cognome, telefono, azienda;
        `;
        const values = [email, password, telefono || null, azienda, ruolo || 'cliente', nome, cognome];
        const result = await client.query(query, values);
        client.release();
        
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('ERRORE NELLA CREAZIONE DEL CLIENTE:', err);
        res.status(500).json({ error: 'Errore interno del server durante la creazione del cliente' });
    }
});

// ENDPOINT: Aggiorna un utente/cliente
app.patch('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, cognome, email, telefono, azienda, password } = req.body;
    
    try {
        const client = await pool.connect();
        
        let query, values;
        if (password && password.trim() !== '') {
            query = `
                UPDATE users 
                SET nome = $1, cognome = $2, email = $3, telefono = $4, azienda = $5, password = $6
                WHERE id = $7 
                RETURNING id, email, ruolo, nome, cognome, telefono, azienda;
            `;
            values = [nome, cognome, email, telefono, azienda, password, id];
        } else {
            query = `
                UPDATE users 
                SET nome = $1, cognome = $2, email = $3, telefono = $4, azienda = $5 
                WHERE id = $6 
                RETURNING id, email, ruolo, nome, cognome, telefono, azienda;
            `;
            values = [nome, cognome, email, telefono, azienda, id];
        }
        
        const result = await client.query(query, values);
        client.release();
        
        if (result.rows.length > 0) {
            console.log(`✅ Cliente aggiornato: ID ${id}`);
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Cliente non trovato' });
        }
    } catch (err) {
        console.error('❌ Errore nell\'aggiornamento del cliente:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Elimina un utente/cliente
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const client = await pool.connect();
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        client.release();

        if (result.rowCount > 0) {
            console.log(`✅ Cliente eliminato: ID ${id}`);
            res.status(200).json({ 
                message: 'Cliente eliminato con successo', 
                user: result.rows[0] 
            });
        } else {
            res.status(404).json({ error: 'Cliente non trovato' });
        }
    } catch (err) {
        console.error('❌ Errore nell\'eliminazione del cliente:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Prende tutti i ticket
app.get('/api/tickets', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM tickets ORDER BY dataapertura DESC');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel prendere i ticket:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Crea un nuovo ticket
app.post('/api/tickets', async (req, res) => {
    const { clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria } = req.body;
    const numero = `TKT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria, last_read_by_client, last_read_by_tecnico) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
            RETURNING *;
        `;
        const values = [numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria || 'assistenza'];
        const result = await client.query(query, values);
        client.release();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Errore nella creazione del ticket:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Modifica un ticket completo
app.put('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    const { titolo, descrizione, categoria, priorita, nomerichiedente, clienteid } = req.body;
    
    try {
        const client = await pool.connect();
        const query = `
            UPDATE tickets 
            SET titolo = $1, descrizione = $2, categoria = $3, priorita = $4, nomerichiedente = $5, clienteid = $6
            WHERE id = $7 
            RETURNING *;
        `;
        const values = [titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, id];
        const result = await client.query(query, values);
        client.release();

        if (result.rows.length > 0) {
            console.log(`✅ Ticket aggiornato: ID ${id}`);
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
app.patch('/api/tickets/:id/status', async (req, res) => {
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
app.post('/api/tickets/:id/messages', async (req, res) => {
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
app.patch('/api/tickets/:id/mark-read', async (req, res) => {
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

// ENDPOINT: Elimina un ticket
app.delete('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        const result = await client.query('DELETE FROM tickets WHERE id = $1', [id]);
        client.release();

        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Ticket eliminato con successo' });
        } else {
            res.status(404).json({ error: 'Ticket non trovato' });
        }
    } catch (err) {
        console.error('Errore nell\'eliminazione del ticket:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// 🆕 ENDPOINT: Salva i timelogs in un ticket
app.post('/api/tickets/:id/timelogs', async (req, res) => {
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

// --- AVVIO DEL SERVER ---
const startServer = async () => {
  try {
    await pool.connect();
    console.log("✅ Connessione al database riuscita!");
    app.listen(PORT, () => {
      console.log(`🚀 Server backend AGGIORNATO in ascolto sulla porta ${PORT}`);
      console.log(`✨ Endpoint POST /api/tickets/:id/timelogs attivo!`);
    });
  } catch (err) {
    console.error("❌ Errore critico - Impossibile connettersi al database:", err);
    process.exit(1);
  }
};

startServer();
