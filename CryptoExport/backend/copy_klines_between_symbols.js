/**
 * 📋 Script per Copiare Klines tra Simboli
 * 
 * Copia klines da un simbolo sorgente a un simbolo destinazione
 * Utile per: pol_polygon -> polpolygon
 */

const { dbAll, dbRun, dbGet } = require('./crypto_db');

async function copyKlines(sourceSymbol, targetSymbol, interval = '15m') {
    console.log(`📋 COPIA KLINES: ${sourceSymbol} → ${targetSymbol}`);
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Verifica simbolo sorgente
        console.log(`1️⃣ Verifica simbolo sorgente: ${sourceSymbol}...`);
        const sourceKlines = await dbAll(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
            [sourceSymbol, interval]
        );
        
        const sourceCount = parseInt(sourceKlines[0]?.count || 0);
        console.log(`   Klines disponibili: ${sourceCount}`);
        
        if (sourceCount === 0) {
            console.log(`   ❌ Nessuna kline trovata per ${sourceSymbol}`);
            return;
        }
        console.log('');

        // 2. Verifica simbolo destinazione
        console.log(`2️⃣ Verifica simbolo destinazione: ${targetSymbol}...`);
        const targetKlines = await dbAll(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
            [targetSymbol, interval]
        );
        
        const targetCount = parseInt(targetKlines[0]?.count || 0);
        console.log(`   Klines esistenti: ${targetCount}`);
        console.log('');

        // 3. Copia klines
        console.log(`3️⃣ Copia klines...`);
        const allKlines = await dbAll(
            "SELECT * FROM klines WHERE symbol = $1 AND interval = $2 ORDER BY open_time",
            [sourceSymbol, interval]
        );

        let inserted = 0;
        let skipped = 0;
        let errors = 0;

        for (const kline of allKlines) {
            try {
                await dbRun(
                    `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                    [
                        targetSymbol,
                        kline.interval,
                        kline.open_time,
                        kline.open_price,
                        kline.high_price,
                        kline.low_price,
                        kline.close_price,
                        kline.volume,
                        kline.close_time
                    ]
                );
                
                // Verifica se è stato inserito (non era duplicato)
                const check = await dbGet(
                    "SELECT open_time FROM klines WHERE symbol = $1 AND interval = $2 AND open_time = $3",
                    [targetSymbol, interval, kline.open_time]
                );
                
                if (check) {
                    // Verifica se era già presente
                    const wasExisting = targetCount > 0 && parseInt(kline.open_time) <= Date.now();
                    if (!wasExisting) {
                        inserted++;
                    } else {
                        skipped++;
                    }
                }
            } catch (error) {
                errors++;
                // Ignora errori di duplicati
            }
        }

        console.log(`   ✅ ${inserted} nuove klines inserite`);
        if (skipped > 0) {
            console.log(`   ⏭️ ${skipped} klines già presenti (saltate)`);
        }
        if (errors > 0) {
            console.log(`   ⚠️ ${errors} errori durante inserimento`);
        }
        console.log('');

        // 4. Verifica risultato finale
        console.log(`4️⃣ Verifica risultato finale...`);
        const finalKlines = await dbAll(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
            [targetSymbol, interval]
        );
        
        const finalCount = parseInt(finalKlines[0]?.count || 0);
        console.log(`   ✅ Klines finali per ${targetSymbol}: ${finalCount}`);
        console.log('');

        console.log('='.repeat(80));
        console.log('✅ COPIA COMPLETATA');
        console.log('='.repeat(80));
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante copia klines:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function main() {
    const sourceSymbol = process.argv[2];
    const targetSymbol = process.argv[3];
    const interval = process.argv[4] || '15m';

    if (!sourceSymbol || !targetSymbol) {
        console.log('Uso: node copy_klines_between_symbols.js <simbolo_sorgente> <simbolo_destinazione> [interval]');
        console.log('');
        console.log('Esempi:');
        console.log('  node copy_klines_between_symbols.js pol_polygon polpolygon');
        console.log('  node copy_klines_between_symbols.js matic polpolygon');
        console.log('');
        process.exit(1);
    }

    await copyKlines(sourceSymbol, targetSymbol, interval);
}

main().catch(console.error);

