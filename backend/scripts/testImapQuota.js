/**
 * Test IMAP QUOTA - Verifica spazio occupato casella email
 * 
 * Uso: node scripts/testImapQuota.js <server_imap> <email> <password>
 * Esempio: node scripts/testImapQuota.js imaps.aruba.it info@example.com mypassword
 */

const { ImapFlow } = require('imapflow');

async function testQuota(host, user, pass) {
    console.log(`\n📧 Test IMAP QUOTA`);
    console.log(`   Server: ${host}`);
    console.log(`   Email:  ${user}`);
    console.log(`   ---`);

    const client = new ImapFlow({
        host: host,
        port: 993,
        secure: true,
        auth: {
            user: user,
            pass: pass
        },
        logger: false // Disabilita log verbose
    });

    try {
        // Connessione
        console.log(`\n🔌 Connessione a ${host}:993 (TLS)...`);
        await client.connect();
        console.log(`✅ Connesso!`);

        // Verifica supporto QUOTA
        const capabilities = client.capabilities || new Map();
        const capKeys = capabilities instanceof Map ? [...capabilities.keys()] : [...capabilities];
        console.log(`\n📋 Capabilities del server:`);
        console.log(`   ${capKeys.join(', ')}`);

        const supportsQuota = capKeys.some(c =>
            String(c).toUpperCase().includes('QUOTA')
        );
        console.log(`\n${supportsQuota ? '✅' : '⚠️'} Supporto QUOTA: ${supportsQuota ? 'SÌ' : 'Non rilevato nelle capabilities (proviamo comunque)'}`);

        // Seleziona INBOX
        const mailbox = await client.mailboxOpen('INBOX');
        console.log(`\n📬 INBOX aperta: ${mailbox.exists} messaggi`);

        // Prova GETQUOTAROOT
        try {
            const quotaRoot = await client.getQuotaRoot('INBOX');

            if (quotaRoot) {
                console.log(`\n📊 QUOTA ROOT Response:`);
                console.log(JSON.stringify(quotaRoot, null, 2));

                // Estrai info quota
                if (quotaRoot.quotas && quotaRoot.quotas.length > 0) {
                    for (const quota of quotaRoot.quotas) {
                        console.log(`\n📦 Quota "${quota.path || 'ROOT'}":`);
                        if (quota.storage) {
                            const usedMB = (quota.storage.usage / 1024).toFixed(2);
                            const limitMB = (quota.storage.limit / 1024).toFixed(2);
                            const usedGB = (quota.storage.usage / 1024 / 1024).toFixed(2);
                            const limitGB = (quota.storage.limit / 1024 / 1024).toFixed(2);
                            const percent = ((quota.storage.usage / quota.storage.limit) * 100).toFixed(1);

                            console.log(`   💾 Spazio usato:  ${usedMB} MB (${usedGB} GB)`);
                            console.log(`   📏 Spazio totale: ${limitMB} MB (${limitGB} GB)`);
                            console.log(`   📊 Utilizzo:      ${percent}%`);
                            console.log(`   ${percent > 90 ? '🔴' : percent > 70 ? '🟡' : '🟢'} Stato: ${percent > 90 ? 'CRITICO' : percent > 70 ? 'ATTENZIONE' : 'OK'}`);
                        }
                        if (quota.messages) {
                            console.log(`   ✉️  Messaggi: ${quota.messages.usage} / ${quota.messages.limit}`);
                        }
                    }
                }
            } else {
                console.log(`\n⚠️ Nessuna risposta QUOTA dal server`);
            }
        } catch (quotaErr) {
            console.log(`\n❌ Errore QUOTA: ${quotaErr.message}`);
            console.log(`   Il server potrebbe non supportare GETQUOTAROOT`);

            // Tentativo alternativo: GETQUOTA
            try {
                console.log(`\n🔄 Tentativo con GETQUOTA...`);
                const quota = await client.getQuota('');
                console.log(`📊 GETQUOTA Response:`);
                console.log(JSON.stringify(quota, null, 2));
            } catch (q2err) {
                console.log(`❌ Anche GETQUOTA fallito: ${q2err.message}`);
            }
        }

        // Lista tutte le cartelle con dimensioni
        console.log(`\n📁 Lista cartelle:`);
        const mailboxes = await client.list();
        for (const mb of mailboxes) {
            console.log(`   ${mb.specialUse || ''} ${mb.path} ${mb.listed ? '' : '(nascosta)'}`);
        }

        // Disconnessione
        await client.logout();
        console.log(`\n✅ Disconnesso. Test completato!`);

    } catch (err) {
        console.error(`\n❌ Errore: ${err.message}`);
        if (err.message.includes('auth') || err.message.includes('Auth') || err.message.includes('LOGIN')) {
            console.log(`   ℹ️  Verifica che email e password siano corretti`);
        }
        if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
            console.log(`   ℹ️  Verifica che il server IMAP sia raggiungibile: ${host}:993`);
        }
    } finally {
        try { client.close(); } catch { }
    }
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 3) {
    console.log(`\n📧 Test IMAP QUOTA - Verifica spazio casella email`);
    console.log(`\nUso: node scripts/testImapQuota.js <server_imap> <email> <password>`);
    console.log(`\nEsempi:`);
    console.log(`  node scripts/testImapQuota.js imaps.aruba.it info@example.com mypassword`);
    console.log(`  node scripts/testImapQuota.js imap.gmail.com user@gmail.com apppassword`);
    console.log(`  node scripts/testImapQuota.js outlook.office365.com user@outlook.com password`);
    process.exit(1);
}

testQuota(args[0], args[1], args[2]);
