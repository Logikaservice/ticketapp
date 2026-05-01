/**
 * Logica autorizzazioni L-Sight condivisa tra /api/lsight e /api/lsight-rdp.
 * - lsight_company_access: un utente può usare il servizio per tutti i PC la cui "azienda owner"
 *   coincide (case-insensitive) con la riga di grant.
 * - lsight_assignments: permesso punto-punto legacy (agent_id + user_id), ancora valido.
 */

let companyAccessTableReady = false;

function normalizeCompanyName(s) {
  return String(s || '').trim().toLowerCase();
}

async function ensureLsightCompanyAccessTable(pool) {
  if (!pool || companyAccessTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lsight_company_access (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_azienda VARCHAR(512) NOT NULL,
      assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, company_azienda)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lsight_company_access_user ON lsight_company_access(user_id)`);
  companyAccessTableReady = true;
}

function isElevatedLsightViewer(ruolo) {
  return ruolo === 'tecnico' || ruolo === 'admin';
}

/**
 * L'utente viewer può avviare RDP verso questo agent?
 */
async function userCanAccessLsightAgent(pool, { viewerId, viewerRole, agentId }) {
  if (!pool) throw new Error('lsightAccess: pool richiesto');
  const vid = Number(viewerId);
  const aid = Number(agentId);
  if (!aid || Number.isNaN(aid)) return false;

  if (isElevatedLsightViewer(viewerRole)) return true;

  const { rows } = await pool.query(
    `SELECT 1
     FROM comm_agents ca
     LEFT JOIN users owner ON ca.user_id = owner.id
     WHERE ca.id = $2
       AND (
         EXISTS (
           SELECT 1 FROM lsight_assignments la
           WHERE la.user_id = $1 AND la.agent_id = ca.id
         )
         OR (
           EXISTS (
             SELECT 1 FROM lsight_company_access g
             WHERE g.user_id = $1
               AND owner.azienda IS NOT NULL AND TRIM(owner.azienda) <> ''
               AND LOWER(TRIM(g.company_azienda)) = LOWER(TRIM(owner.azienda))
           )
         )
       )
     LIMIT 1`,
    [vid, aid]
  );
  return rows.length > 0;
}

module.exports = {
  normalizeCompanyName,
  ensureLsightCompanyAccessTable,
  isElevatedLsightViewer,
  userCanAccessLsightAgent
};
