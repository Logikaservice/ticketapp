// routes/userPreferences.js

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');

function normalizeSurfaceMode(v) {
  return v === 'light' ? 'light' : 'dark';
}

function normalizeAccentHex(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  return `#${m[1].toLowerCase()}`;
}

module.exports = (pool) => {
  const router = express.Router();

  // Proteggi esplicitamente anche se montata sotto /api con auth
  router.use(authenticateToken);

  /**
   * GET /api/user-preferences/tech-hub
   * Ritorna preferenze salvate per l'utente loggato.
   */
  router.get('/tech-hub', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Utente non autenticato' });

    try {
      const { rows } = await pool.query(
        `SELECT tech_hub_accent, tech_hub_surface, tech_hub_layout
         FROM user_preferences
         WHERE user_id = $1`,
        [userId]
      );
      if (!rows || rows.length === 0) {
        return res.json({
          accentHex: null,
          surfaceMode: null,
          layout: null
        });
      }

      const r = rows[0];
      return res.json({
        accentHex: r.tech_hub_accent || null,
        surfaceMode: r.tech_hub_surface || null,
        layout: r.tech_hub_layout || null
      });
    } catch (err) {
      console.error('❌ Errore GET user preferences tech-hub:', err);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  /**
   * PUT /api/user-preferences/tech-hub
   * Body: { accentHex?, surfaceMode?, layout? }
   * Salva preferenze Tech Hub (tema + layout) per l'utente loggato.
   */
  router.put('/tech-hub', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Utente non autenticato' });

    const accentHex = req.body?.accentHex !== undefined ? normalizeAccentHex(req.body.accentHex) : undefined;
    const surfaceMode = req.body?.surfaceMode !== undefined ? normalizeSurfaceMode(req.body.surfaceMode) : undefined;
    const layout = req.body?.layout !== undefined ? req.body.layout : undefined;

    // Se il client manda accentHex non valido, rifiuta (evita corruzione dati)
    if (accentHex === null) {
      return res.status(400).json({ error: 'accentHex non valido (usa #RRGGBB)' });
    }

    // layout: deve essere array (items) oppure null
    if (layout !== undefined && layout !== null && !Array.isArray(layout)) {
      return res.status(400).json({ error: 'layout non valido (atteso array o null)' });
    }

    try {
      // Merge: salva solo i campi presenti, mantenendo gli altri.
      const { rows } = await pool.query(
        `INSERT INTO user_preferences (user_id, tech_hub_accent, tech_hub_surface, tech_hub_layout, updated_at)
         VALUES (
           $1,
           COALESCE($2, (SELECT tech_hub_accent FROM user_preferences WHERE user_id = $1)),
           COALESCE($3, (SELECT tech_hub_surface FROM user_preferences WHERE user_id = $1)),
           CASE
             WHEN $4::jsonb IS NULL THEN (SELECT tech_hub_layout FROM user_preferences WHERE user_id = $1)
             ELSE $4::jsonb
           END,
           NOW()
         )
         ON CONFLICT (user_id) DO UPDATE SET
           tech_hub_accent = COALESCE(EXCLUDED.tech_hub_accent, user_preferences.tech_hub_accent),
           tech_hub_surface = COALESCE(EXCLUDED.tech_hub_surface, user_preferences.tech_hub_surface),
           tech_hub_layout = COALESCE(EXCLUDED.tech_hub_layout, user_preferences.tech_hub_layout),
           updated_at = NOW()
         RETURNING tech_hub_accent, tech_hub_surface, tech_hub_layout`,
        [
          userId,
          accentHex === undefined ? null : accentHex,
          surfaceMode === undefined ? null : surfaceMode,
          layout === undefined ? null : JSON.stringify(layout)
        ]
      );

      const r = rows?.[0] || {};
      return res.json({
        success: true,
        accentHex: r.tech_hub_accent || null,
        surfaceMode: r.tech_hub_surface || null,
        layout: r.tech_hub_layout || null
      });
    } catch (err) {
      console.error('❌ Errore PUT user preferences tech-hub:', err);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};

