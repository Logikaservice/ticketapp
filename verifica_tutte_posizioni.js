/**
 * Verifica completa di tutte le posizioni nel database
 */

const { dbGet, dbAll } = require('./backend/crypto_db');

async function verificaPosizioni() {
    console.log('🔍 VERIFICA COMPLETA POSIZIONI\n');
    console.log('='.repeat(80));
    
    try {
        // Tutte le posizioni (aperte, chiuse, qualsiasi stato)
        const tuttePosizioni = await dbAll(
            "SELECT * FROM open_positions ORDER BY opened_at DESC"
        );
        
        console.log(`\n📊 TOTALE POSIZIONI NEL DATABASE: ${tuttePosizioni.length}\n`);
        console.log('-'.repeat(80));
        
        // Raggruppa per status
        const perStatus = {};
        tuttePosizioni.forEach(pos => {
            const status = pos.status || 'unknown';
            if (!perStatus[status]) perStatus[status] = [];
            perStatus[status].push(pos);
        });
        
        // Mostra posizioni aperte
        if (perStatus['open']) {
            console.log(`\n✅ POSIZIONI APERTE: ${perStatus['open'].length}\n`);
            perStatus['open'].forEach((pos, idx) => {
                const entryPrice = parseFloat(pos.entry_price || 0);
                const currentPrice = parseFloat(pos.current_price || entryPrice);
                const volume = parseFloat(pos.volume || 0);
                const value = entryPrice * volume;
                const currentValue = currentPrice * volume;
                const pnl = parseFloat(pos.profit_loss_pct || 0);
                
                console.log(`${idx + 1}. ${pos.symbol.toUpperCase()} | ${pos.type.toUpperCase()}`);
                console.log(`   Ticket: ${pos.ticket_id}`);
                console.log(`   Entry: $${entryPrice.toFixed(8)} | Current: $${currentPrice.toFixed(8)}`);
                console.log(`   Volume: ${volume.toLocaleString('it-IT', {maximumFractionDigits: 4})}`);
                console.log(`   Valore entry: $${value.toFixed(2)} | Valore attuale: $${currentValue.toFixed(2)}`);
                console.log(`   P&L: ${pnl.toFixed(2)}%`);
                console.log(`   Aperta: ${pos.opened_at ? new Date(pos.opened_at).toLocaleString('it-IT') : 'N/A'}`);
                console.log(`   Strategy: ${pos.strategy || 'N/A'}`);
                console.log('');
            });
        }
        
        // Mostra posizioni chiuse (ultime 10)
        if (perStatus['closed'] || perStatus['stopped'] || perStatus['taken']) {
            const chiuse = [
                ...(perStatus['closed'] || []),
                ...(perStatus['stopped'] || []),
                ...(perStatus['taken'] || [])
            ].slice(0, 10);
            
            console.log(`\n📋 POSIZIONI CHIUSE (ultime 10): ${chiuse.length}\n`);
            chiuse.forEach((pos, idx) => {
                const entryPrice = parseFloat(pos.entry_price || 0);
                const currentPrice = parseFloat(pos.current_price || entryPrice);
                const volume = parseFloat(pos.volume || 0);
                const value = entryPrice * volume;
                const pnl = parseFloat(pos.profit_loss_pct || 0);
                
                console.log(`${idx + 1}. ${pos.symbol.toUpperCase()} | ${pos.type.toUpperCase()} | ${pos.status.toUpperCase()}`);
                console.log(`   Ticket: ${pos.ticket_id}`);
                console.log(`   Entry: $${entryPrice.toFixed(8)} | Close: $${currentPrice.toFixed(8)}`);
                console.log(`   Volume: ${volume.toLocaleString('it-IT', {maximumFractionDigits: 4})}`);
                console.log(`   Valore: $${value.toFixed(2)}`);
                console.log(`   P&L: ${pnl.toFixed(2)}%`);
                console.log(`   Aperta: ${pos.opened_at ? new Date(pos.opened_at).toLocaleString('it-IT') : 'N/A'}`);
                console.log(`   Chiusa: ${pos.closed_at ? new Date(pos.closed_at).toLocaleString('it-IT') : 'N/A'}`);
                console.log(`   Motivo: ${pos.close_reason || 'N/A'}`);
                console.log('');
            });
        }
        
        // Statistiche
        console.log('\n📊 STATISTICHE\n');
        console.log('-'.repeat(80));
        console.log(`Total posizioni: ${tuttePosizioni.length}`);
        for (const [status, positions] of Object.entries(perStatus)) {
            console.log(`  ${status}: ${positions.length}`);
        }
        
        // Verifica se ci sono posizioni duplicate o strane
        const tickets = tuttePosizioni.map(p => p.ticket_id);
        const duplicate = tickets.filter((t, i) => tickets.indexOf(t) !== i);
        if (duplicate.length > 0) {
            console.log(`\n⚠️  ATTENZIONE: Ticket duplicati trovati: ${duplicate.join(', ')}`);
        }
        
        // Verifica posizioni aperte recenti (ultime 24h)
        const ultime24h = new Date();
        ultime24h.setHours(ultime24h.getHours() - 24);
        const posizioniRecenti = tuttePosizioni.filter(p => {
            if (!p.opened_at) return false;
            const aperta = new Date(p.opened_at);
            return aperta >= ultime24h;
        });
        
        console.log(`\n🕐 Posizioni aperte nelle ultime 24h: ${posizioniRecenti.length}`);
        posizioniRecenti.forEach(pos => {
            console.log(`   • ${pos.symbol} (${pos.type}) - ${pos.status} - Aperta: ${new Date(pos.opened_at).toLocaleString('it-IT')}`);
        });
        
    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
    }
}

verificaPosizioni().then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});

