const { dbAll } = require('../crypto_db');

async function checkAllPositions() {
    try {
        console.log('🔍 Verifica TUTTE le posizioni aperte...\n');

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
                status
            FROM open_positions 
            WHERE status = 'open'
            ORDER BY opened_at DESC 
            LIMIT 20
        `);

        if (positions.length === 0) {
            console.log('⚠️ Nessuna posizione aperta trovata\n');

            // Verifica posizioni chiuse recentemente
            console.log('🔍 Verifica posizioni chiuse recentemente...\n');
            const closedPositions = await dbAll(`
                SELECT 
                    ticket_id,
                    symbol,
                    type,
                    entry_price,
                    current_price,
                    profit_loss,
                    profit_loss_pct,
                    opened_at,
                    closed_at,
                    status,
                    volume
                FROM open_positions 
                WHERE status IN ('closed', 'stopped', 'taken')
                ORDER BY closed_at DESC 
                LIMIT 10
            `);

            if (closedPositions.length > 0) {
                console.log(`✅ Trovate ${closedPositions.length} posizioni chiuse recentemente:\n`);
                closedPositions.forEach(row => {
                    const duration = row.closed_at && row.opened_at
                        ? Math.round((new Date(row.closed_at) - new Date(row.opened_at)) / 1000 / 60)
                        : 0;
                    console.log(`📊 ${row.symbol} (${row.type.toUpperCase()})`);
                    console.log(`   Entry: $${row.entry_price} → Exit: $${row.current_price}`);
                    console.log(`   P&L: $${row.profit_loss} (${row.profit_loss_pct}%)`);
                    console.log(`   Status: ${row.status}`);
                    console.log(`   Opened: ${row.opened_at}`);
                    console.log(`   Closed: ${row.closed_at}`);
                    console.log(`   Duration: ${duration} minutes`);
                    console.log('');
                });
            }
        } else {
            console.log(`✅ Trovate ${positions.length} posizioni aperte:\n`);
            positions.forEach(row => {
                const duration = row.opened_at
                    ? Math.round((Date.now() - new Date(row.opened_at)) / 1000 / 60)
                    : 0;
                console.log(`📊 ${row.symbol} (${row.type.toUpperCase()})`);
                console.log(`   Entry: $${row.entry_price} → Current: $${row.current_price}`);
                console.log(`   P&L: $${row.profit_loss} (${row.profit_loss_pct}%)`);
                console.log(`   Opened: ${row.opened_at} (${duration} minutes ago)`);
                console.log('');
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkAllPositions();
