/**
 * Script per verificare posizioni nel database sulla VPS
 * Esegui: node backend/check_vps_positions.js
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

async function checkVpsPositions() {
    try {
        console.log('🔍 Controllo posizioni nel database VPS...\n');
        console.log(`📊 Database: ${cryptoDbUrl.replace(/:[^:@]+@/, ':****@')}\n`);
        
        // 1. Controlla tutte le posizioni
        const allPositions = await pool.query(`
            SELECT ticket_id, symbol, type, status, entry_price, current_price, volume, 
                   opened_at, closed_at, strategy
            FROM open_positions 
            ORDER BY opened_at DESC
        `);
        
        console.log(`📊 Totale posizioni nel database: ${allPositions.rows.length}\n`);
        
        if (allPositions.rows.length === 0) {
            console.log('❌ Nessuna posizione trovata nel database');
        } else {
            console.log('📋 Tutte le posizioni:');
            allPositions.rows.forEach((pos, idx) => {
                console.log(`\n${idx + 1}. Ticket ID: ${pos.ticket_id}`);
                console.log(`   Symbol: ${pos.symbol}`);
                console.log(`   Type: ${pos.type}`);
                console.log(`   Status: ${pos.status}`);
                console.log(`   Entry Price: ${pos.entry_price}`);
                console.log(`   Current Price: ${pos.current_price}`);
                console.log(`   Volume: ${pos.volume}`);
                console.log(`   Strategy: ${pos.strategy}`);
                console.log(`   Opened At: ${pos.opened_at}`);
                if (pos.closed_at) {
                    console.log(`   Closed At: ${pos.closed_at}`);
                }
            });
        }
        
        // 2. Controlla solo le posizioni aperte
        const openPositions = await pool.query(`
            SELECT * FROM open_positions 
            WHERE status = 'open' 
            ORDER BY opened_at DESC
        `);
        
        console.log(`\n✅ Posizioni aperte (status='open'): ${openPositions.rows.length}`);
        
        if (openPositions.rows.length > 0) {
            console.log('\n🟢 Posizioni aperte:');
            openPositions.rows.forEach((pos, idx) => {
                console.log(`\n${idx + 1}. Ticket ID: ${pos.ticket_id}`);
                console.log(`   Symbol: ${pos.symbol}`);
                console.log(`   Type: ${pos.type}`);
                console.log(`   Entry Price: ${pos.entry_price}`);
                console.log(`   Current Price: ${pos.current_price}`);
                console.log(`   Volume: ${pos.volume}`);
            });
        } else {
            console.log('⚠️ Nessuna posizione aperta trovata');
        }
        
        // 3. Controlla bot settings
        const botSettings = await pool.query(`
            SELECT * FROM bot_settings 
            WHERE strategy_name = 'RSI_Strategy'
        `);
        
        console.log(`\n🤖 Bot Settings:`);
        if (botSettings.rows.length === 0) {
            console.log('   ❌ Nessuna configurazione bot trovata');
        } else {
            botSettings.rows.forEach((bot, idx) => {
                console.log(`\n${idx + 1}. Symbol: ${bot.symbol}`);
                console.log(`   Is Active: ${bot.is_active === 1 ? '✅ SÌ' : '❌ NO'}`);
                console.log(`   Parameters: ${bot.parameters ? '✅ Presenti' : '❌ Mancanti'}`);
                if (bot.parameters) {
                    try {
                        const params = JSON.parse(bot.parameters);
                        console.log(`   Trade Size: ${params.trade_size_usdt || params.dimensione_trade_usdt || 'N/A'} USDT`);
                        console.log(`   RSI Period: ${params.rsi_period || 'N/A'}`);
                    } catch (e) {
                        console.log(`   Parameters (raw): ${bot.parameters.substring(0, 100)}...`);
                    }
                }
            });
        }
        
        // 4. Controlla portfolio
        const portfolio = await pool.query('SELECT * FROM portfolio WHERE id = 1');
        if (portfolio.rows.length > 0) {
            console.log(`\n💰 Portfolio:`);
            console.log(`   Balance: $${portfolio.rows[0].balance_usd || 0}`);
            console.log(`   Holdings: ${portfolio.rows[0].holdings || '{}'}`);
        }
        
        // 5. Controlla performance stats
        const stats = await pool.query('SELECT * FROM performance_stats WHERE id = 1');
        if (stats.rows.length > 0) {
            const s = stats.rows[0];
            console.log(`\n📊 Performance Stats:`);
            console.log(`   Total Trades: ${s.total_trades || 0}`);
            console.log(`   Win Rate: ${s.win_rate ? (s.win_rate * 100).toFixed(2) + '%' : 'N/A'}`);
            console.log(`   Winning: ${s.winning_trades || 0}`);
            console.log(`   Losing: ${s.losing_trades || 0}`);
        }
        
        // 6. Verifica se bot è attivo per ethereum
        const ethereumBot = await pool.query(`
            SELECT * FROM bot_settings 
            WHERE strategy_name = 'RSI_Strategy' AND symbol = 'ethereum'
        `);
        
        console.log(`\n🔍 Bot Ethereum:`);
        if (ethereumBot.rows.length === 0) {
            console.log('   ❌ Bot non configurato per Ethereum');
            console.log('   💡 Devi configurare il bot per Ethereum nel frontend');
        } else {
            const bot = ethereumBot.rows[0];
            console.log(`   Is Active: ${bot.is_active === 1 ? '✅ SÌ' : '❌ NO (BLOCCATO - Attiva il bot per Ethereum)'}`);
            if (bot.parameters) {
                try {
                    const params = JSON.parse(bot.parameters);
                    console.log(`   Trade Size: ${params.trade_size_usdt || params.dimensione_trade_usdt || 'N/A'} USDT`);
                    console.log(`   RSI Period: ${params.rsi_period || 'N/A'}`);
                    console.log(`   Stop Loss: ${params.stop_loss_pct || 'N/A'}%`);
                    console.log(`   Take Profit: ${params.take_profit_pct || 'N/A'}%`);
                } catch (e) {
                    console.log(`   Parameters (raw): ${bot.parameters.substring(0, 100)}...`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

checkVpsPositions();

