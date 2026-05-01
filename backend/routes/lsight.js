const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  normalizeCompanyName,
  ensureLsightCompanyAccessTable,
  userCanAccessLsightAgent,
} = require('../utils/lsightAccess');

/**
 * Router L-Sight — usa il pool Postgres condiviso da index.js (nessun Pool duplicato).
 */
module.exports = (pool) => {
  const router = express.Router();
  const normalizeMacSql = (field) =>
    `REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(${field}, '')), ':', ''), '-', ''), '.', ''), ' ', '')`;

  const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.|$)){4}\b/;

  function firstIpv4FromString(s) {
    const t = String(s || '').trim();
    if (!t) return null;
    const m = t.match(IPV4_RE);
    return m ? m[0].replace(/\.$/, '') : null;
  }

  function pickRdpTargetFromRow(row) {
    if (!row) return null;
    const candidates = [];
    const push = (v) => {
      const x = String(v || '').trim();
      if (x) candidates.push(x);
    };
    push(row.primary_ip);
    push(row.ip_addresses);
    push(row.comm_ip);
    push(row.monitor_ip);
    for (const c of candidates) {
      if (c.includes(',') || c.includes(' ') || c.includes('\n')) {
        const parts = c.split(/[,\s\n]+/).map((p) => p.trim()).filter(Boolean);
        for (const p of parts) {
          const ip = firstIpv4FromString(p.replace(/\s*\(.*$/, '').trim());
          if (ip) return ip;
        }
      } else {
        const ip = firstIpv4FromString(c.replace(/\s*\(.*$/, '').trim());
        if (ip) return ip;
      }
    }
    return null;
  }

  function buildDirectRdpFile({ host, port }) {
    const p = Number(port) || 3389;
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
      `full address:s:${host}`,
      `server port:i:${p}`,
      `enablecredsspsupport:i:1`,
    ];
    const u = String(process.env.LSIGHT_DIRECT_RDP_USERNAME || '').trim();
    if (u) lines.push(`username:s:${u}`);
    return lines.join('\r\n') + '\r\n';
  }

  /** Cliente autorizzabile: email + campo azienda profilo coincide con selezione tecnico */
  async function resolveClientePerAziendaLsight(rawEmail, rawAzienda) {
    const email = String(rawEmail || '').trim();
    const rawCompany = String(rawAzienda || '').trim();
    if (!email || !rawCompany) {
      return { error: 'email e azienda obbligatorie' };
    }
    const companyKey = normalizeCompanyName(rawCompany);
    const { rows: userRows } = await pool.query(
      `SELECT id, email, ruolo, azienda FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
      [email]
    );
    if (!userRows.length) return { error: 'Utente con questa email non trovato' };
    const u = userRows[0];
    if (u.ruolo !== 'cliente') return { error: 'L-Sight: solo utenti ruolo cliente' };
    if (normalizeCompanyName(u.azienda) !== companyKey) {
      return {
        error: `L'email non appartiene all'azienda indicata (${rawCompany}).`,
      };
    }
    const { rows: idRows } = await pool.query(
      `SELECT ca.id
       FROM comm_agents ca
       JOIN users ow ON ow.id = ca.user_id
       WHERE LOWER(TRIM(ow.azienda)) = LOWER(TRIM($1))`,
      [rawCompany]
    );
    const companyAgentIds = idRows.map((r) => r.id);
    if (!companyAgentIds.length) return { error: 'Nessun Comm Agent registrato per questa azienda' };
    return {
      ok: true,
      user: u,
      companyKey,
      companyAgentIds,
      rawCompany,
    };
  }

  const ensureLSightTables = async () => {
    try {
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
        CREATE TABLE IF NOT EXISTS lsight_agent_config (
            agent_id INTEGER PRIMARY KEY REFERENCES comm_agents(id) ON DELETE CASCADE,
            remote_passwd VARCHAR(255),
            enabled BOOLEAN DEFAULT false,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await ensureLsightCompanyAccessTable(pool);
    } catch (e) {
      console.error('Errore migrazioni L-Sight:', e);
    }
  };

  ensureLSightTables();

  router.use(authenticateToken);

  /**
   * RDP diretto (senza tunnel): genera file .rdp verso IP/host del PC.
   * Usa inventario comm_device_info + fallback IP monitoraggio rete; richiede VPN lato tecnico.
   */
  router.get('/agents/:id/direct-rdp', async (req, res) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).send('agent_id non valido');
    try {
      const ok = await userCanAccessLsightAgent(pool, {
        viewerId: req.user.id,
        viewerRole: req.user?.ruolo,
        agentId: id,
      });
      if (!ok) return res.status(403).send('Accesso negato: PC non autorizzato per questo profilo');

      const { rows } = await pool.query(
        `SELECT ca.id AS agent_id, ca.machine_name,
                ca.ip_address AS comm_ip,
                cdi.primary_ip, cdi.ip_addresses,
                nm.monitor_ip
         FROM comm_agents ca
         LEFT JOIN comm_device_info cdi ON cdi.agent_id = ca.id
         LEFT JOIN LATERAL (
           SELECT nd.ip_address::text AS monitor_ip
           FROM network_devices nd
           JOIN network_agents na ON na.id = nd.agent_id
           WHERE na.deleted_at IS NULL
             AND na.azienda_id = ca.user_id
             AND (
               (
                 ${normalizeMacSql('nd.mac_address')} <> ''
                 AND ${normalizeMacSql('cdi.mac')} <> ''
                 AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
               )
               OR (
                 LOWER(TRIM(COALESCE(nd.hostname, ''))) <> ''
                 AND LOWER(TRIM(COALESCE(nd.hostname, ''))) IN (
                   LOWER(TRIM(COALESCE(cdi.device_name, ''))),
                   LOWER(TRIM(COALESCE(ca.machine_name, '')))
                 )
               )
             )
           ORDER BY nd.last_seen DESC NULLS LAST
           LIMIT 1
         ) nm ON TRUE
         WHERE ca.id = $1
         LIMIT 1`,
        [id]
      );
      if (!rows.length) return res.status(404).send('Agent non trovato');
      const row = rows[0];
      const host = pickRdpTargetFromRow(row);
      if (!host) {
        return res.status(422).send(
          'Indirizzo RDP non disponibile: manca IP in inventario/monitoraggio per questo PC. Apri “Dispositivi aziendali” e verifica che l’agent abbia inviato gli IP.'
        );
      }
      const port = Math.max(1, Math.min(65535, Number(process.env.LSIGHT_DIRECT_RDP_PORT || 3389)));
      const rdp = buildDirectRdpFile({ host, port });
      const safeName = String(row.machine_name || `agent-${id}`).replace(/[^\w.\-]+/g, '_').slice(0, 80);
      res.setHeader('Content-Type', 'application/x-rdp');
      res.setHeader('Content-Disposition', `attachment; filename="lsight-direct-${safeName}.rdp"`);
      return res.send(rdp);
    } catch (e) {
      console.error('lsight direct-rdp:', e);
      return res.status(500).send('Errore interno');
    }
  });

  const verifyTecnico = (req, res, next) => {
    if (req.user && req.user.ruolo === 'tecnico') {
      next();
    } else {
      res.status(403).json({ error: 'Accesso negato: solo i tecnici possono eseguire questa operazione.' });
    }
  };

  /**
   * Aziende distinte dai PC con Comm Agent (per select assegnazioni).
   */
  router.get('/admin/company-names', verifyTecnico, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT TRIM(u.azienda) AS azienda
         FROM comm_agents ca
         JOIN users u ON ca.user_id = u.id
         WHERE TRIM(COALESCE(u.azienda, '')) <> ''
         ORDER BY 1 ASC`
      );
      res.json({ success: true, companies: rows.map((r) => r.azienda) });
    } catch (err) {
      console.error('Errore company-names lsight:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /**
   * Autorizzazioni per azienda + utente (email): tutti gli agent di quell’azienda (owner).
   */
  router.get('/admin/company-agents', verifyTecnico, async (req, res) => {
    const rawAzienda = (req.query?.azienda || '').trim();
    if (!rawAzienda) return res.status(400).json({ error: 'Parametro azienda mancante' });
    try {
      const { rows } = await pool.query(
        `SELECT ca.id AS agent_id, ca.machine_name, ca.os_info,
                COALESCE(nm.monitor_status, 'offline') AS status,
                nm.monitor_last_seen AS monitor_last_seen,
                ca.status AS comm_agent_status,
                ca.last_heartbeat
         FROM comm_agents ca
         JOIN users u ON ca.user_id = u.id
         LEFT JOIN comm_device_info cdi ON cdi.agent_id = ca.id
         LEFT JOIN LATERAL (
           SELECT nd.status AS monitor_status, nd.last_seen AS monitor_last_seen
           FROM network_devices nd
           JOIN network_agents na ON na.id = nd.agent_id
           WHERE na.deleted_at IS NULL
             AND na.azienda_id = ca.user_id
             AND (
               (
                 ${normalizeMacSql('nd.mac_address')} <> ''
                 AND ${normalizeMacSql('cdi.mac')} <> ''
                 AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
               )
               OR (
                 LOWER(TRIM(COALESCE(nd.hostname, ''))) <> ''
                 AND LOWER(TRIM(COALESCE(nd.hostname, ''))) IN (
                   LOWER(TRIM(COALESCE(cdi.device_name, ''))),
                   LOWER(TRIM(COALESCE(ca.machine_name, '')))
                 )
               )
             )
           ORDER BY
             CASE
               WHEN ${normalizeMacSql('nd.mac_address')} <> ''
                 AND ${normalizeMacSql('cdi.mac')} <> ''
                 AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
               THEN 0 ELSE 1
             END,
             nd.last_seen DESC NULLS LAST
           LIMIT 1
         ) nm ON TRUE
         WHERE LOWER(TRIM(u.azienda)) = LOWER(TRIM($1))
         ORDER BY CASE WHEN COALESCE(nm.monitor_status, 'offline') = 'online' THEN 0 ELSE 1 END, ca.machine_name ASC`,
        [rawAzienda]
      );
      res.json({ success: true, agents: rows });
    } catch (err) {
      console.error('Errore company-agents:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /**
   * Stato selezione dispositivi per cliente + azienda (PC owner).
   * access_full_company = riga lsight_company_access sul companyKey canonico.
   */
  router.get('/admin/user-device-access', verifyTecnico, async (req, res) => {
    const rawEmail = (req.query?.email || '').trim();
    const rawAzienda = (req.query?.azienda || '').trim();
    if (!rawEmail || !rawAzienda) {
      return res.status(400).json({ error: 'email e azienda sono obbligatori' });
    }
    try {
      await ensureLsightCompanyAccessTable(pool);
      const resolved = await resolveClientePerAziendaLsight(rawEmail, rawAzienda);
      if (resolved.error) {
        const code = resolved.error.includes('non trovato') ? 404 : 400;
        return res.status(code).json({ error: resolved.error });
      }
      const { user: u, companyKey, companyAgentIds, rawCompany } = resolved;

      const { rows: agents } = await pool.query(
        `SELECT ca.id AS agent_id, ca.machine_name, ca.os_info,
                COALESCE(nm.monitor_status, 'offline') AS status,
                nm.monitor_last_seen AS monitor_last_seen,
                ca.status AS comm_agent_status
         FROM comm_agents ca
         JOIN users ow ON ow.id = ca.user_id
         LEFT JOIN comm_device_info cdi ON cdi.agent_id = ca.id
         LEFT JOIN LATERAL (
           SELECT nd.status AS monitor_status, nd.last_seen AS monitor_last_seen
           FROM network_devices nd
           JOIN network_agents na ON na.id = nd.agent_id
           WHERE na.deleted_at IS NULL
             AND na.azienda_id = ca.user_id
             AND (
               (
                 ${normalizeMacSql('nd.mac_address')} <> ''
                 AND ${normalizeMacSql('cdi.mac')} <> ''
                 AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
               )
               OR (
                 LOWER(TRIM(COALESCE(nd.hostname, ''))) <> ''
                 AND LOWER(TRIM(COALESCE(nd.hostname, ''))) IN (
                   LOWER(TRIM(COALESCE(cdi.device_name, ''))),
                   LOWER(TRIM(COALESCE(ca.machine_name, '')))
                 )
               )
             )
           ORDER BY
             CASE
               WHEN ${normalizeMacSql('nd.mac_address')} <> ''
                 AND ${normalizeMacSql('cdi.mac')} <> ''
                 AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
               THEN 0 ELSE 1
             END,
             nd.last_seen DESC NULLS LAST
           LIMIT 1
         ) nm ON TRUE
         WHERE LOWER(TRIM(ow.azienda)) = LOWER(TRIM($1))
         ORDER BY CASE WHEN COALESCE(nm.monitor_status, 'offline') = 'online' THEN 0 ELSE 1 END, ca.machine_name ASC`,
        [rawCompany]
      );

      const { rows: cg } = await pool.query(
        `SELECT id FROM lsight_company_access WHERE user_id = $1 AND company_azienda = $2 LIMIT 1`,
        [u.id, companyKey]
      );
      const accessFullCompany = cg.length > 0;

      let enabledAgentIds;
      if (accessFullCompany) {
        enabledAgentIds = [...companyAgentIds];
      } else {
        const { rows: laRows } = await pool.query(
          `SELECT agent_id FROM lsight_assignments
           WHERE user_id = $1 AND agent_id = ANY($2::int[])`,
          [u.id, companyAgentIds]
        );
        enabledAgentIds = laRows.map((r) => r.agent_id);
      }

      res.json({
        success: true,
        agents,
        enabled_agent_ids: enabledAgentIds,
        access_full_company: accessFullCompany,
      });
    } catch (err) {
      console.error('Errore user-device-access:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /**
   * Sincronizza accessi PC per email cliente in un'azienda: sottoinsieme selezionato (assignments),
   * oppure tutti i PC ("tutta azienda" = lsight_company_access + nessuna riga assignments necessaria).
   */
  router.post('/admin/sync-device-access', verifyTecnico, async (req, res) => {
    const rawEmail = String(req.body?.email || '').trim();
    const rawAzienda = String(req.body?.azienda || '').trim();
    const reqIdsRaw = req.body?.agent_ids;
    if (!rawEmail || !rawAzienda) return res.status(400).json({ error: 'email e azienda obbligatori' });
    if (!Array.isArray(reqIdsRaw)) return res.status(400).json({ error: 'agent_ids deve essere un array' });

    const reqIds = [...new Set(reqIdsRaw.map((v) => Number(v)).filter((n) => !Number.isNaN(n)))];
    try {
      await ensureLsightCompanyAccessTable(pool);
      const resolved = await resolveClientePerAziendaLsight(rawEmail, rawAzienda);
      if (resolved.error) {
        const code = resolved.error.includes('non trovato') ? 404 : 400;
        return res.status(code).json({ error: resolved.error });
      }
      const { user: u, companyKey, companyAgentIds } = resolved;

      if (!reqIds.every((id) => companyAgentIds.includes(id))) {
        return res.status(400).json({ error: 'Uno o più dispositivi non appartengono all’azienda scelta.' });
      }

      const allSelected =
        companyAgentIds.length > 0 &&
        reqIds.length === companyAgentIds.length &&
        companyAgentIds.every((id) => reqIds.includes(id));

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `DELETE FROM lsight_company_access WHERE user_id = $1 AND company_azienda = $2`,
          [u.id, companyKey]
        );
        await client.query(
          `DELETE FROM lsight_assignments WHERE user_id = $1 AND agent_id = ANY($2::int[])`,
          [u.id, companyAgentIds.length ? companyAgentIds : [-1]]
        );

        if (reqIds.length === 0) {
          await client.query('COMMIT');
          return res.json({ success: true, message: 'Accessi rimossi per questa combinazione cliente/azienda' });
        }

        if (allSelected) {
          await client.query(
            `INSERT INTO lsight_company_access (user_id, company_azienda, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, company_azienda) DO NOTHING`,
            [u.id, companyKey, req.user.id]
          );
        } else {
          for (const aid of reqIds) {
            await client.query(
              `INSERT INTO lsight_assignments (user_id, agent_id, assigned_by)
               SELECT $1, $2, $3
               WHERE NOT EXISTS (SELECT 1 FROM lsight_assignments WHERE user_id = $1 AND agent_id = $2)`,
              [u.id, aid, req.user.id]
            );
          }
        }

        await client.query('COMMIT');
        res.json({
          success: true,
          message: allSelected
            ? 'Autorizzata l’azienda intera · tutti i PC'
            : `Salvati ${reqIds.length} dispositivi per questo cliente`,
        });
      } catch (inner) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        throw inner;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Errore sync-device-access:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /**
   * Revoca tutto (grant aziendale + assignments) per email +azienda proprietario PC.
   */
  router.delete('/admin/user-company-access', verifyTecnico, async (req, res) => {
    const rawEmail = (req.query?.email || '').trim();
    const rawAzienda = (req.query?.azienda || '').trim();
    if (!rawEmail || !rawAzienda) {
      return res.status(400).json({ error: 'email e azienda obbligatorie' });
    }
    try {
      await ensureLsightCompanyAccessTable(pool);
      const resolved = await resolveClientePerAziendaLsight(rawEmail, rawAzienda);
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      const { user: u, companyKey, companyAgentIds } = resolved;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM lsight_company_access WHERE user_id = $1 AND company_azienda = $2`, [
          u.id,
          companyKey,
        ]);
        await client.query(
          `DELETE FROM lsight_assignments WHERE user_id = $1 AND agent_id = ANY($2::int[])`,
          [u.id, companyAgentIds.length ? companyAgentIds : [-1]]
        );
        await client.query('COMMIT');
        res.json({ success: true });
      } catch (inner) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        throw inner;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Errore DELETE user-company-access:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /** Riepilogo tecnico: accesso tutta azienda vs dispositivi singoli aggregati */
  router.get('/admin/access-summary', verifyTecnico, async (_req, res) => {
    try {
      await ensureLsightCompanyAccessTable(pool);

      const { rows: fullRows } = await pool.query(
        `SELECT g.id AS grant_id, g.user_id, g.company_azienda AS company_key, g.created_at,
                u.email, u.nome, u.cognome
         FROM lsight_company_access g
         JOIN users u ON u.id = g.user_id
         ORDER BY g.created_at DESC`
      );

      const partialQ = `
        SELECT la.user_id, u.email, u.nome, u.cognome,
               LOWER(TRIM(ow.azienda)) AS company_key_low,
               MAX(TRIM(ow.azienda)) AS company_label,
               COUNT(DISTINCT la.agent_id)::int AS n_devices
        FROM lsight_assignments la
        JOIN comm_agents ca ON ca.id = la.agent_id
        JOIN users ow ON ow.id = ca.user_id
        JOIN users u ON u.id = la.user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM lsight_company_access g2
          WHERE g2.user_id = la.user_id
            AND LOWER(TRIM(g2.company_azienda)) = LOWER(TRIM(ow.azienda))
        )
        GROUP BY la.user_id, u.email, u.nome, u.cognome, LOWER(TRIM(ow.azienda))
        ORDER BY u.cognome, u.nome, company_label
      `;
      const { rows: partialRows } = await pool.query(partialQ);

      res.json({
        success: true,
        full_company: fullRows.map((r) => ({
          kind: 'full_company',
          grant_id: r.grant_id,
          user_id: r.user_id,
          email: r.email,
          nome: r.nome,
          cognome: r.cognome,
          company_key: r.company_key,
        })),
        selected_only: partialRows.map((r) => ({
          kind: 'selected_devices',
          user_id: r.user_id,
          email: r.email,
          nome: r.nome,
          cognome: r.cognome,
          company_key_low: r.company_key_low,
          company_label: r.company_label,
          n_devices: r.n_devices,
        })),
      });
    } catch (err) {
      console.error('Errore access-summary:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.get('/admin/access-grants', verifyTecnico, async (_req, res) => {
    try {
      await ensureLsightCompanyAccessTable(pool);
      const { rows } = await pool.query(
        `SELECT g.id, g.user_id, g.company_azienda, g.created_at,
                u.email, u.nome, u.cognome, u.azienda AS user_azienda
         FROM lsight_company_access g
         JOIN users u ON g.user_id = u.id
         ORDER BY g.created_at DESC`
      );
      res.json({ success: true, grants: rows });
    } catch (err) {
      console.error('Errore access-grants:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /** Legacy: equivale a “tutta l’azienda” · rimuove le righe puntuali sulla stessa azienda */
  router.post('/admin/access-grants', verifyTecnico, async (req, res) => {
    const rawEmail = (req.body?.email || '').trim();
    const rawAzienda = (req.body?.azienda || '').trim();
    if (!rawEmail || !rawAzienda) {
      return res.status(400).json({ error: 'email e azienda sono obbligatori' });
    }
    try {
      await ensureLsightCompanyAccessTable(pool);
      const resolved = await resolveClientePerAziendaLsight(rawEmail, rawAzienda);
      if (resolved.error) {
        const code = resolved.error.includes('non trovato') ? 404 : 400;
        return res.status(code).json({ error: resolved.error });
      }
      const { user: u, companyKey, companyAgentIds } = resolved;

      await pool.query(
        `DELETE FROM lsight_assignments WHERE user_id = $1 AND agent_id = ANY($2::int[])`,
        [u.id, companyAgentIds]
      );
      await pool.query(
        `INSERT INTO lsight_company_access (user_id, company_azienda, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, company_azienda) DO NOTHING`,
        [u.id, companyKey, req.user.id]
      );
      res.json({ success: true, message: 'Autorizzazione salvata (tutti i PC dell’azienda per questo cliente)' });
    } catch (err) {
      console.error('Errore POST access-grants:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.delete('/admin/access-grants/:id', verifyTecnico, async (req, res) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
    try {
      await pool.query(`DELETE FROM lsight_company_access WHERE id = $1 RETURNING id`, [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Errore DELETE access-grants:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /** Lista legacy assignment per troubleshooting (compatibilità DB). */
  router.get('/admin/assignments', verifyTecnico, async (_req, res) => {
    try {
      const query = `
          SELECT ca.id as agent_id, ca.machine_name, ca.os_info, ca.status,
                 u.id as user_id, u.nome, u.cognome, u.email, u.azienda,
                 la.id as assignment_id
          FROM comm_agents ca
          LEFT JOIN lsight_assignments la ON ca.id = la.agent_id
          LEFT JOIN users u ON la.user_id = u.id
          ORDER BY ca.machine_name, u.azienda
      `;
      const { rows } = await pool.query(query);
      res.json({ success: true, assignments: rows });
    } catch (err) {
      console.error('Errore fetch assignments:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.post('/admin/assignments', verifyTecnico, async (req, res) => {
    const { user_id, agent_id } = req.body;
    if (!user_id || !agent_id) return res.status(400).json({ error: 'user_id e agent_id richiesti' });
    try {
      await pool.query(
        `INSERT INTO lsight_assignments (user_id, agent_id, assigned_by)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM lsight_assignments WHERE user_id = $1 AND agent_id = $2
         )`,
        [user_id, agent_id, req.user.id]
      );
      res.json({ success: true, message: 'Assegnazione creata' });
    } catch (err) {
      console.error('Errore creazione assignment:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.delete('/admin/assignments', verifyTecnico, async (req, res) => {
    const { user_id, agent_id } = req.query;
    if (!user_id || !agent_id) return res.status(400).json({ error: 'user_id e agent_id richiesti' });
    try {
      await pool.query(`DELETE FROM lsight_assignments WHERE user_id = $1 AND agent_id = $2`, [
        user_id,
        agent_id,
      ]);
      res.json({ success: true, message: 'Assegnazione rimossa' });
    } catch (err) {
      console.error('Errore rimozione assignment:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.get('/my-agents', async (req, res) => {
    try {
      let query;
      const params = [];

      if (req.user.ruolo === 'tecnico' || req.user.ruolo === 'admin') {
        query = `
            SELECT ca.id as agent_id, ca.machine_name, ca.os_info,
                   ca.ip_address AS comm_ip,
                   cdi.primary_ip, cdi.ip_addresses,
                   nm.monitor_ip,
                   COALESCE(nm.monitor_status, 'offline') AS status,
                   nm.monitor_last_seen AS monitor_last_seen,
                   ca.status AS comm_agent_status,
                   ca.last_heartbeat,
                   owner.azienda,
                   owner.nome as user_nome, owner.cognome as user_cognome,
                   lc.enabled, lc.remote_passwd
            FROM comm_agents ca
            LEFT JOIN users owner ON ca.user_id = owner.id
            LEFT JOIN lsight_agent_config lc ON ca.id = lc.agent_id
            LEFT JOIN comm_device_info cdi ON cdi.agent_id = ca.id
            LEFT JOIN LATERAL (
              SELECT nd.status AS monitor_status, nd.last_seen AS monitor_last_seen,
                     nd.ip_address::text AS monitor_ip
              FROM network_devices nd
              JOIN network_agents na ON na.id = nd.agent_id
              WHERE na.deleted_at IS NULL
                AND na.azienda_id = ca.user_id
                AND (
                  (
                    ${normalizeMacSql('nd.mac_address')} <> ''
                    AND ${normalizeMacSql('cdi.mac')} <> ''
                    AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
                  )
                  OR (
                    LOWER(TRIM(COALESCE(nd.hostname, ''))) <> ''
                    AND LOWER(TRIM(COALESCE(nd.hostname, ''))) IN (
                      LOWER(TRIM(COALESCE(cdi.device_name, ''))),
                      LOWER(TRIM(COALESCE(ca.machine_name, '')))
                    )
                  )
                )
              ORDER BY
                CASE
                  WHEN ${normalizeMacSql('nd.mac_address')} <> ''
                    AND ${normalizeMacSql('cdi.mac')} <> ''
                    AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
                  THEN 0 ELSE 1
                END,
                nd.last_seen DESC NULLS LAST
              LIMIT 1
            ) nm ON TRUE
            ORDER BY owner.azienda NULLS LAST, ca.machine_name
        `;
      } else {
        await ensureLsightCompanyAccessTable(pool);
        params.push(req.user.id);
        query = `
            SELECT ca.id as agent_id, ca.machine_name, ca.os_info,
                   ca.ip_address AS comm_ip,
                   cdi.primary_ip, cdi.ip_addresses,
                   nm.monitor_ip,
                   COALESCE(nm.monitor_status, 'offline') AS status,
                   nm.monitor_last_seen AS monitor_last_seen,
                   ca.status AS comm_agent_status,
                   ca.last_heartbeat,
                   owner.azienda,
                   owner.nome as user_nome, owner.cognome as user_cognome,
                   lc.enabled, lc.remote_passwd
            FROM comm_agents ca
            LEFT JOIN users owner ON ca.user_id = owner.id
            LEFT JOIN lsight_agent_config lc ON ca.id = lc.agent_id
            LEFT JOIN comm_device_info cdi ON cdi.agent_id = ca.id
            LEFT JOIN LATERAL (
              SELECT nd.status AS monitor_status, nd.last_seen AS monitor_last_seen,
                     nd.ip_address::text AS monitor_ip
              FROM network_devices nd
              JOIN network_agents na ON na.id = nd.agent_id
              WHERE na.deleted_at IS NULL
                AND na.azienda_id = ca.user_id
                AND (
                  (
                    ${normalizeMacSql('nd.mac_address')} <> ''
                    AND ${normalizeMacSql('cdi.mac')} <> ''
                    AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
                  )
                  OR (
                    LOWER(TRIM(COALESCE(nd.hostname, ''))) <> ''
                    AND LOWER(TRIM(COALESCE(nd.hostname, ''))) IN (
                      LOWER(TRIM(COALESCE(cdi.device_name, ''))),
                      LOWER(TRIM(COALESCE(ca.machine_name, '')))
                    )
                  )
                )
              ORDER BY
                CASE
                  WHEN ${normalizeMacSql('nd.mac_address')} <> ''
                    AND ${normalizeMacSql('cdi.mac')} <> ''
                    AND ${normalizeMacSql('nd.mac_address')} = ${normalizeMacSql('cdi.mac')}
                  THEN 0 ELSE 1
                END,
                nd.last_seen DESC NULLS LAST
              LIMIT 1
            ) nm ON TRUE
            WHERE EXISTS (
               SELECT 1 FROM lsight_assignments la
               WHERE la.user_id = $1 AND la.agent_id = ca.id
            )
            OR EXISTS (
               SELECT 1 FROM lsight_company_access g
               WHERE g.user_id = $1
                 AND owner.azienda IS NOT NULL AND TRIM(owner.azienda) <> ''
                 AND LOWER(TRIM(g.company_azienda)) = LOWER(TRIM(owner.azienda))
            )
            ORDER BY owner.azienda NULLS LAST, ca.machine_name
        `;
      }

      const { rows } = await pool.query(query, params);
      res.json({ success: true, agents: rows });
    } catch (err) {
      console.error('Errore fetch my-agents:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  return router;
};
