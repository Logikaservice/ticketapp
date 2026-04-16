const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/authMiddleware');
 
// Nota: questo modulo è volutamente isolato (feature flag in backend/index.js).
// Usa un pool dedicato come backend/routes/lsight.js per minimizzare accoppiamenti iniziali.
let poolConfig = {};
if (process.env.DATABASE_URL) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const match = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (match) {
      poolConfig.user = decodeURIComponent(match[1]);
      poolConfig.password = decodeURIComponent(match[2]);
      if (typeof poolConfig.password !== 'string') poolConfig.password = String(poolConfig.password);
      poolConfig.host = match[3];
      poolConfig.port = parseInt(match[4], 10);
      poolConfig.database = match[5];
      poolConfig.ssl = (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1')
        ? false
        : { rejectUnauthorized: false };
    } else {
      poolConfig.connectionString = process.env.DATABASE_URL;
    }
  } catch (e) {
    poolConfig.connectionString = process.env.DATABASE_URL;
  }
}
 
const pool = new Pool(poolConfig);
 
let tablesReady = false;
let tableInitError = null;
const verboseErrors = String(process.env.LSIGHT_RTC_VERBOSE_ERRORS || '').trim() === '1';
const rtcDebug = String(process.env.LSIGHT_RTC_DEBUG || '').trim() === '1';

function toErrPayload(e) {
  if (!e) return undefined;
  return {
    message: e.message,
    code: e.code,
    detail: e.detail,
    hint: e.hint,
    where: e.where
  };
}
const ensureTables = async () => {
  if (tablesReady) return;
  try {
    // Permessi L-Sight: necessari per validare l'accesso alle postazioni (clienti)
    // Vengono creati anche da routes/lsight.js, ma qui li garantiamo per evitare dipendenze dall'ordine di avvio/uso.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lsight_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES comm_agents(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, agent_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lsight_rtc_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(128) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_id INTEGER NOT NULL REFERENCES comm_agents(id) ON DELETE CASCADE,
        status VARCHAR(24) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'connecting', 'active', 'closed', 'expired')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        created_ip VARCHAR(64),
        user_agent TEXT
      );
    `);
    // Signaling (offer/answer/ice) persistito su DB per semplicità iniziale.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lsight_rtc_signals (
        id BIGSERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES lsight_rtc_sessions(id) ON DELETE CASCADE,
        sender VARCHAR(16) NOT NULL CHECK (sender IN ('viewer','agent')),
        type VARCHAR(32) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rtc_signals_session_id ON lsight_rtc_signals(session_id, id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rtc_sessions_user ON lsight_rtc_sessions(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rtc_sessions_agent ON lsight_rtc_sessions(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rtc_sessions_status ON lsight_rtc_sessions(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rtc_sessions_expires ON lsight_rtc_sessions(expires_at);`);
    tablesReady = true;
  } catch (e) {
    tableInitError = e.message;
    throw e;
  }
};
 
// Tutte le route richiedono JWT
router.use(authenticateToken);
 
const isTecnico = (req) => req.user?.ruolo === 'tecnico';
 
async function userCanAccessAgent({ userId, agentId }) {
  // Tecnici: accesso pieno
  // Clienti: solo se assegnato in lsight_assignments
  const { rows } = await pool.query(
    `SELECT 1
     FROM lsight_assignments
     WHERE user_id = $1 AND agent_id = $2
     LIMIT 1`,
    [userId, agentId]
  );
  return rows.length > 0;
}
 
function getClientIp(req) {
  // Supporto basilare: se dietro reverse proxy, X-Forwarded-For può contenere più IP
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}
 
