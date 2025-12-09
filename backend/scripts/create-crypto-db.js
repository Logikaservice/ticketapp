/**
 * Script per creare il database separato crypto_db
 * NON tocca il database principale
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

async function createCryptoDb() {
    try {
        const mainDbUrl = process.env.DATABASE_URL;
        if (!mainDbUrl) {
            console.error('❌ DATABASE_URL non configurato in .env');
            process.exit(1);
        }

        // Estrai nome database principale
        const dbMatch = mainDbUrl.match(/\/([^\/\?]+)(\?|$)/);
        const dbName = dbMatch ? dbMatch[1] : 'ticketapp';
        
        // Estrai user, password, host, port da DATABASE_URL
        const urlMatch = mainDbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^\/\?]+)/);
        if (!urlMatch) {
            throw new Error('Formato DATABASE_URL non valido');
        }
        const [, user, password, host, port, currentDb] = urlMatch;
        
        // Prova prima a connetterti al database principale e creare crypto_db da lì
        // Se fallisce, prova con database postgres
        console.log('📊 Creazione database separato crypto_db...');
        console.log('Database principale:', currentDb);
        console.log('Host:', host);
        console.log('Port:', port);
        console.log('User:', user);
        console.log('');

        // Prova prima con database principale (alcuni setup permettono CREATE DATABASE da qualsiasi DB)
        let adminPool = new Pool({
            connectionString: mainDbUrl,
            ssl: host.includes('localhost') || host === '127.0.0.1' ? false : { rejectUnauthorized: false }
        });

        try {
            // Crea database crypto_db
            await adminPool.query('CREATE DATABASE crypto_db');
            console.log('✅ Database crypto_db creato con successo!');
        } catch (createErr) {
            if (createErr.message.includes('already exists')) {
                console.log('✅ Database crypto_db già esiste (OK)');
            } else if (createErr.message.includes('permission denied') || createErr.message.includes('must be superuser')) {
                // Se non ha permessi dal database principale, prova con database postgres
                console.log('⚠️  Permessi insufficienti dal database principale, provo con database postgres...');
                adminPool.end();
                
                const adminUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
                adminPool = new Pool({
                    connectionString: adminUrl,
                    ssl: host.includes('localhost') || host === '127.0.0.1' ? false : { rejectUnauthorized: false }
                });
                
                try {
                    await adminPool.query('CREATE DATABASE crypto_db');
                    console.log('✅ Database crypto_db creato con successo!');
                } catch (createErr2) {
                    if (createErr2.message.includes('already exists')) {
                        console.log('✅ Database crypto_db già esiste (OK)');
                    } else {
                        throw createErr2;
                    }
                }
            } else {
                throw createErr;
            }
        }

        // Verifica che esista
        const verifyResult = await adminPool.query(
            "SELECT datname FROM pg_database WHERE datname = 'crypto_db'"
        );
        
        if (verifyResult.rows.length > 0) {
            console.log('✅ Verificato: crypto_db esiste nel sistema');
            console.log('');
            console.log('🎯 Database principale NON toccato - solo crypto_db creato');
        } else {
            console.error('❌ Errore: crypto_db non trovato dopo creazione');
            process.exit(1);
        }

        adminPool.end();
        
    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

createCryptoDb();

