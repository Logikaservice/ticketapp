// Snippet da inserire in networkMonitoring.js dopo l'endpoint /all/changes (riga 2359)

// GET /api/network-monitoring/all/events
// Ottieni tutti gli eventi unificati (dispositivi + agent) con filtri avanzati
router.get('/all/events', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
        await ensureTables();

        const limit = parseInt(req.query.limit) || 200;
        const searchTerm = req.query.search ? req.query.search.trim() : '';
        const aziendaId = req.query.azienda_id ? parseInt(req.query.azienda_id) : null;
        const eventType = req.query.event_type || ''; // all, device, agent
        const severity = req.query.severity || ''; // all, critical, warning, info
        const count24h = req.query.count24h === 'true';

        // Query per eventi dispositivi (network_changes)
        const deviceEventsQuery = `
        SELECT 
          'device' as event_category,
          nc.id,
          nc.change_type as event_type,
          nc.detected_at,
          nd.ip_address,
          nd.mac_address,
          nd.hostname,
          nd.vendor,
          nd.device_type,
          nd.device_path,
          nd.device_username,
          nd.is_static,
          nd.device_type as keepass_title,
          nd.device_username as keepass_username,
          nc.old_value,
          nc.new_value,
          na.agent_name,
          na.azienda_id,
          u.azienda,
          CASE 
            WHEN nc.change_type = 'new_device' THEN 'info'
            WHEN nc.change_type IN ('device_offline', 'mac_changed', 'ip_changed') THEN 'warning'
            WHEN nc.change_type = 'device_online' THEN 'info'
            ELSE 'info'
          END as severity,
          CASE
            WHEN nc.change_type = 'new_device' THEN true
            ELSE false
          END as is_new_device
        FROM network_changes nc
        INNER JOIN network_devices nd ON nc.device_id = nd.id
        INNER JOIN network_agents na ON nc.agent_id = na.id
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE 1=1
      `;

        // Query per eventi agent (network_agent_events)
        const agentEventsQuery = `
        SELECT 
          'agent' as event_category,
          nae.id,
          nae.event_type,
          nae.detected_at,
          NULL as ip_address,
          NULL as mac_address,
          NULL as hostname,
          NULL as vendor,
          NULL as device_type,
          NULL as device_path,
          NULL as device_username,
          false as is_static,
          NULL as keepass_title,
          NULL as keepass_username,
          NULL as old_value,
          NULL as new_value,
          na.agent_name,
          na.azienda_id,
          u.azienda,
          CASE 
            WHEN nae.event_type = 'offline' THEN 'critical'
            WHEN nae.event_type = 'online' THEN 'info'
            WHEN nae.event_type = 'reboot' THEN 'warning'
            WHEN nae.event_type = 'network_issue' THEN 'warning'
            ELSE 'info'
          END as severity,
          false as is_new_device
        FROM network_agent_events nae
        INNER JOIN network_agents na ON nae.agent_id = na.id
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE na.deleted_at IS NULL
      `;

        // Costruisci filtri
        let deviceFilters = '';
        let agentFilters = '';
        const params = [];
        let paramIndex = 1;

        // Filtro azienda
        if (aziendaId) {
            deviceFilters += ` AND na.azienda_id = $${paramIndex}`;
            agentFilters += ` AND na.azienda_id = $${paramIndex}`;
            params.push(aziendaId);
            paramIndex++;
        }

        // Filtro ricerca
        if (searchTerm) {
            const searchPattern = `%${searchTerm}%`;
            deviceFilters += ` AND (
          nd.ip_address::text ILIKE $${paramIndex} OR
          nd.mac_address ILIKE $${paramIndex} OR
          nd.hostname ILIKE $${paramIndex} OR
          nc.change_type::text ILIKE $${paramIndex} OR
          na.agent_name ILIKE $${paramIndex} OR
          COALESCE(u.azienda, '') ILIKE $${paramIndex}
        )`;
            agentFilters += ` AND (
          nae.event_type::text ILIKE $${paramIndex} OR
          na.agent_name ILIKE $${paramIndex} OR
          COALESCE(u.azienda, '') ILIKE $${paramIndex}
        )`;
            params.push(searchPattern);
            paramIndex++;
        }

        // Query unificata
        let unifiedQuery = '';

        if (eventType === 'device') {
            unifiedQuery = deviceEventsQuery + deviceFilters;
        } else if (eventType === 'agent') {
            unifiedQuery = agentEventsQuery + agentFilters;
        } else {
            // Unisci entrambi
            unifiedQuery = `
          (${deviceEventsQuery}${deviceFilters})
          UNION ALL
          (${agentEventsQuery}${agentFilters})
        `;
        }

        // Aggiungi filtro severity se specificato
        if (severity && severity !== 'all') {
            unifiedQuery = `
          SELECT * FROM (${unifiedQuery}) as events
          WHERE severity = '${severity}'
        `;
        }

        // Ordina e limita
        unifiedQuery = `
        SELECT * FROM (${unifiedQuery}) as all_events
        ORDER BY detected_at DESC
        LIMIT $${paramIndex}
      `;
        params.push(limit);

        // Esegui query
        const result = await pool.query(unifiedQuery, params);

        // Conta eventi ultime 24h se richiesto
        let count24hResult = null;
        if (count24h) {
            try {
                const count24hQuery = `
            SELECT COUNT(*) as count FROM (
              (${deviceEventsQuery}${deviceFilters} AND nc.detected_at >= NOW() - INTERVAL '24 hours')
              UNION ALL
              (${agentEventsQuery}${agentFilters} AND nae.detected_at >= NOW() - INTERVAL '24 hours')
            ) as recent_events
          `;
                const countResult = await pool.query(count24hQuery, params.slice(0, -1)); // Rimuovi limit
                count24hResult = parseInt(countResult.rows[0].count, 10);
            } catch (countErr) {
                console.warn('⚠️ Errore conteggio 24h eventi unificati:', countErr.message);
            }
        }

        // Restituisci risultati
        if (count24hResult !== null) {
            res.json({ events: result.rows, count24h: count24hResult });
        } else {
            res.json(result.rows);
        }
    } catch (err) {
        console.error('❌ Errore recupero eventi unificati:', err);
        res.status(500).json({ error: 'Errore interno del server', details: err.message });
    }
});
