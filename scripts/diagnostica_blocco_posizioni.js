/**
 * Script di diagnostica per verificare perché il bot non apre nuove posizioni
 */

const { dbGet, dbAll } = require('./backend/crypto_db');

async function diagnosticaBlocco() {
    console.log('🔍 DIAGNOSTICA BLOCCO APERTURA POSIZIONI\n');
    console.log('='.repeat(60));

    try {
        // 1. Verifica stato bot
        console.log('\n📊 1. STATO BOT ATTIVI');
        console.log('-'.repeat(60));
        const activeBots = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND is_active = 1"
        );
        const inactiveBots = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND is_active = 0"
        );
        
        console.log(`✅ Bot ATTIVI: ${activeBots.length}`);
        activeBots.forEach(bot => {
            console.log(`   • ${bot.symbol} (ID: ${bot.id})`);
        });
        
        console.log(`\n⏸️  Bot INATTIVI: ${inactiveBots.length}`);
        if (inactiveBots.length > 0 && inactiveBots.length <= 5) {
            inactiveBots.forEach(bot => {
                console.log(`   • ${bot.symbol} (ID: ${bot.id})`);
            });
        }

        if (activeBots.length === 0) {
            console.log('\n❌ PROBLEMA TROVATO: Nessun bot attivo!');
            console.log('   → Il bot non può aprire posizioni se tutti i bot sono disattivati');
            return;
        }

        // 2. Verifica posizioni aperte
        console.log('\n📈 2. POSIZIONI APERTE');
        console.log('-'.repeat(60));
        const openPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        
        console.log(`Posizioni totali aperte: ${openPositions.length}`);
        
        if (openPositions.length > 0) {
            console.log('\nDettagli posizioni:');
            openPositions.forEach((pos, idx) => {
                console.log(`   ${idx + 1}. ${pos.symbol} | ${pos.type.toUpperCase()} | Ticket: ${pos.ticket_id} | P&L: ${parseFloat(pos.profit_loss_pct || 0).toFixed(2)}%`);
            });

            // Conta per gruppo
            const CORRELATION_GROUPS = {
                'BTC_MAJOR': ['bitcoin', 'bitcoin_usdt', 'ethereum', 'ethereum_usdt', 'solana', 'solana_eur'],
                'DEFI': ['chainlink', 'chainlink_usdt'],
                'PAYMENTS': ['trx', 'trx_eur', 'xlm', 'xlm_eur'],
                'LAYER2': ['arb', 'arb_eur', 'op', 'op_eur', 'matic', 'matic_eur'],
                'GAMING': ['sand', 'mana', 'axs', 'imx', 'gala', 'enj', 'enj_eur'],
                'STORAGE': ['fil', 'ar'],
                'MEME': ['dogecoin', 'dogecoin_eur', 'shiba', 'shiba_eur', 'pepe', 'pepe_eur', 'floki', 'bonk'],
                'AI_DATA': ['fet', 'render', 'grt'],
                'STABLECOINS': ['usdc'],
                'INDEPENDENT': ['ripple', 'ripple_eur', 'litecoin', 'litecoin_usdt', 'binance_coin', 'binance_coin_eur', 'pol_polygon', 'pol_polygon_eur']
            };

            console.log('\nPosizioni per gruppo:');
            for (const [groupName, symbols] of Object.entries(CORRELATION_GROUPS)) {
                const groupPos = openPositions.filter(p => symbols.includes(p.symbol));
                if (groupPos.length > 0) {
                    console.log(`   ${groupName}: ${groupPos.length} posizioni`);
                    groupPos.forEach(p => console.log(`      • ${p.symbol} (${p.type})`));
                }
            }
        }

        // 3. Verifica limiti configurazione
        console.log('\n⚙️  3. CONFIGURAZIONE LIMITI');
        console.log('-'.repeat(60));
        const HYBRID_STRATEGY_CONFIG = {
            MAX_POSITIONS_PER_GROUP: 10,
            MAX_TOTAL_POSITIONS: 30
        };

        console.log(`MAX_TOTAL_POSITIONS: ${HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS}`);
        console.log(`MAX_POSITIONS_PER_GROUP: ${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP}`);
        console.log(`Posizioni attuali: ${openPositions.length}`);
        console.log(`Limite raggiunto: ${openPositions.length >= HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS ? '❌ SÌ' : '✅ NO'}`);

        // 4. Verifica win rate e limiti dinamici
        console.log('\n📊 4. WIN RATE E LIMITI DINAMICI');
        console.log('-'.repeat(60));
        const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
        
        if (stats && stats.total_trades >= 10) {
            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
            console.log(`Total trades: ${stats.total_trades}`);
            console.log(`Winning trades: ${stats.winning_trades}`);
            console.log(`Win rate: ${(winRate * 100).toFixed(2)}%`);

            const getMaxPositionsForWinRate = (winRate) => {
                if (winRate >= 0.90) return 30;
                if (winRate >= 0.80) return 25;
                if (winRate >= 0.70) return 20;
                return 15;
            };

            const dynamicMax = getMaxPositionsForWinRate(winRate);
            console.log(`\nLimite dinamico basato su win rate: ${dynamicMax} posizioni`);
            console.log(`Limite raggiunto (dinamico): ${openPositions.length >= dynamicMax ? '❌ SÌ' : '✅ NO'}`);
            
            if (openPositions.length >= dynamicMax) {
                console.log(`\n⚠️  BLOCCO IDENTIFICATO: Limite dinamico raggiunto!`);
                console.log(`   → Win rate ${(winRate * 100).toFixed(1)}% permette max ${dynamicMax} posizioni`);
                console.log(`   → Attualmente hai ${openPositions.length} posizioni aperte`);
            }
        } else {
            console.log('⚠️  Statistiche insufficienti per calcolare win rate');
            console.log(`   → Usando limite base: ${HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS}`);
        }

        // 5. Verifica Risk Manager
        console.log('\n💰 5. RISK MANAGER');
        console.log('-'.repeat(60));
        
        const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
        if (!portfolio) {
            console.log('❌ PROBLEMA TROVATO: Portfolio non trovato!');
            return;
        }

        const cashBalance = parseFloat(portfolio.balance_usd) || 0;
        const totalBalance = parseFloat(portfolio.total_balance_usd) || cashBalance;
        
        console.log(`Cash balance: $${cashBalance.toFixed(2)} USDT`);
        console.log(`Total balance: $${totalBalance.toFixed(2)} USDT`);

        // Calcola esposizione corrente
        let currentExposure = 0;
        if (openPositions.length > 0) {
            for (const pos of openPositions) {
                const entryPrice = parseFloat(pos.entry_price || 0);
                const volume = parseFloat(pos.volume || 0);
                currentExposure += entryPrice * volume;
            }
        }

        const currentExposurePct = totalBalance > 0 ? (currentExposure / totalBalance) : 0;
        console.log(`Exposure corrente: $${currentExposure.toFixed(2)} USDT (${(currentExposurePct * 100).toFixed(2)}%)`);

        // Calcola limiti dinamici
        let maxExposurePct = 0.80; // Base
        let maxPositionSizePct = 0.10; // Base
        
        if (stats && stats.total_trades >= 10) {
            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
            if (winRate >= 0.90) {
                maxExposurePct = 0.95;
                maxPositionSizePct = 0.15;
            } else if (winRate >= 0.80) {
                maxExposurePct = 0.90;
                maxPositionSizePct = 0.12;
            } else if (winRate >= 0.70) {
                maxExposurePct = 0.85;
                maxPositionSizePct = 0.11;
            }
        }

        const maxExposure = totalBalance * maxExposurePct;
        const availableExposure = maxExposure - currentExposure;
        const FIXED_POSITION_PCT = 0.08;
        const MIN_POSITION_SIZE = 80.0;
        const calculatedPositionSize = totalBalance * FIXED_POSITION_PCT;
        const maxPositionSize = Math.max(calculatedPositionSize, MIN_POSITION_SIZE);
        const maxAvailableForNewPosition = Math.min(maxPositionSize, availableExposure);

        console.log(`\nLimite exposure: ${(maxExposurePct * 100).toFixed(0)}% = $${maxExposure.toFixed(2)} USDT`);
        console.log(`Exposure disponibile: $${availableExposure.toFixed(2)} USDT`);
        console.log(`Max position size: $${maxPositionSize.toFixed(2)} USDT`);
        console.log(`Max disponibile per nuova posizione: $${maxAvailableForNewPosition.toFixed(2)} USDT`);

        // Verifica blocchi risk manager
        const MAX_DAILY_LOSS_PCT = 0.05;
        const today = new Date().toISOString().split('T')[0];
        
        // Calcola perdite giornaliere
        const closedToday = await dbAll(
            "SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') AND DATE(closed_at) = $1",
            [today]
        );
        
        let dailyLoss = 0;
        for (const pos of closedToday) {
            const pnl = parseFloat(pos.profit_loss_pct || 0);
            if (pnl < 0) {
                const entryPrice = parseFloat(pos.entry_price || 0);
                const volume = parseFloat(pos.volume || 0);
                dailyLoss += Math.abs(entryPrice * volume * (pnl / 100));
            }
        }

        const dailyLossPct = totalBalance > 0 ? (dailyLoss / totalBalance) : 0;
        console.log(`\nPerdita giornaliera: $${dailyLoss.toFixed(2)} USDT (${(dailyLossPct * 100).toFixed(2)}%)`);
        console.log(`Limite perdita giornaliera: ${(MAX_DAILY_LOSS_PCT * 100).toFixed(0)}% = $${(totalBalance * MAX_DAILY_LOSS_PCT).toFixed(2)} USDT`);
        
        if (dailyLossPct >= MAX_DAILY_LOSS_PCT) {
            console.log(`\n❌ BLOCCO IDENTIFICATO: Limite perdita giornaliera raggiunto!`);
            console.log(`   → Perdita giornaliera: ${(dailyLossPct * 100).toFixed(2)}% >= ${(MAX_DAILY_LOSS_PCT * 100).toFixed(0)}%`);
        }

        if (currentExposurePct >= maxExposurePct) {
            console.log(`\n❌ BLOCCO IDENTIFICATO: Limite exposure raggiunto!`);
            console.log(`   → Exposure corrente: ${(currentExposurePct * 100).toFixed(2)}% >= ${(maxExposurePct * 100).toFixed(0)}%`);
        }

        if (maxAvailableForNewPosition < MIN_POSITION_SIZE) {
            console.log(`\n❌ BLOCCO IDENTIFICATO: Non c'è abbastanza capitale disponibile!`);
            console.log(`   → Disponibile: $${maxAvailableForNewPosition.toFixed(2)} USDT < Minimo: $${MIN_POSITION_SIZE} USDT`);
        }

        if (cashBalance < MIN_POSITION_SIZE) {
            console.log(`\n❌ BLOCCO IDENTIFICATO: Cash balance insufficiente!`);
            console.log(`   → Cash: $${cashBalance.toFixed(2)} USDT < Minimo: $${MIN_POSITION_SIZE} USDT`);
        }

        // 6. Riepilogo
        console.log('\n' + '='.repeat(60));
        console.log('📋 RIEPILOGO DIAGNOSTICA');
        console.log('='.repeat(60));
        
        const blocchi = [];
        
        if (activeBots.length === 0) {
            blocchi.push('❌ Nessun bot attivo');
        }
        
        if (stats && stats.total_trades >= 10) {
            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
            const dynamicMax = winRate >= 0.90 ? 30 : winRate >= 0.80 ? 25 : winRate >= 0.70 ? 20 : 15;
            if (openPositions.length >= dynamicMax) {
                blocchi.push(`❌ Limite posizioni dinamico raggiunto (${openPositions.length}/${dynamicMax})`);
            }
        } else if (openPositions.length >= HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS) {
            blocchi.push(`❌ Limite posizioni base raggiunto (${openPositions.length}/${HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS})`);
        }
        
        if (dailyLossPct >= MAX_DAILY_LOSS_PCT) {
            blocchi.push(`❌ Limite perdita giornaliera raggiunto (${(dailyLossPct * 100).toFixed(2)}%)`);
        }
        
        if (currentExposurePct >= maxExposurePct) {
            blocchi.push(`❌ Limite exposure raggiunto (${(currentExposurePct * 100).toFixed(2)}%)`);
        }
        
        if (maxAvailableForNewPosition < MIN_POSITION_SIZE) {
            blocchi.push(`❌ Capitale disponibile insufficiente ($${maxAvailableForNewPosition.toFixed(2)})`);
        }
        
        if (cashBalance < MIN_POSITION_SIZE) {
            blocchi.push(`❌ Cash balance insufficiente ($${cashBalance.toFixed(2)})`);
        }

        if (blocchi.length === 0) {
            console.log('✅ Nessun blocco identificato!');
            console.log('   → Il bot dovrebbe essere in grado di aprire nuove posizioni');
            console.log('   → Verifica i log del bot per altri motivi (segnali deboli, volume basso, ecc.)');
        } else {
            console.log('⚠️  BLOCCHI IDENTIFICATI:');
            blocchi.forEach((blocco, idx) => {
                console.log(`   ${idx + 1}. ${blocco}`);
            });
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('❌ Errore durante la diagnostica:', error);
        console.error(error.stack);
    }
}

// Esegui diagnostica
diagnosticaBlocco().then(() => {
    console.log('\n✅ Diagnostica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});

