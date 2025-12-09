#!/bin/bash

# Script per verificare posizioni sul VPS
# Esegui questo script sul VPS dopo aver fatto git pull

echo "🔍 VERIFICA POSIZIONI SUL VPS"
echo "=============================="
echo ""

# Vai nella directory del progetto
cd /path/to/ticketapp

# Esegui lo script di verifica
node backend/scripts/check-all-positions.js

echo ""
echo "🎯 VERIFICA FILTRI PROFESSIONALI"
echo "================================="
echo ""

# Verifica se le posizioni hanno professionalAnalysis
node -e "
const { dbAll } = require('./backend/crypto_db');

async function check() {
    const positions = await dbAll(\`
        SELECT 
            ticket_id,
            symbol,
            type,
            entry_price,
            opened_at,
            signal_details
        FROM open_positions 
        WHERE status = 'open'
        ORDER BY opened_at DESC 
        LIMIT 5
    \`);
    
    if (positions.length === 0) {
        console.log('⚠️ Nessuna posizione aperta');
    } else {
        positions.forEach(p => {
            console.log(\`📊 \${p.symbol} (\${p.type}) - Opened: \${p.opened_at}\`);
            if (p.signal_details) {
                try {
                    const signal = typeof p.signal_details === 'string' 
                        ? JSON.parse(p.signal_details) 
                        : p.signal_details;
                    if (signal.professionalAnalysis) {
                        console.log('   ✅ Ha filtri professionali (BOT NUOVO)');
                        if (signal.professionalAnalysis.momentumQuality) {
                            console.log(\`   Momentum: \${signal.professionalAnalysis.momentumQuality.score}/100\`);
                        }
                        if (signal.professionalAnalysis.reversalRisk) {
                            console.log(\`   Reversal Risk: \${signal.professionalAnalysis.reversalRisk.risk}\`);
                        }
                    } else {
                        console.log('   ❌ SENZA filtri professionali (BOT VECCHIO)');
                    }
                } catch (e) {
                    console.log('   ⚠️ Errore parsing signal_details');
                }
            }
            console.log('');
        });
    }
    process.exit(0);
}

check();
"

echo ""
echo "✅ Verifica completata"
