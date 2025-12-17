/**
 * Script diagnostico per capire perché il bot non apre posizioni
 * Esegui: node backend/diagnose_bot_not_opening.js
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Usa la stessa logica di connessione di crypto_db.js
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

if (!cryptoDbUrl && process.env.DATABASE_URL) {
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
} else if (!cryptoDbUrl) {
    cryptoDbUrl = process.env.DATABASE_URL;
}

if (!cryptoDbUrl) {
    console.error('❌ DATABASE_URL o DATABASE_URL_CRYPTO non configurato!');
    process.exit(1);
}

const isLocalhost = cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1');
const pool = new Pool({
    connectionString: cryptoDbUrl,
    ssl: isLocalhost ? false : {
        rejectUnauthorized: false
    }
});

async function diagnoseBotNotOpening() {
    try {
        console.log('🔍 DIAGNOSTICA: Perché il bot non apre posizioni?\n');
        console.log(`📊 Database: ${cryptoDbUrl.replace(/:[^:@]+@/, ':****@')}\n`);
        console.log('=' .repeat(60));
        
        // 1. Verifica posizioni aperte
        console.log('\n1️⃣ POSIZIONI APERTE:');
        const openPositions = await pool.query(`
            SELECT ticket_id, symbol, type, status, entry_price, volume, opened_at
            FROM open_positions 
            WHERE status = 'open'
            ORDER BY opened_at DESC
        `);
        console.log(`   Totale: ${openPositions.rows.length}`);
        if (openPositions.rows.length > 0) {
            openPositions.rows.forEach((pos, idx) => {
                console.log(`   ${idx + 1}. ${pos.symbol.toUpperCase()} - ${pos.type} - Ticket: ${pos.ticket_id}`);
            });
        } else {
            console.log('   ⚠️ Nessuna posizione aperta');
        }
        
        // 2. Verifica bot attivo per Ethereum
        console.log('\n2️⃣ BOT ETHEREUM:');
        const ethereumBot = await pool.query(`
            SELECT * FROM bot_settings 
            WHERE strategy_name = 'RSI_Strategy' AND symbol = 'ethereum'
        `);
        
        if (ethereumBot.rows.length === 0) {
            console.log('   ❌ Bot NON configurato per Ethereum');
            console.log('   💡 AZIONE RICHIESTA: Vai nel frontend e configura il bot per Ethereum');
            console.log('   → Imposta "Dimensione Trade", "Stop Loss", "Take Profit", ecc.');
        } else {
            const bot = ethereumBot.rows[0];
            const isActive = bot.is_active === 1;
            console.log(`   Is Active: ${isActive ? '✅ SÌ' : '❌ NO'}`);
            
            if (!isActive) {
                console.log('   🛑 PROBLEMA TROVATO: Bot non attivo!');
                console.log('   💡 AZIONE RICHIESTA: Attiva il bot per Ethereum nel frontend (toggle "ACTIVE/PAUSED")');
            }
            
            if (bot.parameters) {
                try {
                    const params = JSON.parse(bot.parameters);
                    console.log(`   Trade Size: ${params.trade_size_usdt || params.dimensione_trade_usdt || 'N/A'} USDT`);
                    console.log(`   RSI Period: ${params.rsi_period || 'N/A'}`);
                    console.log(`   Stop Loss: ${params.stop_loss_pct || 'N/A'}%`);
                    console.log(`   Take Profit: ${params.take_profit_pct || 'N/A'}%`);
                } catch (e) {
                    console.log(`   ⚠️ Errore parsing parameters`);
                }
            }
        }
        
        // 3. Verifica tutti i bot attivi
        console.log('\n3️⃣ TUTTI I BOT ATTIVI:');
        const activeBots = await pool.query(`
            SELECT symbol, is_active, parameters
            FROM bot_settings 
            WHERE strategy_name = 'RSI_Strategy' AND is_active = 1
            ORDER BY symbol
        `);
        console.log(`   Totale bot attivi: ${activeBots.rows.length}`);
        if (activeBots.rows.length === 0) {
            console.log('   ❌ Nessun bot attivo!');
            console.log('   💡 AZIONE RICHIESTA: Attiva almeno un bot nel frontend');
        } else {
            activeBots.rows.forEach((bot, idx) => {
                console.log(`   ${idx + 1}. ${bot.symbol.toUpperCase()}`);
            });
        }
        
        // 4. Verifica Portfolio
        console.log('\n4️⃣ PORTFOLIO:');
        const portfolio = await pool.query('SELECT * FROM portfolio WHERE id = 1');
        if (portfolio.rows.length > 0) {
            const p = portfolio.rows[0];
            const balance = parseFloat(p.balance_usd || 0);
            console.log(`   Balance: $${balance.toFixed(2)} USDT`);
            
            if (balance < 80) {
                console.log(`   ⚠️ Balance insufficiente per aprire posizioni (minimo $80 USDT richiesto)`);
            }
        } else {
            console.log('   ❌ Portfolio non trovato');
        }
        
        // 5. Verifica Performance Stats
        console.log('\n5️⃣ PERFORMANCE STATS:');
        const stats = await pool.query('SELECT * FROM performance_stats WHERE id = 1');
        if (stats.rows.length > 0) {
            const s = stats.rows[0];
            const totalTrades = s.total_trades || 0;
            const winRate = s.win_rate || 0;
            console.log(`   Total Trades: ${totalTrades}`);
            console.log(`   Win Rate: ${(winRate * 100).toFixed(2)}%`);
            console.log(`   Winning: ${s.winning_trades || 0}`);
            console.log(`   Losing: ${s.losing_trades || 0}`);
            
            if (totalTrades >= 10 && winRate < 0.3) {
                console.log(`   ⚠️ Win rate basso (${(winRate * 100).toFixed(2)}%) - potrebbe influenzare apertura posizioni`);
            }
        }
        
        // 6. Verifica ultime posizioni chiuse
        console.log('\n6️⃣ ULTIME POSIZIONI CHIUSE:');
        const closedPositions = await pool.query(`
            SELECT ticket_id, symbol, type, profit_loss, profit_loss_pct, closed_at, close_reason
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken')
            ORDER BY closed_at DESC
            LIMIT 5
        `);
        console.log(`   Ultime 5 posizioni chiuse:`);
        if (closedPositions.rows.length === 0) {
            console.log('   ℹ️ Nessuna posizione chiusa trovata');
        } else {
            closedPositions.rows.forEach((pos, idx) => {
                const pnl = parseFloat(pos.profit_loss || 0);
                const pnlPct = parseFloat(pos.profit_loss_pct || 0);
                const emoji = pnl >= 0 ? '✅' : '❌';
                console.log(`   ${idx + 1}. ${emoji} ${pos.symbol.toUpperCase()} - ${pos.type} - P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%) - ${pos.close_reason || 'N/A'}`);
            });
        }
        
        // 7. Riepilogo problemi
        console.log('\n' + '='.repeat(60));
        console.log('\n📋 RIEPILOGO PROBLEMI TROVATI:\n');
        
        const problems = [];
        
        if (openPositions.rows.length === 0) {
            problems.push('✅ Nessuna posizione aperta (normale se bot non ha ancora aperto)');
        }
        
        if (ethereumBot.rows.length === 0) {
            problems.push('❌ Bot non configurato per Ethereum');
        } else if (ethereumBot.rows[0].is_active !== 1) {
            problems.push('❌ Bot Ethereum non attivo');
        }
        
        if (activeBots.rows.length === 0) {
            problems.push('❌ Nessun bot attivo nel sistema');
        }
        
        const p = portfolio.rows[0];
        if (p && parseFloat(p.balance_usd || 0) < 80) {
            problems.push('⚠️ Balance insufficiente (< $80 USDT)');
        }
        
        if (problems.length === 0) {
            console.log('   ✅ Nessun problema evidente trovato nel database');
            console.log('   💡 Controlla i log del backend per vedere perché il bot non apre:');
            console.log('      pm2 logs ticketapp-backend --lines 100 | grep -i "ethereum\\|BLOCKED\\|canOpen\\|risk"');
        } else {
            problems.forEach((p, idx) => {
                console.log(`   ${idx + 1}. ${p}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

diagnoseBotNotOpening();

