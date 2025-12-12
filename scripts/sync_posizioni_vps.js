/**
 * Script per sincronizzare posizioni dal VPS al database locale
 * Risolve discrepanze tra database locale e VPS
 */

const https = require('https');
const http = require('http');
const { dbAll, dbGet, dbRun } = require('./backend/crypto_db');

const VPS_URL = 'https://ticket.logikaservice.it';
const API_BASE_URL = `${VPS_URL}/api/crypto`;

// Helper per richieste HTTP
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const req = protocol.get({
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function syncPosizioni() {
    console.log('🔄 SINCRONIZZAZIONE POSIZIONI VPS → LOCALE\n');
    console.log('='.repeat(60));
    
    try {
        // 1. Leggi posizioni dal VPS
        console.log('\n📥 Leggo posizioni dal VPS...');
        const vpsData = await makeRequest(`${API_BASE_URL}/dashboard`);
        
        const vpsAperte = vpsData.open_positions || [];
        const vpsChiuse = vpsData.closed_positions || [];
        
        console.log(`✅ VPS: ${vpsAperte.length} aperte, ${vpsChiuse.length} chiuse (ultime 100)`);
        
        // 2. Leggi posizioni dal locale
        console.log('\n📥 Leggo posizioni dal database locale...');
        const localAperte = await dbAll("SELECT ticket_id FROM open_positions WHERE status = 'open'");
        const localChiuse = await dbAll("SELECT ticket_id FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");
        
        console.log(`✅ Locale: ${localAperte.length} aperte, ${localChiuse.length} chiuse`);
        
        // 3. Sincronizza posizioni aperte
        console.log('\n🔄 Sincronizzazione posizioni APERTE...');
        console.log('-'.repeat(60));
        
        const localTicketIds = new Set(localAperte.map(p => p.ticket_id));
        let aggiunte = 0;
        let aggiornate = 0;
        
        for (const vpsPos of vpsAperte) {
            const exists = await dbGet(
                "SELECT ticket_id FROM open_positions WHERE ticket_id = $1",
                [vpsPos.ticket_id]
            );
            
            if (exists) {
                // Aggiorna posizione esistente
                await dbRun(
                    `UPDATE open_positions SET
                        symbol = $1, type = $2, volume = $3, entry_price = $4,
                        current_price = $5, stop_loss = $6, take_profit = $7,
                        profit_loss = $8, profit_loss_pct = $9, status = $10,
                        opened_at = $11, strategy = $12, updated_at = NOW()
                    WHERE ticket_id = $13`,
                    [
                        vpsPos.symbol,
                        vpsPos.type,
                        vpsPos.volume,
                        vpsPos.entry_price,
                        vpsPos.current_price || vpsPos.entry_price,
                        vpsPos.stop_loss,
                        vpsPos.take_profit,
                        vpsPos.profit_loss || 0,
                        vpsPos.profit_loss_pct || 0,
                        'open',
                        vpsPos.opened_at,
                        vpsPos.strategy || 'N/A',
                        vpsPos.ticket_id
                    ]
                );
                aggiornate++;
                console.log(`   ✅ Aggiornata: ${vpsPos.symbol} (${vpsPos.ticket_id})`);
            } else {
                // Inserisci nuova posizione
                await dbRun(
                    `INSERT INTO open_positions 
                    (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, 
                     profit_loss, profit_loss_pct, status, opened_at, strategy)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [
                        vpsPos.ticket_id,
                        vpsPos.symbol,
                        vpsPos.type,
                        vpsPos.volume,
                        vpsPos.entry_price,
                        vpsPos.current_price || vpsPos.entry_price,
                        vpsPos.stop_loss,
                        vpsPos.take_profit,
                        vpsPos.profit_loss || 0,
                        vpsPos.profit_loss_pct || 0,
                        'open',
                        vpsPos.opened_at,
                        vpsPos.strategy || 'N/A'
                    ]
                );
                aggiunte++;
                console.log(`   ➕ Aggiunta: ${vpsPos.symbol} (${vpsPos.ticket_id})`);
            }
        }
        
        // 4. Chiudi posizioni locali che non sono più sul VPS
        const vpsTicketIds = new Set(vpsAperte.map(p => p.ticket_id));
        let chiuse = 0;
        
        for (const localPos of localAperte) {
            if (!vpsTicketIds.has(localPos.ticket_id)) {
                // La posizione è locale ma non è più sul VPS - chiudila
                await dbRun(
                    "UPDATE open_positions SET status = 'closed', closed_at = NOW() WHERE ticket_id = $1",
                    [localPos.ticket_id]
                );
                chiuse++;
                console.log(`   🔒 Chiusa (non più sul VPS): ${localPos.ticket_id}`);
            }
        }
        
        // 5. Sincronizza posizioni chiuse (solo le più recenti)
        console.log('\n🔄 Sincronizzazione posizioni CHIUSE (ultime 10)...');
        console.log('-'.repeat(60));
        
        let chiuseAggiunte = 0;
        const recentChiuse = vpsChiuse.slice(0, 10); // Solo ultime 10
        
        for (const vpsPos of recentChiuse) {
            const exists = await dbGet(
                "SELECT ticket_id FROM open_positions WHERE ticket_id = $1",
                [vpsPos.ticket_id]
            );
            
            if (!exists) {
                // Inserisci posizione chiusa
                await dbRun(
                    `INSERT INTO open_positions 
                    (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, 
                     profit_loss, profit_loss_pct, status, opened_at, closed_at, strategy)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                    [
                        vpsPos.ticket_id,
                        vpsPos.symbol,
                        vpsPos.type,
                        vpsPos.volume,
                        vpsPos.entry_price,
                        vpsPos.current_price || vpsPos.entry_price,
                        vpsPos.stop_loss,
                        vpsPos.take_profit,
                        vpsPos.profit_loss || 0,
                        vpsPos.profit_loss_pct || 0,
                        vpsPos.status || 'closed',
                        vpsPos.opened_at,
                        vpsPos.closed_at,
                        vpsPos.strategy || 'N/A'
                    ]
                );
                chiuseAggiunte++;
            }
        }
        
        // 6. Riepilogo
        console.log('\n' + '='.repeat(60));
        console.log('📊 RIEPILOGO SINCRONIZZAZIONE');
        console.log('='.repeat(60));
        console.log(`✅ Posizioni aperte aggiunte: ${aggiunte}`);
        console.log(`✅ Posizioni aperte aggiornate: ${aggiornate}`);
        console.log(`🔒 Posizioni chiuse (non più sul VPS): ${chiuse}`);
        console.log(`📋 Posizioni chiuse sincronizzate: ${chiuseAggiunte}`);
        
        // Verifica finale
        const finalAperte = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        console.log(`\n✅ Totale posizioni aperte dopo sync: ${finalAperte[0]?.count || 0}`);
        
        if (parseInt(finalAperte[0]?.count || 0) === vpsAperte.length) {
            console.log('✅ Sincronizzazione completata con successo!');
        } else {
            console.log(`⚠️  Attenzione: Locale=${finalAperte[0]?.count} vs VPS=${vpsAperte.length}`);
        }
        
    } catch (error) {
        console.error('\n❌ Errore durante sincronizzazione:', error.message);
        if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
            console.error('   → Verifica che il VPS sia raggiungibile');
        }
        process.exit(1);
    }
}

syncPosizioni().then(() => {
    console.log('\n✅ Sincronizzazione completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});






