/**
 * Script per verificare il valore di trade_size_usdt nel database
 */

const cryptoDb = require('../crypto_db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkTradeSize() {
    console.log('🔍 Verifica trade_size_usdt nel database...\n');

    try {
        // Leggi tutti i record da bot_settings
        const allSettings = await cryptoDb.dbAll(
            "SELECT id, strategy_name, symbol, parameters FROM bot_settings WHERE parameters IS NOT NULL"
        );

        if (!allSettings || allSettings.length === 0) {
            console.log('ℹ️  Nessun record trovato in bot_settings.');
            return;
        }

        console.log(`📋 Trovati ${allSettings.length} record(s):\n`);

        for (const setting of allSettings) {
            try {
                // Parse del JSON
                let params = {};
                if (typeof setting.parameters === 'string') {
                    params = JSON.parse(setting.parameters);
                } else {
                    params = setting.parameters;
                }

                const tradeSize = params.trade_size_usdt || params.trade_size_eur || 'NON CONFIGURATO';
                const maxExposure = params.max_exposure_pct || 'NON CONFIGURATO';

                console.log(`  📊 ${setting.strategy_name} / ${setting.symbol}:`);
                console.log(`     trade_size_usdt: ${tradeSize}`);
                console.log(`     max_exposure_pct: ${maxExposure} ${maxExposure !== 'NON CONFIGURATO' ? '(DOVREBBE ESSERE RIMOSSO)' : ''}`);
                console.log('');
            } catch (err) {
                console.error(`  ❌ Errore processando record ID ${setting.id}:`, err.message);
            }
        }

        // Verifica record 'global' specificamente
        const globalSettings = await cryptoDb.dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'"
        );

        if (globalSettings && globalSettings.parameters) {
            const params = typeof globalSettings.parameters === 'string' 
                ? JSON.parse(globalSettings.parameters) 
                : globalSettings.parameters;
            
            console.log('\n' + '='.repeat(60));
            console.log('📌 CONFIGURAZIONE GLOBALE (usata dal bot):');
            console.log('='.repeat(60));
            console.log(`   trade_size_usdt: ${params.trade_size_usdt || params.trade_size_eur || 'NON CONFIGURATO'}`);
            console.log(`   max_exposure_pct: ${params.max_exposure_pct || 'NON CONFIGURATO'} ${params.max_exposure_pct ? '(DOVREBBE ESSERE RIMOSSO)' : ''}`);
            console.log('='.repeat(60) + '\n');
        }

    } catch (error) {
        console.error('❌ Errore durante la verifica:', error);
        process.exit(1);
    } finally {
        // Chiudi il pool di connessioni
        try {
            await cryptoDb.pool.end();
        } catch (err) {
            // Ignora errori di chiusura
        }
    }
}

// Esegui lo script
checkTradeSize()
    .then(() => {
        console.log('✅ Verifica completata!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    });