async function getSessionById(id) {
  const { rows } = await pool.query(
    `SELECT id, session_token, user_id, agent_id, status, created_at, expires_at
     FROM lsight_rtc_sessions
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function touchSessionStatus(sessionId, nextStatus) {
  try {
    await pool.query(
      `UPDATE lsight_rtc_sessions
       SET status = $2
       WHERE id = $1 AND status NOT IN ('closed','expired')
       `,
      [sessionId, nextStatus]
    );
  } catch (_) {
    // ignore
  }
}

function requireAgentKey(req, res, next) {
  // L'agent usa la stessa api_key di comm_agents (riuso del modello esistente).
  const key =
    (typeof req.headers['x-agent-key'] === 'string' && req.headers['x-agent-key'].trim())
      ? req.headers['x-agent-key'].trim()
      : (typeof req.headers['x-comm-agent-key'] === 'string' && req.headers['x-comm-agent-key'].trim())
        ? req.headers['x-comm-agent-key'].trim()
        : (typeof req.headers['authorization'] === 'string' && req.headers['authorization'].startsWith('Agent '))
          ? req.headers['authorization'].slice('Agent '.length).trim()
          : null;

  if (!key) return res.status(401).json({ success: false, error: 'Agent key mancante (X-Agent-Key)' });
  req._agentKey = key;
  next();
}

async function authenticateAgentKey(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, machine_name, machine_id, status
       FROM comm_agents
       WHERE api_key = $1
       LIMIT 1`,
      [req._agentKey]
    );
    if (!rows.length) return res.status(401).json({ success: false, error: 'Agent key non valida' });
    req.commAgent = rows[0];
    return next();
  } catch (e) {
    console.error('lsight-rtc: errore auth agent key:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
}

// Crea una sessione “control-plane” (signaling e media verranno aggiunti nei prossimi step)
router.post('/sessions', async (req, res) => {
  try {
    await ensureTables();
    const agentId = Number(req.body?.agent_id);
    if (!agentId || Number.isNaN(agentId)) {
      return res.status(400).json({ success: false, error: 'agent_id non valido' });
    }
 
    if (!isTecnico(req)) {
      const ok = await userCanAccessAgent({ userId: req.user.id, agentId });
      if (!ok) return res.status(403).json({ success: false, error: 'Accesso negato: PC non assegnato' });
    }
 
    const ttlMinutes = Math.max(5, Math.min(60, Number(req.body?.ttl_minutes || 10)));
    const token = crypto.randomBytes(32).toString('hex');
    const createdIp = getClientIp(req);
    const ua = String(req.headers['user-agent'] || '');
 
    const { rows } = await pool.query(
      `INSERT INTO lsight_rtc_sessions (session_token, user_id, agent_id, expires_at, created_ip, user_agent)
       VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval, $5, $6)
       RETURNING id, session_token, user_id, agent_id, status, created_at, expires_at`,
      [token, req.user.id, agentId, String(ttlMinutes), createdIp, ua]
    );
 
    return res.json({ success: true, session: rows[0] });
  } catch (e) {
    console.error('lsight-rtc: errore creazione sessione:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});
 
router.get('/sessions/:id', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });
 
    const s = await getSessionById(id);
    if (!s) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    if (!isTecnico(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
 
    // Auto-expire “soft” (non cancella, marca)
    if (s.status !== 'closed') {
      const { rows: expRows } = await pool.query(
        `UPDATE lsight_rtc_sessions
         SET status = CASE WHEN expires_at <= NOW() THEN 'expired' ELSE status END
         WHERE id = $1
         RETURNING id, session_token, user_id, agent_id, status, created_at, expires_at`,
        [id]
      );
      return res.json({ success: true, session: expRows[0] });
    }
 
    return res.json({ success: true, session: s });
  } catch (e) {
    console.error('lsight-rtc: errore get session:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});
 
// -------------------------------
// Signaling lato viewer (JWT)
// -------------------------------
router.post('/sessions/:id/signal', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });

    const s = await getSessionById(id);
    if (!s) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    if (!isTecnico(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
    if (s.status === 'closed' || s.status === 'expired') {
      return res.status(409).json({ success: false, error: `Sessione ${s.status}` });
    }

    const type = String(req.body?.type || '').trim();
    const payload = req.body?.payload;
    if (!type) return res.status(400).json({ success: false, error: 'type mancante' });
    if (payload === undefined || payload === null) return res.status(400).json({ success: false, error: 'payload mancante' });

    const { rows } = await pool.query(
      `INSERT INTO lsight_rtc_signals (session_id, sender, type, payload)
       VALUES ($1, 'viewer', $2, $3)
       RETURNING id, created_at`,
      [id, type, payload]
    );
    if (rtcDebug) console.log('lsight-rtc: viewer signal', { sessionId: id, type, signalId: rows[0]?.id });

    // Segna sessione come "connecting" quando arriva il primo offer.
    if (type === 'offer') await touchSessionStatus(id, 'connecting');

    return res.json({ success: true, signal: rows[0] });
  } catch (e) {
    console.error('lsight-rtc: errore viewer signal:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});

router.get('/sessions/:id/signals', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });

    const s = await getSessionById(id);
    if (!s) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    if (!isTecnico(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }

    const after = Number(req.query?.after || 0);
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 50)));

    const { rows } = await pool.query(
      `SELECT id, sender, type, payload, created_at
       FROM lsight_rtc_signals
       WHERE session_id = $1 AND sender = 'agent' AND id > $2
       ORDER BY id ASC
       LIMIT $3`,
      [id, Number.isFinite(after) ? after : 0, limit]
    );

    return res.json({ success: true, signals: rows, nextAfter: rows.length ? rows[rows.length - 1].id : after });
  } catch (e) {
    console.error('lsight-rtc: errore viewer get signals:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});

// -------------------------------
// Signaling lato agent (api_key)
// -------------------------------
router.get('/agent/sessions', requireAgentKey, authenticateAgentKey, async (req, res) => {
  try {
    await ensureTables();

    const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 10)));
    const { rows } = await pool.query(
      `SELECT id, session_token, user_id, agent_id, status, created_at, expires_at
       FROM lsight_rtc_sessions
       WHERE agent_id = $1
         AND status IN ('created','connecting','active')
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT $2`,
      [req.commAgent.id, limit]
    );

    return res.json({ success: true, sessions: rows });
  } catch (e) {
    console.error('lsight-rtc: errore agent list sessions:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});

router.get('/agent/sessions/:id', requireAgentKey, authenticateAgentKey, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });

    const s = await getSessionById(id);
    if (!s) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    if (Number(s.agent_id) !== Number(req.commAgent.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
    return res.json({ success: true, session: s });
  } catch (e) {
    console.error('lsight-rtc: errore agent get session:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});

router.get('/agent/sessions/:id/signals', requireAgentKey, authenticateAgentKey, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });

    const s = await getSessionById(id);
    if (!s) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    if (Number(s.agent_id) !== Number(req.commAgent.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }

    const after = Number(req.query?.after || 0);
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 50)));

    const { rows } = await pool.query(
      `SELECT id, sender, type, payload, created_at
       FROM lsight_rtc_signals
       WHERE session_id = $1 AND sender = 'viewer' AND id > $2
       ORDER BY id ASC
       LIMIT $3`,
      [id, Number.isFinite(after) ? after : 0, limit]
    );

    return res.json({ success: true, signals: rows, nextAfter: rows.length ? rows[rows.length - 1].id : after });
  } catch (e) {
    console.error('lsight-rtc: errore agent get signals:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});

router.post('/agent/sessions/:id/signal', requireAgentKey, authenticateAgentKey, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });

    const s = await getSessionById(id);
    if (!s) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    if (Number(s.agent_id) !== Number(req.commAgent.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
    if (s.status === 'closed' || s.status === 'expired') {
      return res.status(409).json({ success: false, error: `Sessione ${s.status}` });
    }

    const type = String(req.body?.type || '').trim();
    const payload = req.body?.payload;
    if (!type) return res.status(400).json({ success: false, error: 'type mancante' });
    if (payload === undefined || payload === null) return res.status(400).json({ success: false, error: 'payload mancante' });

    const { rows } = await pool.query(
      `INSERT INTO lsight_rtc_signals (session_id, sender, type, payload)
       VALUES ($1, 'agent', $2, $3)
       RETURNING id, created_at`,
      [id, type, payload]
    );
    if (rtcDebug) console.log('lsight-rtc: agent signal', { sessionId: id, type, signalId: rows[0]?.id });

    if (type === 'answer') await touchSessionStatus(id, 'active');

    return res.json({ success: true, signal: rows[0] });
  } catch (e) {
    console.error('lsight-rtc: errore agent signal:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});

router.post('/sessions/:id/close', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });
 
    const { rows } = await pool.query(
      `SELECT id, user_id, status FROM lsight_rtc_sessions WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
 
    const s = rows[0];
    if (!isTecnico(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
 
    const { rows: upd } = await pool.query(
      `UPDATE lsight_rtc_sessions
       SET status = 'closed'
       WHERE id = $1
       RETURNING id, user_id, agent_id, status, created_at, expires_at`,
      [id]
    );
 
    return res.json({ success: true, session: upd[0] });
  } catch (e) {
    console.error('lsight-rtc: errore close session:', e);
    return res.status(500).json({
      success: false,
      error: 'Errore interno',
      ...(verboseErrors ? { details: toErrPayload(e) } : {})
    });
  }
});
 
// Debug minimale: stato tabelle
router.get('/debug/state', async (req, res) => {
  try {
    await ensureTables();
    return res.json({ success: true, tablesReady, tableInitError });
  } catch (e) {
    return res.json({ success: false, tablesReady, tableInitError: tableInitError || e.message });
  }
});
 
module.exports = router;

