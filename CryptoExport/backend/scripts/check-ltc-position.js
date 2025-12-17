const { dbAll } = require('../crypto_db');

async function checkLTCPosition() {
    try {
        console.log('🔍 Verifica posizione LTC...\n');

        const positions = await dbAll(`
            SELECT 
                ticket_id,
                symbol,
                type,
                entry_price,
                current_price,
                profit_loss,
                profit_loss_pct,
                opened_at,
                volume,
                signal_details
            FROM open_positions 
            WHERE symbol LIKE '%LTC%' AND status = 'open'
            ORDER BY opened_at DESC 
            LIMIT 5
        `);

        if (positions.length === 0) {
            console.log('⚠️ Nessuna posizione LTC aperta trovata');
        } else {
            console.log(`✅ Trovate ${positions.length} posizioni LTC aperte:\n`);
            positions.forEach(row => {
                console.log(`📊 Ticket: ${row.ticket_id}`);
                console.log(`   Symbol: ${row.symbol}`);
                console.log(`   Type: ${row.type}`);
                console.log(`   Entry: $${row.entry_price}`);
                console.log(`   Current: $${row.current_price}`);
                console.log(`   P&L: $${row.profit_loss} (${row.profit_loss_pct}%)`);
                console.log(`   Opened: ${row.opened_at}`);
                console.log(`   Volume: ${row.volume}`);

                if (row.signal_details) {
                    try {
                        const signal = typeof row.signal_details === 'string'
                            ? JSON.parse(row.signal_details)
                            : row.signal_details;
                        console.log(`\n   📊 SIGNAL ANALYSIS:`);
                        console.log(`   Strength: ${signal.strength || 'N/A'}`);
                        console.log(`   Confirmations: ${signal.confirmations || 'N/A'}`);
                        if (signal.reasons && signal.reasons.length > 0) {
                            console.log(`   Reasons:`);
                            signal.reasons.forEach(r => console.log(`     - ${r}`));
                        }

                        // Verifica se c'è professionalAnalysis
                        if (signal.professionalAnalysis) {
                            console.log(`\n   🎯 PROFESSIONAL ANALYSIS (BOT NUOVO):`);
                            if (signal.professionalAnalysis.momentumQuality) {
                                const mq = signal.professionalAnalysis.momentumQuality;
                                console.log(`     Momentum Quality: ${mq.score}/100 (${mq.isHealthy ? '✅ Healthy' : '⚠️ Unhealthy'})`);
                                if (mq.warnings && mq.warnings.length > 0) {
                                    mq.warnings.forEach(w => console.log(`       - ${w}`));
                                }
                            }
                            if (signal.professionalAnalysis.reversalRisk) {
                                const rr = signal.professionalAnalysis.reversalRisk;
                                console.log(`     Reversal Risk: ${rr.risk.toUpperCase()} (${rr.score}/100)`);
                                if (rr.reasons && rr.reasons.length > 0) {
                                    rr.reasons.forEach(r => console.log(`       - ${r}`));
                                }
                            }
                            if (signal.professionalAnalysis.marketStructure) {
                                const ms = signal.professionalAnalysis.marketStructure;
                                if (ms.nearestResistance) {
                                    console.log(`     Nearest Resistance: $${ms.nearestResistance.price.toFixed(2)} (${(ms.nearestResistance.distance * 100).toFixed(2)}% away)`);
                                }
                                if (ms.nearestSupport) {
                                    console.log(`     Nearest Support: $${ms.nearestSupport.price.toFixed(2)} (${(ms.nearestSupport.distance * 100).toFixed(2)}% away)`);
                                }
                            }
                        } else {
                            console.log(`\n   ⚠️ POSIZIONE APERTA CON BOT VECCHIO`);
                            console.log(`   (senza filtri professionali - aperta prima del commit d4e43aa)`);
                        }
                    } catch (e) {
                        console.log(`   Signal details: (errore parsing: ${e.message})`);
                    }
                }
                console.log('\n' + '='.repeat(70) + '\n');
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

checkLTCPosition();
