const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  ensureLsightCompanyAccessTable,
  userCanAccessLsightAgent,
  isElevatedLsightViewer
} = require('../utils/lsightAccess');

// Usa pool condiviso del backend principale (evita mismatch DB).
let pool = null;

let tablesReady = false;
let tableInitError = null;

function assertPoolReady() {
  if (!pool) throw new Error('lsight-rdp: pool non inizializzato (passare pool condiviso da index.js)');
}

async function ensureTables() {
  if (tablesReady) return;
  assertPoolReady();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lsight_rdp_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(128) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_id INTEGER NOT NULL REFERENCES comm_agents(id) ON DELETE CASCADE,
        status VARCHAR(24) NOT NULL DEFAULT 'created'
          CHECK (status IN ('created','tunneling','ready','closed','expired')),
        gw_port INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rdp_sessions_agent ON lsight_rdp_sessions(agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rdp_sessions_user ON lsight_rdp_sessions(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rdp_sessions_expires ON lsight_rdp_sessions(expires_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_rdp_sessions_status ON lsight_rdp_sessions(status);`);
    await ensureLsightCompanyAccessTable(pool);
    tablesReady = true;
  } catch (e) {
    tableInitError = e.message;
    throw e;
  }
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

const isElevated = (req) => isElevatedLsightViewer(req.user?.ruolo);

function requireAgentKey(req, res, next) {
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
    await ensureTables();
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
    console.error('lsight-rdp: errore auth agent key:', e);
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
}

function getPortRange() {
  const min = Math.max(1, Number(process.env.LSIGHT_RDP_PORT_MIN || 40000));
  const max = Math.max(min + 1, Number(process.env.LSIGHT_RDP_PORT_MAX || 45000));
  return { min, max };
}

async function allocatePortTx(client) {
  const { min, max } = getPortRange();
  // Lock globale per evitare collisioni in concorrenza.
  await client.query(`SELECT pg_advisory_lock(987654321);`);
  try {
    const { rows } = await client.query(
      `SELECT gw_port
       FROM lsight_rdp_sessions
       WHERE status IN ('created','tunneling','ready')
         AND expires_at > NOW()`,
      []
    );
    const used = new Set(rows.map(r => Number(r.gw_port)));
    for (let p = min; p <= max; p++) {
      if (!used.has(p)) return p;
    }
    throw new Error('Nessuna porta disponibile per sessione RDP');
  } finally {
    await client.query(`SELECT pg_advisory_unlock(987654321);`);
  }
}

function buildRdpFile({ gatewayHost, gatewayPort, gwPort, promptUser }) {
  // Nota: MSTSC usa "gatewayhostname" e "gatewayusagemethod". La connessione finale dal gateway
  // va verso 127.0.0.1:gwPort (porta esposta dal reverse tunnel).
  const gw = gatewayPort ? `${gatewayHost}:${gatewayPort}` : gatewayHost;
  const lines = [
    `screen mode id:i:2`,
    `use multimon:i:0`,
    `desktopwidth:i:1920`,
    `desktopheight:i:1080`,
    `session bpp:i:32`,
    `compression:i:1`,
    `keyboardhook:i:2`,
    `audiomode:i:0`,
    `redirectclipboard:i:1`,
    `redirectprinters:i:1`,
    `redirectdrives:i:1`,
    `redirectcomports:i:0`,
    `redirectsmartcards:i:1`,
    `drivestoredirect:s:*`,
    `prompt for credentials:i:1`,
    `authentication level:i:2`,
    `full address:s:127.0.0.1`,
    `server port:i:${Number(gwPort)}`,
    `gatewayhostname:s:${gw}`,
    `gatewayusagemethod:i:1`,
    `gatewaycredentialssource:i:0`,
    `gatewayprofileusagemethod:i:1`,
    `promptcredentialonce:i:1`,
    `enablecredsspsupport:i:1`,
  ];
  if (promptUser) {
    lines.push(`username:s:${promptUser}`);
  }
  return lines.join('\r\n') + '\r\n';
}

// Viewer: JWT. Agent: api_key.
router.use((req, res, next) => {
  try {
    if (typeof req.path === 'string' && req.path.startsWith('/agent/')) return next();
  } catch (_) { /* ignore */ }
  return authenticateToken(req, res, next);
});

// -----------------------------
// Viewer API (JWT)
// -----------------------------
router.post('/sessions', async (req, res) => {
  try {
    await ensureTables();
    const agentId = Number(req.body?.agent_id);
    if (!agentId || Number.isNaN(agentId)) {
      return res.status(400).json({ success: false, error: 'agent_id non valido' });
    }
    const ok = await userCanAccessLsightAgent(pool, {
      viewerId: req.user.id,
      viewerRole: req.user?.ruolo,
      agentId
    });
    if (!ok) return res.status(403).json({ success: false, error: 'Accesso negato: PC non autorizzato per questo profilo' });

    const ttlMinutes = Math.max(5, Math.min(60, Number(req.body?.ttl_minutes || 15)));
    const token = crypto.randomBytes(32).toString('hex');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const gwPort = await allocatePortTx(client);
      const { rows } = await client.query(
        `INSERT INTO lsight_rdp_sessions (session_token, user_id, agent_id, gw_port, expires_at, status)
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval, 'created')
         RETURNING id, session_token, user_id, agent_id, gw_port, status, created_at, expires_at`,
        [token, req.user.id, agentId, gwPort, String(ttlMinutes)]
      );
      await client.query('COMMIT');
      return res.json({ success: true, session: rows[0] });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('lsight-rdp: errore creazione sessione:', e);
    return res.status(500).json({ success: false, error: 'Errore interno', details: String(e.message || e) });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });

    const { rows } = await pool.query(
      `SELECT id, session_token, user_id, agent_id, status, gw_port, created_at, expires_at
       FROM lsight_rdp_sessions
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    const s = rows[0];
    if (!isElevated(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }

    // Soft-expire
    const { rows: upd } = await pool.query(
      `UPDATE lsight_rdp_sessions
       SET status = CASE WHEN expires_at <= NOW() AND status NOT IN ('closed','expired') THEN 'expired' ELSE status END
       WHERE id = $1
       RETURNING id, session_token, user_id, agent_id, status, gw_port, created_at, expires_at`,
      [id]
    );
    return res.json({ success: true, session: upd[0] });
  } catch (e) {
    console.error('lsight-rdp: errore get session:', e);
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
});

router.get('/sessions/:id/rdp-file', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).send('id non valido');

    const { rows } = await pool.query(
      `SELECT id, user_id, agent_id, status, gw_port, expires_at
       FROM lsight_rdp_sessions
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).send('Sessione non trovata');
    const s = rows[0];
    if (!isElevated(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).send('Accesso negato');
    }
    if (s.status === 'closed' || s.status === 'expired') {
      return res.status(409).send(`Sessione ${s.status}`);
    }

    const gatewayHost = String(process.env.RDG_HOST || '').trim() || 'rdg.example.local';
    const gatewayPort = String(process.env.RDG_PORT || '').trim(); // opzionale
    const rdp = buildRdpFile({ gatewayHost, gatewayPort, gwPort: s.gw_port });

    res.setHeader('Content-Type', 'application/x-rdp');
    res.setHeader('Content-Disposition', `attachment; filename="lsight-${id}.rdp"`);
    return res.send(rdp);
  } catch (e) {
    console.error('lsight-rdp: errore rdp-file:', e);
    return res.status(500).send('Errore interno');
  }
});

router.post('/sessions/:id/close', async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });
    const { rows } = await pool.query(
      `SELECT id, user_id, status FROM lsight_rdp_sessions WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    const s = rows[0];
    if (!isElevated(req) && Number(s.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
    const { rows: upd } = await pool.query(
      `UPDATE lsight_rdp_sessions
       SET status = 'closed'
       WHERE id = $1
       RETURNING id, user_id, agent_id, status, gw_port, created_at, expires_at`,
      [id]
    );
    return res.json({ success: true, session: upd[0] });
  } catch (e) {
    console.error('lsight-rdp: errore close:', e);
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
});

// -----------------------------
// Agent API (X-Agent-Key)
// -----------------------------
router.get('/agent/sessions', requireAgentKey, authenticateAgentKey, async (req, res) => {
  try {
    await ensureTables();
    const limit = Math.max(1, Math.min(10, Number(req.query?.limit || 3)));
    const { rows } = await pool.query(
      `SELECT id, agent_id, status, gw_port, created_at, expires_at
       FROM lsight_rdp_sessions
       WHERE agent_id = $1
         AND status IN ('created','tunneling','ready')
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT $2`,
      [req.commAgent.id, limit]
    );
    return res.json({ success: true, sessions: rows });
  } catch (e) {
    console.error('lsight-rdp: errore agent sessions:', e);
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
});

router.post('/agent/sessions/:id/ready', requireAgentKey, authenticateAgentKey, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, error: 'id non valido' });
    const { rows } = await pool.query(
      `UPDATE lsight_rdp_sessions
       SET status = 'ready'
       WHERE id = $1 AND agent_id = $2 AND status IN ('created','tunneling','ready')
       RETURNING id, agent_id, status, gw_port, expires_at`,
      [id, req.commAgent.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Sessione non trovata' });
    return res.json({ success: true, session: rows[0] });
  } catch (e) {
    console.error('lsight-rdp: errore agent ready:', e);
    return res.status(500).json({ success: false, error: 'Errore interno' });
  }
});

module.exports = (sharedPool) => {
  pool = sharedPool;
  return router;
};

