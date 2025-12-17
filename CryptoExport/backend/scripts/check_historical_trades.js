/**
 * Script per contare le klines di BTC/EUR
 */

const { dbAll, dbGet, pool } = require('../crypto_db');

async function countBtcEurKlines() {
    const client = await pool.connect();
    try {
        console.log('🔍 Conta klines per BTC/EUR...\n');

        // Test connessione
        await client.query('SELECT 1');
        console.log('✅ Connessione database OK\n');

        // Helper per query con timeout
        const queryWithTimeout = async (query, params, timeoutMs = 30000) => {
            const queryPromise = client.query(query, params);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Query timeout dopo ${timeoutMs/1000} secondi`)), timeoutMs)
            );
            return Promise.race([queryPromise, timeoutPromise]);
        };

        // Conta totale klines per bitcoin (il simbolo nel DB è 'bitcoin', non 'bitcoin_eur')
        const countResult = await queryWithTimeout(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1",
            ['bitcoin']
        );
        const totalCount = countResult.rows[0];
        console.log(`📊 Totale klines BTC/EUR: ${totalCount.count}`);

        // Conta per intervallo
        const intervalResult = await queryWithTimeout(
            "SELECT interval, COUNT(*) as count FROM klines WHERE symbol = $1 GROUP BY interval ORDER BY interval",
            ['bitcoin']
        );
        const byInterval = intervalResult.rows;
        
        if (byInterval.length > 0) {
            console.log('\n📈 Klines per intervallo:');
            byInterval.forEach(row => {
                console.log(`   ${row.interval}: ${row.count} klines`);
            });
        }

        // Range temporale
        const timeRangeResult = await queryWithTimeout(
            `SELECT 
                MIN(open_time) as first_candle,
                MAX(open_time) as last_candle
             FROM klines 
             WHERE symbol = $1`,
            ['bitcoin']
        );
        const timeRange = timeRangeResult.rows[0];

        if (timeRange.first_candle && timeRange.last_candle) {
            const firstDate = new Date(Number(timeRange.first_candle));
            const lastDate = new Date(Number(timeRange.last_candle));
            const daysSpan = (Number(timeRange.last_candle) - Number(timeRange.first_candle)) / (1000 * 60 * 60 * 24);

            console.log('\n📅 Range temporale:');
            console.log(`   Prima kline: ${firstDate.toISOString()}`);
            console.log(`   Ultima kline: ${lastDate.toISOString()}`);
            console.log(`   Giorni coperti: ${daysSpan.toFixed(1)}`);
        }

        client.release();
        process.exit(0);
    } catch (error) {
        if (client) client.release();
        console.error('❌ Errore:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

countBtcEurKlines();
