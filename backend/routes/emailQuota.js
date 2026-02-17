/**
 * Email Quota Routes - Monitoraggio spazio caselle email via IMAP QUOTA
 * 
 * Scansione automatica ogni 24 ore a mezzanotte (00:00) + scansione manuale on-demand.
 * Per ora limitata a Logika Service come test.
 */

const express = require('express');
const { ImapFlow } = require('imapflow');
const keepassDriveService = require('../utils/keepassDriveService');

module.exports = function (pool, authenticateToken, requireRole) {
    const router = express.Router();

    // ============================================================
    // Tabella per salvare i risultati delle scansioni
    // ============================================================
    const ensureQuotaTable = async () => {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS email_quota_results (
        id SERIAL PRIMARY KEY,
        azienda_name VARCHAR(255) NOT NULL,
        email VARCHAR(500) NOT NULL,
        imap_server VARCHAR(255) NOT NULL,
        usage_bytes BIGINT DEFAULT 0,
        limit_bytes BIGINT DEFAULT 0,
        usage_percent NUMERIC(5,2) DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'ok',
        error_message TEXT,
        last_scan TIMESTAMPTZ DEFAULT NOW(),
        last_email_date TIMESTAMPTZ,
        UNIQUE(azienda_name, email)
      )
    `);
        // Migrazione: aggiungi last_email_date se manca
        try {
            await pool.query(`
        DO $$ 
        BEGIN 
          BEGIN
            ALTER TABLE email_quota_results ADD COLUMN last_email_date TIMESTAMPTZ;
          EXCEPTION
            WHEN duplicate_column THEN RAISE NOTICE 'column last_email_date already exists in email_quota_results.';
          END;
        END $$;
      `);
        } catch (mErr) {
            console.warn('⚠️ Migrazione last_email_date fallita (potrebbe esistere già):', mErr.message);
        }
    };
    ensureQuotaTable().catch(err => console.warn('⚠️ Errore creazione tabella email_quota_results:', err.message));

    // ============================================================
    // Helper: Determina server IMAP dal dominio email
    // ============================================================
    const getImapServer = (email) => {
        const domain = (email || '').split('@')[1]?.toLowerCase();
        if (!domain) return null;

        // Mappature note
        const serverMap = {
            'gmail.com': 'imap.gmail.com',
            'googlemail.com': 'imap.gmail.com',
            'outlook.com': 'outlook.office365.com',
            'hotmail.com': 'outlook.office365.com',
            'live.com': 'outlook.office365.com',
            'yahoo.com': 'imap.mail.yahoo.com',
            'yahoo.it': 'imap.mail.yahoo.com',
            'icloud.com': 'imap.mail.me.com',
            'pec.it': 'imaps.pec.aruba.it',
            'arubapec.it': 'imaps.pec.aruba.it',
            'legalmail.it': 'mail.legalmail.it',
        };

        if (serverMap[domain]) return serverMap[domain];

        // PEC italiane
        if (domain.endsWith('.pec.it') || domain.includes('pec')) {
            return 'imaps.pec.aruba.it';
        }

        // Default: assume Aruba per domini italiani personalizzati
        return 'imaps.aruba.it';
    };

    // ============================================================
    // Helper: Controlla quota di una singola casella
    // ============================================================
    const checkSingleQuota = async (email, password, imapServer) => {
        const client = new ImapFlow({
            host: imapServer,
            port: 993,
            secure: true,
            auth: { user: email, pass: password },
            logger: false,
            greetingTimeout: 3000,
            socketTimeout: 5000, // Timeout ridotti per velocizzare scansione
        });

        try {
            await client.connect();
            await client.mailboxOpen('INBOX');

            let usageBytes = 0;
            let limitBytes = 0;
            let messageCount = 0;

            // Prova getQuota (metodo supportato da imapflow)
            try {
                const quota = await client.getQuota('INBOX');
                if (quota && quota.storage) {
                    usageBytes = (quota.storage.usage || 0) * 1; // già in bytes da Aruba
                    limitBytes = (quota.storage.limit || 0) * 1;
                }
                if (quota && quota.messages) {
                    messageCount = quota.messages.usage || 0;
                }
            } catch (qErr) {
                // Fallback: prova senza path
                try {
                    const quota = await client.getQuota('');
                    if (quota && quota.storage) {
                        usageBytes = (quota.storage.usage || 0) * 1;
                        limitBytes = (quota.storage.limit || 0) * 1;
                    }
                } catch (q2Err) {
                    throw new Error('QUOTA non supportato: ' + q2Err.message);
                }
            }

            // Recupera data ultimo messaggio (MIGLIORATO: metodo più affidabile)
            let lastEmailDate = null;
            
            // Metodo principale: fetchOne('*') restituisce sempre l'ultimo messaggio per sequenza
            // Questo è il metodo più affidabile per Aruba IMAP
            if (messageCount > 0) {
                try {
                    const message = await client.fetchOne('*', { envelope: true });
                    if (message && message.envelope && message.envelope.date) {
                        lastEmailDate = message.envelope.date;
                        console.log(`   ✅ [EmailQuota] last_email_date recuperato per ${email}: ${lastEmailDate}`);
                    }
                } catch (fetchErr) {
                    console.warn(`   ⚠️ [EmailQuota] Errore fetchOne('*') per ${email}:`, fetchErr.message);
                    
                    // Fallback: prova con search se fetchOne fallisce
                    try {
                        const twoYearsAgo = new Date();
                        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                        const searchResult = await client.search({ since: twoYearsAgo }, { uid: true });
                        
                        if (searchResult && searchResult.length > 0) {
                            // Prendi l'ultimo UID dalla lista (più recente)
                            const lastUid = searchResult[searchResult.length - 1];
                            const message = await client.fetchOne(lastUid, { envelope: true });
                            if (message && message.envelope && message.envelope.date) {
                                lastEmailDate = message.envelope.date;
                                console.log(`   ✅ [EmailQuota] last_email_date recuperato via search per ${email}: ${lastEmailDate}`);
                            }
                        }
                    } catch (searchErr) {
                        console.warn(`   ⚠️ [EmailQuota] Fallback search fallito per ${email}:`, searchErr.message);
                    }
                }
            } else {
                // Nessun messaggio nella casella
                console.log(`   ℹ️ [EmailQuota] Nessun messaggio per ${email}, last_email_date = null`);
            }

            // Calcola percentuale
            const usagePercent = limitBytes > 0 ? (usageBytes / limitBytes * 100) : 0;

            await client.logout();

            return {
                success: true,
                usage_bytes: usageBytes,
                limit_bytes: limitBytes,
                usage_percent: Math.round(usagePercent * 100) / 100,
                message_count: messageCount,
                last_email_date: lastEmailDate,
                status: usagePercent > 90 ? 'critical' : usagePercent > 70 ? 'warning' : 'ok'
            };
        } catch (err) {
            try { client.close(); } catch { }
            return {
                success: false,
                usage_bytes: 0,
                limit_bytes: 0,
                usage_percent: 0,
                message_count: 0,
                last_email_date: null,
                status: 'error',
                error_message: err.message
            };
        }
    };

    // ============================================================
    // Scansione di tutte le caselle di un'azienda
    // ============================================================
    const scanCompanyEmails = async (aziendaName) => {
        const keepassPassword = process.env.KEEPASS_PASSWORD;
        if (!keepassPassword) throw new Error('KEEPASS_PASSWORD non configurata');

        console.log(`\n📧 [EmailQuota] Inizio scansione per "${aziendaName}"...`);

        // 1. Ottieni le entry email da KeePass
        let emailStructure;
        try {
            emailStructure = await keepassDriveService.getEmailStructureByAzienda(keepassPassword, aziendaName);
        } catch (err) {
            console.error(`❌ [EmailQuota] Errore lettura KeePass per "${aziendaName}":`, err.message);
            throw err;
        }

        if (!emailStructure || emailStructure.length === 0) {
            console.warn(`⚠️ [EmailQuota] Nessuna entry email trovata per "${aziendaName}"`);
            return { scanned: 0, results: [] };
        }

        // 2. Filtra solo le entry con username che sembrano email (contengono @)
        const emailEntries = emailStructure.filter(item =>
            item.type !== 'divider' &&
            item.username &&
            item.username.includes('@')
        );

        console.log(`📋 [EmailQuota] Trovate ${emailEntries.length} caselle email per "${aziendaName}"`);

        // 3. Per ogni casella, recupera la password e controlla la quota
        // OTTIMIZZAZIONE: Processa tutte le email in parallelo (non più batch)
        // Node.js gestisce bene il parallelismo async, e IMAP è I/O bound
        const results = await Promise.all(emailEntries.map(async (entry) => {
            try {
                const email = entry.username.trim();
                const imapServer = getImapServer(email);

                if (!imapServer) {
                    return { email, status: 'error', error_message: 'Impossibile determinare server IMAP' };
                }

                // Recupera la password dalla KeePass
                let password;
                try {
                    password = await keepassDriveService.getEmailEntryPassword(keepassPassword, aziendaName, {
                        title: entry.title || '',
                        username: email,
                        url: entry.url || '',
                        divider: entry.divider || ''
                    });
                } catch (pwErr) {
                    return { email, imap_server: imapServer, status: 'error', error_message: 'Password non recuperabile: ' + pwErr.message };
                }

                if (!password) {
                    return { email, imap_server: imapServer, status: 'error', error_message: 'Password non trovata in KeePass' };
                }

                // Controlla la quota
                console.log(`   🔍 Controllo ${email} su ${imapServer}...`);
                const result = await checkSingleQuota(email, password, imapServer);
                return { email, imap_server: imapServer, ...result };
            } catch (err) {
                // Gestione errore per singola email
                console.error(`   ❌ Errore controllo ${entry.username}:`, err.message);
                return { 
                    email: entry.username?.trim() || 'unknown', 
                    imap_server: getImapServer(entry.username?.trim() || '') || '', 
                    status: 'error', 
                    error_message: err.message 
                };
            }
        }));

        // 4. Salva i risultati nel DB
        await ensureQuotaTable();
        for (const result of results) {
            try {
                await pool.query(`
          INSERT INTO email_quota_results (azienda_name, email, imap_server, usage_bytes, limit_bytes, usage_percent, message_count, last_email_date, status, error_message, last_scan)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (azienda_name, email) DO UPDATE SET
            imap_server = EXCLUDED.imap_server,
            usage_bytes = EXCLUDED.usage_bytes,
            limit_bytes = EXCLUDED.limit_bytes,
            usage_percent = EXCLUDED.usage_percent,
            message_count = EXCLUDED.message_count,
            last_email_date = EXCLUDED.last_email_date,
            status = EXCLUDED.status,
            error_message = EXCLUDED.error_message,
            last_scan = NOW()
        `, [
                    aziendaName,
                    result.email,
                    result.imap_server || '',
                    result.usage_bytes || 0,
                    result.limit_bytes || 0,
                    result.usage_percent || 0,
                    result.message_count || 0,
                    result.last_email_date || null,
                    result.status || 'error',
                    result.error_message || null
                ]);
            } catch (dbErr) {
                console.error(`❌ [EmailQuota] Errore salvataggio DB per ${result.email}:`, dbErr.message);
            }
        }

        const okCount = results.filter(r => r.status !== 'error').length;
        const errCount = results.filter(r => r.status === 'error').length;
        console.log(`✅ [EmailQuota] Scansione "${aziendaName}" completata: ${okCount} OK, ${errCount} errori`);

        return { scanned: results.length, ok: okCount, errors: errCount, results };
    };

    // ============================================================
    // ROUTES
    // ============================================================

    // GET /api/email-quota/results/:aziendaName - Ottieni risultati ultima scansione
    router.get('/results/:aziendaName', authenticateToken, async (req, res) => {
        try {
            let { aziendaName } = req.params;
            try { aziendaName = decodeURIComponent(aziendaName); } catch { }
            aziendaName = aziendaName.split(':')[0].trim();

            await ensureQuotaTable();
            const result = await pool.query(
                `SELECT email, imap_server, usage_bytes, limit_bytes, usage_percent, message_count, last_email_date, status, error_message, last_scan
         FROM email_quota_results 
         WHERE azienda_name = $1
         ORDER BY usage_percent DESC`,
                [aziendaName]
            );

            res.json({
                azienda: aziendaName,
                results: result.rows,
                count: result.rows.length
            });
        } catch (err) {
            console.error('❌ Errore GET email-quota results:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/email-quota/scan/:aziendaName - Scansione manuale on-demand
    router.post('/scan/:aziendaName', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            let { aziendaName } = req.params;
            try { aziendaName = decodeURIComponent(aziendaName); } catch { }
            aziendaName = aziendaName.split(':')[0].trim();

            // Risposta immediata, scansione in background
            res.json({ message: `Scansione avviata per "${aziendaName}"`, scanning: true });

            // Esegui in background
            scanCompanyEmails(aziendaName).catch(err => {
                console.error(`❌ [EmailQuota] Errore scansione "${aziendaName}":`, err.message);
            });
        } catch (err) {
            console.error('❌ Errore POST email-quota scan:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/email-quota/scan-status/:aziendaName - Controlla se la scansione è completata
    router.get('/scan-status/:aziendaName', authenticateToken, async (req, res) => {
        try {
            let { aziendaName } = req.params;
            try { aziendaName = decodeURIComponent(aziendaName); } catch { }
            aziendaName = aziendaName.split(':')[0].trim();

            await ensureQuotaTable();
            const result = await pool.query(
                `SELECT MAX(last_scan) as last_scan, COUNT(*) as count 
         FROM email_quota_results 
         WHERE azienda_name = $1`,
                [aziendaName]
            );

            res.json({
                last_scan: result.rows[0]?.last_scan || null,
                count: parseInt(result.rows[0]?.count || 0)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ============================================================
    // SCHEDULER: Scansione automatica ogni 24 ore a mezzanotte
    // ============================================================
    const scheduleAutoScan = () => {
        const SCAN_COMPANIES = ['Logika Service']; // Per ora solo Logika Service

        const runScheduledScan = async () => {
            console.log(`\n⏰ [EmailQuota] Scansione schedulata avviata alle ${new Date().toLocaleString('it-IT')}`);
            for (const company of SCAN_COMPANIES) {
                try {
                    await scanCompanyEmails(company);
                } catch (err) {
                    console.error(`❌ [EmailQuota] Errore scansione schedulata "${company}":`, err.message);
                }
            }
            console.log(`✅ [EmailQuota] Scansione schedulata completata`);
        };

        // Calcola millisecondi fino alla prossima mezzanotte
        const msUntilMidnight = () => {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(0, 0, 0, 0);
            midnight.setDate(midnight.getDate() + 1);
            return midnight.getTime() - now.getTime();
        };

        // Funzione per schedulare la prossima scansione a mezzanotte
        const scheduleNextScan = () => {
            const delay = msUntilMidnight();
            console.log(`⏰ [EmailQuota] Prossima scansione schedulata tra ${Math.round(delay / 1000 / 60)} minuti (mezzanotte)`);
            setTimeout(() => {
                runScheduledScan();
                scheduleNextScan(); // Schedula la prossima scansione dopo questa
            }, delay);
        };

        // Prima esecuzione: alla prossima mezzanotte
        scheduleNextScan();
    };

    // Avvia lo scheduler
    scheduleAutoScan();

    return router;
};
