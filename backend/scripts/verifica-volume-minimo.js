/**
 * Script per verificare se il volume minimo viene rispettato
 * e se le posizioni aperte rispettano il criterio del volume minimo
 */

const { dbAll, dbGet } = require('../crypto_db');
const { get24hVolume } = require('../routes/cryptoRoutes');

async function verificaVolumeMinimo() {
    try {
        console.log('🔍 Verifica Volume Minimo 24h\n');
        console.log('='.repeat(60));

        // 1. Ottieni il volume minimo configurato da bot_settings
        const botSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        
        let defaultMinVolume = 500000; // Default hardcoded nel TradingBot.js
        if (botSettings && botSettings.parameters) {
            const params = typeof botSettings.parameters === 'string' 
                ? JSON.parse(botSettings.parameters) 
                : botSettings.parameters;
            defaultMinVolume = params.min_volume_24h || 500000;
            console.log(`📊 Volume minimo configurato (da bot_settings global): $${defaultMinVolume.toLocaleString('it-IT')} USDT\n`);
        } else {
            console.log(`⚠️ Nessun parametro trovato in bot_settings, usando default: $${defaultMinVolume.toLocaleString('it-IT')} USDT\n`);
        }

        // 2. Ottieni tutte le posizioni aperte
        const openPositions = await dbAll(
            "SELECT ticket_id, symbol, type, entry_price, opened_at, signal_details FROM open_positions WHERE status = $1",
            ['open']
        );

        console.log(`📈 Posizioni aperte trovate: ${openPositions.length}\n`);

        if (openPositions.length === 0) {
            console.log('✅ Nessuna posizione aperta da verificare.');
            return;
        }

        // 3. Per ogni posizione, verifica il volume
        const results = [];

        for (const position of openPositions) {
            const symbol = position.symbol;
            
            // Ottieni il volume minimo specifico per questo simbolo (da bot_settings)
            const symbolSettings = await dbGet(
                "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND (symbol = $1 OR symbol = 'global') ORDER BY CASE WHEN symbol = $1 THEN 0 ELSE 1 END LIMIT 1",
                [symbol]
            ).catch(() => null);
            
            let minVolume = defaultMinVolume;
            if (symbolSettings && symbolSettings.parameters) {
                const symbolParams = typeof symbolSettings.parameters === 'string' 
                    ? JSON.parse(symbolSettings.parameters) 
                    : symbolSettings.parameters;
                minVolume = symbolParams.min_volume_24h || defaultMinVolume;
            }

            // Ottieni il volume 24h attuale
            let volume24h = 0;
            try {
                // Prova a ottenere il volume dalla funzione get24hVolume
                // Nota: questa funzione potrebbe non essere esportata, quindi proviamo un approccio alternativo
                const volumeData = await dbGet(
                    "SELECT volume_24h, updated_at FROM symbol_volumes_24h WHERE symbol = $1",
                    [symbol]
                );
                
                if (volumeData && volumeData.volume_24h) {
                    volume24h = parseFloat(volumeData.volume_24h);
                } else {
                    // Se non c'è nel DB, prova a chiamare l'API (ma potrebbe fallire se IP bannato)
                    console.log(`   ⚠️ Volume non trovato nel DB per ${symbol}, provo API...`);
                    // Per ora, segna come non disponibile
                    volume24h = null;
                }
            } catch (err) {
                console.error(`   ❌ Errore recupero volume per ${symbol}:`, err.message);
                volume24h = null;
            }

            const result = {
                symbol,
                ticketId: position.ticket_id,
                type: position.type,
                entryPrice: position.entry_price,
                openedAt: position.opened_at,
                minVolumeRequired: minVolume,
                currentVolume24h: volume24h,
                respectsVolume: volume24h !== null ? volume24h >= minVolume : null,
                signalDetails: position.signal_details ? JSON.parse(position.signal_details) : null
            };

            results.push(result);
        }

        // 4. Stampa i risultati
        console.log('\n📊 RISULTATI VERIFICA VOLUME MINIMO:\n');
        console.log('='.repeat(60));

        let rispettano = 0;
        let nonRispettano = 0;
        let nonDisponibile = 0;

        for (const result of results) {
            const status = result.respectsVolume === null 
                ? '❓ NON DISPONIBILE'
                : result.respectsVolume 
                    ? '✅ RISPETTA'
                    : '❌ NON RISPETTA';

            console.log(`\n${status} - ${result.symbol.toUpperCase()} (${result.type})`);
            console.log(`   Ticket ID: ${result.ticketId}`);
            console.log(`   Aperta il: ${result.openedAt}`);
            console.log(`   Prezzo entry: $${parseFloat(result.entryPrice).toFixed(2)}`);
            console.log(`   Volume minimo richiesto: $${result.minVolumeRequired.toLocaleString('it-IT')} USDT`);
            
            if (result.currentVolume24h !== null) {
                console.log(`   Volume 24h attuale: $${result.currentVolume24h.toLocaleString('it-IT')} USDT`);
                const diff = result.currentVolume24h - result.minVolumeRequired;
                const diffPct = ((diff / result.minVolumeRequired) * 100).toFixed(1);
                console.log(`   Differenza: ${diff >= 0 ? '+' : ''}$${diff.toLocaleString('it-IT')} (${diffPct >= 0 ? '+' : ''}${diffPct}%)`);
            } else {
                console.log(`   Volume 24h attuale: ❓ NON DISPONIBILE`);
            }

            if (result.respectsVolume === null) {
                nonDisponibile++;
            } else if (result.respectsVolume) {
                rispettano++;
            } else {
                nonRispettano++;
            }
        }

        // 5. Riepilogo
        console.log('\n' + '='.repeat(60));
        console.log('\n📊 RIEPILOGO:\n');
        console.log(`   ✅ Rispettano il volume minimo: ${rispettano}`);
        console.log(`   ❌ NON rispettano il volume minimo: ${nonRispettano}`);
        console.log(`   ❓ Volume non disponibile: ${nonDisponibile}`);
        console.log(`   📊 Totale posizioni: ${results.length}`);

        // 6. Verifica se il controllo viene effettivamente fatto nel TradingBot
        console.log('\n' + '='.repeat(60));
        console.log('\n🔍 VERIFICA IMPLEMENTAZIONE:\n');
        
        const fs = require('fs');
        const tradingBotPath = require('path').join(__dirname, '../services/TradingBot.js');
        const tradingBotCode = fs.readFileSync(tradingBotPath, 'utf8');
        
        // Verifica se usa il valore hardcoded o legge da bot_parameters
        const usesHardcoded = tradingBotCode.includes('BOT_CONFIG.MIN_VOLUME_24H') && 
                              !tradingBotCode.includes('botParams.min_volume_24h');
        
        if (usesHardcoded) {
            console.log('   ⚠️ PROBLEMA TROVATO: TradingBot.js usa ancora MIN_VOLUME_24H hardcoded!');
            console.log('   📝 Il bot NON legge min_volume_24h da bot_parameters');
            console.log('   🔧 Deve essere modificato per leggere da botParams.min_volume_24h');
        } else {
            console.log('   ✅ TradingBot.js legge min_volume_24h da bot_parameters');
        }

        // Verifica se il controllo viene fatto prima di aprire posizioni
        const checksVolume = tradingBotCode.includes('volume24h') && 
                            tradingBotCode.includes('MIN_VOLUME') || 
                            tradingBotCode.includes('min_volume');
        
        if (checksVolume) {
            console.log('   ✅ Il bot controlla il volume prima di aprire posizioni');
        } else {
            console.log('   ❌ Il bot NON controlla il volume prima di aprire posizioni!');
        }

    } catch (error) {
        console.error('❌ Errore durante la verifica:', error);
        console.error(error.stack);
    }
}

// Esegui la verifica
verificaVolumeMinimo()
    .then(() => {
        console.log('\n✅ Verifica completata');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Errore fatale:', err);
        process.exit(1);
    });

