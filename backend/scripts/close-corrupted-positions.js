/**
 * Chiudi posizioni con dati corrotti (volume anomalo)
 * 
 * Identifica e chiude automaticamente posizioni con:
 * - Volume > 1000 (anomalo)
 * - Entry price molto basso (< $0.001) con volume altissimo
 * - Investito < $1 (troppo basso)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { dbAll, dbRun } = require('../crypto_db');

const MAX_REASONABLE_VOLUME = 1000; // Volume massimo ragionevole per posizione
const MIN_REASONABLE_INVESTED = 1; // Minimo investito ragionevole ($1)

async function closeCorruptedPositions() {
    try {
        console.log('🔍 Cerco posizioni con dati corrotti...\n');

        // Trova tutte le posizioni aperte
        const openPositions = await dbAll(
            `SELECT ticket_id, symbol, type, volume, entry_price, 
                    (volume * entry_price) as invested, opened_at
             FROM open_positions 
             WHERE status = 'open' 
             ORDER BY opened_at DESC`
        );

        console.log(`📊 Posizioni aperte totali: ${openPositions.length}\n`);

        if (openPositions.length === 0) {
            console.log('✅ Nessuna posizione aperta da verificare.');
            return;
        }

        const corruptedPositions = [];

        // Identifica posizioni corrotte
        for (const pos of openPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const invested = parseFloat(pos.invested) || 0;

            let isCorrupted = false;
            let reason = [];

            // Check 1: Volume troppo alto
            if (volume > MAX_REASONABLE_VOLUME) {
                isCorrupted = true;
                reason.push(`Volume anomalo: ${volume.toFixed(2)} (max: ${MAX_REASONABLE_VOLUME})`);
            }

            // Check 2: Entry price sospetto con volume alto
            if (entryPrice < 0.001 && volume > 100) {
                isCorrupted = true;
                reason.push(`Entry price sospetto: $${entryPrice} con volume ${volume.toFixed(2)}`);
            }

            // Check 3: Investito troppo basso
            if (invested < MIN_REASONABLE_INVESTED) {
                isCorrupted = true;
                reason.push(`Investito troppo basso: $${invested.toFixed(2)}`);
            }

            if (isCorrupted) {
                corruptedPositions.push({
                    ...pos,
                    volume,
                    entryPrice,
                    invested,
                    corruptionReasons: reason
                });
            }
        }

        if (corruptedPositions.length === 0) {
            console.log('✅ Nessuna posizione corrotta trovata. Tutte le posizioni sono valide.\n');
            return;
        }

        console.log(`🚨 Trovate ${corruptedPositions.length} posizioni corrotte:\n`);

        // Mostra posizioni corrotte
        corruptedPositions.forEach((pos, idx) => {
            console.log(`${idx + 1}. ${pos.ticket_id}`);
            console.log(`   Simbolo: ${pos.symbol}`);
            console.log(`   Type: ${pos.type.toUpperCase()}`);
            console.log(`   Volume: ${pos.volume.toFixed(8)}`);
            console.log(`   Entry Price: $${pos.entryPrice.toFixed(8)}`);
            console.log(`   Investito: $${pos.invested.toFixed(2)}`);
            console.log(`   Motivi:`);
            pos.corruptionReasons.forEach(r => console.log(`      - ${r}`));
            console.log('');
        });

        console.log(`\n⚠️  Chiudo ${corruptedPositions.length} posizioni corrotte...\n`);

        let closed = 0;
        for (const pos of corruptedPositions) {
            try {
                // Chiudi posizione con P&L = 0 (dati corrotti, non calcolabile)
                await dbRun(
                    `UPDATE open_positions 
                     SET status = 'closed',
                         closed_at = $1,
                         close_reason = $2,
                         profit_loss = 0,
                         profit_loss_pct = 0
                     WHERE ticket_id = $3`,
                    [
                        new Date().toISOString(),
                        'Data corruption: ' + pos.corruptionReasons.join('; '),
                        pos.ticket_id
                    ]
                );

                console.log(`✅ Chiusa: ${pos.ticket_id} (${pos.symbol})`);
                closed++;
            } catch (err) {
                console.error(`❌ Errore chiudendo ${pos.ticket_id}:`, err.message);
            }
        }

        console.log(`\n✅ Chiuse ${closed}/${corruptedPositions.length} posizioni corrotte.`);
        console.log('\n📊 Le posizioni corrette rimarranno aperte.');

    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Esegui
closeCorruptedPositions();
