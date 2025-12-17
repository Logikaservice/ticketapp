const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'crypto_trading.db');

function dbAll(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbGet(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function fetchSymbolData(symbol) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ticket.logikaservice.it',
            path: `/api/crypto/bot-analysis?symbol=${symbol}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Node.js Analysis Script'
            },
            timeout: 10000
        };

        const req = https.get(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve(data);
                } catch (e) {
                    resolve({ error: 'Parse error', rawBody: body.substring(0, 200) });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'Timeout' });
        });
    });
}

async function checkSymbol(db, symbol) {
    // Conta klines nel database
    const klinesCount = await dbGet(db, 'SELECT COUNT(*) as count FROM klines WHERE symbol = ?', [symbol]);
    
    // Chiama API
    const apiData = await fetchSymbolData(symbol);
    
    // Analizza risposta
    const result = {
        symbol,
        klinesInDb: klinesCount?.count || 0,
        hasApiData: !!apiData,
        hasError: !!apiData?.error,
        errorMessage: apiData?.error || null,
        hasSignal: !!(apiData?.signal),
        signalDirection: apiData?.signal?.direction || null,
        signalStrength: apiData?.signal?.strength || null,
        hasPrice: !!(apiData?.currentPrice && apiData.currentPrice > 0),
        currentPrice: apiData?.currentPrice || 0,
        hasRsi: !!(apiData?.rsi),
        rsi: apiData?.rsi || null,
        hasMtf: !!(apiData?.mtf),
        hasRequirements: !!(apiData?.requirements),
        hasRisk: !!(apiData?.risk),
        isEmpty: false
    };
    
    // Determina se i dati sono "vuoti"
    if (!result.hasError && result.hasApiData) {
        result.isEmpty = (
            !result.hasPrice || 
            result.currentPrice === 0 || 
            !result.hasSignal ||
            result.signalStrength === 0 ||
            !result.hasRsi
        );
    }
    
    return result;
}

async function main() {
    const db = new sqlite3.Database(DB_PATH);
    
    console.log('🔍 VERIFICA DATI VUOTI E PROBLEMATICI\n');
    console.log('━'.repeat(120));
    
    // Verifica prima la struttura del database
    const tables = await dbAll(db, "SELECT name FROM sqlite_master WHERE type='table'");
    console.log('\n📋 Tabelle nel database:');
    tables.forEach(t => console.log(`   - ${t.name}`));
    
    // Trova la tabella corretta per i bot parameters
    let botsQuery = '';
    if (tables.find(t => t.name === 'bot_parameters')) {
        botsQuery = 'SELECT symbol, is_active FROM bot_parameters ORDER BY symbol';
    } else if (tables.find(t => t.name === 'symbols')) {
        botsQuery = 'SELECT DISTINCT symbol FROM klines ORDER BY symbol';
    } else {
        console.log('\n❌ Impossibile trovare tabella bot_parameters o symbols');
        console.log('   Uso lista simboli dalla tabella klines\n');
        botsQuery = 'SELECT DISTINCT symbol FROM klines ORDER BY symbol';
    }
    
    const bots = await dbAll(db, botsQuery);
    
    console.log(`\n📊 Trovati ${bots.length} simboli da verificare\n`);
    
    const results = [];
    const problems = [];
    
    for (const bot of bots) {
        const symbol = bot.symbol || bot;
        process.stdout.write(`Verificando ${symbol.toString().padEnd(20)}...`);
        const result = await checkSymbol(db, symbol);
        result.isActive = bot.is_active === 1 || true; // Default true se non c'è il campo
        results.push(result);
        
        if (result.hasError) {
            console.log(` ❌ ERRORE: ${result.errorMessage}`);
            problems.push({ ...result, issue: 'API_ERROR' });
        } else if (result.isEmpty) {
            console.log(` ⚠️  DATI VUOTI`);
            problems.push({ ...result, issue: 'EMPTY_DATA' });
        } else if (result.klinesInDb < 50) {
            console.log(` ⚠️  Klines insufficienti (${result.klinesInDb})`);
            problems.push({ ...result, issue: 'NO_KLINES' });
        } else {
            console.log(` ✓`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    console.log('\n━'.repeat(120));
    console.log('\n📊 RIEPILOGO PROBLEMI\n');
    
    if (problems.length === 0) {
        console.log('✅ Nessun problema trovato! Tutti i simboli hanno dati completi.\n');
    } else {
        // Raggruppa per tipo di problema
        const byIssue = {
            API_ERROR: problems.filter(p => p.issue === 'API_ERROR'),
            EMPTY_DATA: problems.filter(p => p.issue === 'EMPTY_DATA'),
            NO_KLINES: problems.filter(p => p.issue === 'NO_KLINES')
        };
        
        if (byIssue.API_ERROR.length > 0) {
            console.log('🚨 ERRORI API (potrebbero causare crash):');
            byIssue.API_ERROR.forEach(p => {
                console.log(`   ${p.symbol.padEnd(20)} | ${p.errorMessage} | Attivo: ${p.isActive ? 'SI' : 'NO'}`);
            });
            console.log('');
        }
        
        if (byIssue.EMPTY_DATA.length > 0) {
            console.log('⚠️  DATI VUOTI (strength=0, price=0, no RSI):');
            byIssue.EMPTY_DATA.forEach(p => {
                const details = [];
                if (!p.hasPrice || p.currentPrice === 0) details.push('no price');
                if (!p.hasSignal || p.signalStrength === 0) details.push('no signal');
                if (!p.hasRsi) details.push('no RSI');
                console.log(`   ${p.symbol.padEnd(20)} | ${details.join(', ')} | Klines: ${p.klinesInDb} | Attivo: ${p.isActive ? 'SI' : 'NO'}`);
            });
            console.log('');
        }
        
        if (byIssue.NO_KLINES.length > 0) {
            console.log('📉 KLINES INSUFFICIENTI (<50):');
            byIssue.NO_KLINES.forEach(p => {
                console.log(`   ${p.symbol.padEnd(20)} | Klines: ${p.klinesInDb} | Attivo: ${p.isActive ? 'SI' : 'NO'}`);
            });
            console.log('');
        }
    }
    
    // Statistiche generali
    const activeProblems = problems.filter(p => p.isActive);
    const inactiveProblems = problems.filter(p => !p.isActive);
    
    console.log('📈 STATISTICHE:');
    console.log(`   Simboli totali: ${results.length}`);
    console.log(`   Bot attivi: ${results.filter(r => r.isActive).length}`);
    console.log(`   Bot inattivi: ${results.filter(r => !r.isActive).length}`);
    console.log(`   Problemi totali: ${problems.length}`);
    console.log(`   Problemi su bot ATTIVI: ${activeProblems.length} ${activeProblems.length > 0 ? '⚠️' : '✅'}`);
    console.log(`   Problemi su bot INATTIVI: ${inactiveProblems.length}`);
    console.log('');
    
    // Analisi impatto
    if (activeProblems.length > 0) {
        console.log('🚨 IMPATTO SULLA LOGICA DEL BOT:');
        console.log('');
        console.log('   ⚠️  Bot attivi con dati problematici potrebbero:');
        console.log('   1. Causare errori nella generazione segnali');
        console.log('   2. Restituire sempre NEUTRAL anche se ci sono opportunità');
        console.log('   3. Bloccare l\'apertura posizioni per mancanza dati');
        console.log('   4. Generare log di errore ripetuti');
        console.log('');
        console.log('   💡 RACCOMANDAZIONI:');
        console.log('   - Disattivare bot con dati vuoti');
        console.log('   - Scaricare klines mancanti per bot attivi');
        console.log('   - Verificare mapping simboli nel SYMBOL_NORMALIZATION_MAP');
        console.log('');
    }
    
    // Simboli OK per reference
    const okSymbols = results.filter(r => 
        !r.hasError && 
        !r.isEmpty && 
        r.klinesInDb >= 50 && 
        r.isActive
    );
    
    if (okSymbols.length > 0) {
        console.log('✅ BOT ATTIVI CON DATI COMPLETI:');
        okSymbols.slice(0, 10).forEach(r => {
            console.log(`   ${r.symbol.padEnd(20)} | Klines: ${r.klinesInDb.toString().padStart(5)} | Strength: ${(r.signalStrength || 0).toString().padStart(3)} | ${r.signalDirection}`);
        });
        if (okSymbols.length > 10) {
            console.log(`   ... e altri ${okSymbols.length - 10} simboli`);
        }
        console.log('');
    }
    
    console.log('━'.repeat(120));
    
    db.close();
}

main().catch(console.error);
