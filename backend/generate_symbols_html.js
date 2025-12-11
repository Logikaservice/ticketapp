/**
 * 📊 Script per Generare Tabella HTML dei Simboli
 * 
 * Genera un file HTML con una tabella formattata di tutti i simboli
 * raggruppati per base currency
 */

const { dbAll } = require('./crypto_db');
const fs = require('fs');
const path = require('path');

// Mappa per normalizzare nomi base currency (stessa di list_symbols_table.js)
const BASE_CURRENCY_MAP = {
    'bitcoin': 'BTC',
    'bitcoin_usdt': 'BTC',
    'bitcoin_eur': 'BTC',
    'ethereum': 'ETH',
    'ethereum_usdt': 'ETH',
    'ethereum_eur': 'ETH',
    'cardano': 'ADA',
    'cardano_usdt': 'ADA',
    'cardano_eur': 'ADA',
    'polkadot': 'DOT',
    'polkadot_usdt': 'DOT',
    'polkadot_eur': 'DOT',
    'chainlink': 'LINK',
    'chainlink_usdt': 'LINK',
    'chainlink_eur': 'LINK',
    'litecoin': 'LTC',
    'litecoin_usdt': 'LTC',
    'litecoin_eur': 'LTC',
    'ripple': 'XRP',
    'ripple_eur': 'XRP',
    'binance_coin': 'BNB',
    'binance_coin_eur': 'BNB',
    'solana': 'SOL',
    'solana_eur': 'SOL',
    'avax_usdt': 'AVAX',
    'avalanche': 'AVAX',
    'avalanche_eur': 'AVAX',
    'avax_eur': 'AVAX',
    'matic': 'MATIC',
    'matic_eur': 'MATIC',
    'dogecoin': 'DOGE',
    'dogecoin_eur': 'DOGE',
    'shiba': 'SHIB',
    'shiba_eur': 'SHIB',
    'tron': 'TRX',
    'tron_eur': 'TRX',
    'stellar': 'XLM',
    'stellar_eur': 'XLM',
    'cosmos': 'ATOM',
    'cosmos_eur': 'ATOM',
    'atom_eur': 'ATOM',
    'near': 'NEAR',
    'near_eur': 'NEAR',
    'sui': 'SUI',
    'sui_eur': 'SUI',
    'arbitrum': 'ARB',
    'arbitrum_eur': 'ARB',
    'arb_eur': 'ARB',
    'optimism': 'OP',
    'optimism_eur': 'OP',
    'op_eur': 'OP',
    'pepe': 'PEPE',
    'pepe_eur': 'PEPE',
    'gala': 'GALA',
    'gala_eur': 'GALA',
    'uniswap': 'UNI',
    'uniswap_eur': 'UNI',
    'sand': 'SAND',
    'mana': 'MANA',
    'aave': 'AAVE',
    'maker': 'MKR',
    'compound': 'COMP',
    'curve': 'CRV',
    'fetchai': 'FET',
    'filecoin': 'FIL',
    'graph': 'GRT',
    'immutablex': 'IMX',
    'lido': 'LDO',
    'sei': 'SEI',
    'synthetix': 'SNX',
    'toncoin': 'TON',
    'usdcoin': 'USDC',
    'usdc': 'USDC',
    'eos': 'EOS',
    'etc': 'ETC',
    'flow': 'FLOW',
    'render': 'RENDER',
    'polpolygon': 'POL',
    'pol_polygon': 'POL',
    'polygon': 'MATIC',
    'internetcomputer': 'ICP',
    'aptos': 'APT',
    'injective': 'INJ',
    'algorand': 'ALGO',
    'vechain': 'VET',
    'arweave': 'AR',
    'floki': 'FLOKI',
    'bonk': 'BONK',
    'axs': 'AXS',
    'enj': 'ENJ'
};

function getBaseCurrency(symbol) {
    const symbolLower = symbol.toLowerCase();
    
    if (BASE_CURRENCY_MAP[symbolLower]) {
        return BASE_CURRENCY_MAP[symbolLower];
    }
    
    let base = symbolLower
        .replace(/_usdt$/, '')
        .replace(/_eur$/, '')
        .replace(/usdt$/, '')
        .replace(/eur$/, '')
        .replace(/_/g, '');
    
    const normalizations = {
        'avax': 'AVAX',
        'avalanche': 'AVAX',
        'binancecoin': 'BNB',
        'binance_coin': 'BNB',
        'internetcomputer': 'ICP',
        'toncoin': 'TON',
        'usdcoin': 'USDC',
        'polpolygon': 'POL',
        'pol_polygon': 'POL',
        'polygon': 'MATIC',
        'matic': 'MATIC',
        'shibainu': 'SHIB',
        'shiba': 'SHIB',
        'dogecoin': 'DOGE',
        'ripple': 'XRP',
        'tron': 'TRX',
        'stellar': 'XLM',
        'cosmos': 'ATOM',
        'arbitrum': 'ARB',
        'optimism': 'OP',
        'fetchai': 'FET',
        'immutablex': 'IMX',
        'synthetix': 'SNX',
        'vechain': 'VET',
        'arweave': 'AR'
    };
    
    if (normalizations[base]) {
        return normalizations[base];
    }
    
    return base.toUpperCase();
}

function getQuoteCurrency(symbol) {
    const symbolLower = symbol.toLowerCase();
    
    if (symbolLower.includes('_eur') || symbolLower.endsWith('eur')) {
        return 'EUR';
    }
    if (symbolLower.includes('_usdt') || symbolLower.endsWith('usdt')) {
        return 'USDT';
    }
    if (symbolLower.includes('_usdc') || symbolLower.endsWith('usdc')) {
        return 'USDC';
    }
    
    return 'USDT';
}

function formatSymbol(symbol) {
    // Formatta per display: SAND/USDT, BTC/EUR, ecc.
    const quote = getQuoteCurrency(symbol);
    const base = getBaseCurrency(symbol);
    return `${base}/${quote}`;
}

async function generateSymbolsHTML() {
    console.log('📊 Generazione tabella HTML simboli...');
    console.log('');

    try {
        // 1. Recupera tutti i simboli
        const allSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1 ORDER BY symbol",
            ['RSI_Strategy']
        );

        // 2. Raggruppa per base currency
        const grouped = {};
        
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const base = getBaseCurrency(symbol);
            const quote = getQuoteCurrency(symbol);
            
            if (!grouped[base]) {
                grouped[base] = {
                    base: base,
                    variants: []
                };
            }
            
            // Verifica klines
            const klines = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                [symbol]
            );
            const klinesCount = parseInt(klines[0]?.count || 0);
            
            // Verifica bot attivo
            const botSettings = await dbAll(
                "SELECT is_active FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
                [symbol, 'RSI_Strategy']
            );
            const isActive = botSettings.length > 0 && botSettings[0].is_active === 1;
            
            grouped[base].variants.push({
                symbol: symbol,
                quote: quote,
                klines: klinesCount,
                active: isActive,
                formatted: formatSymbol(symbol)
            });
        }

        // 3. Ordina per base currency
        const sortedBases = Object.keys(grouped).sort();
        
        // 4. Calcola statistiche
        let totalSymbols = 0;
        let totalActive = 0;
        let totalWithKlines = 0;
        const byQuote = { 'USDT': 0, 'EUR': 0, 'USDC': 0, 'OTHER': 0 };
        
        for (const base of sortedBases) {
            const group = grouped[base];
            totalSymbols += group.variants.length;
            
            group.variants.forEach(v => {
                if (v.active) totalActive++;
                if (v.klines >= 50) totalWithKlines++;
                byQuote[v.quote] = (byQuote[v.quote] || 0) + 1;
            });
        }

        // 5. Genera HTML
        let html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tabella Simboli Crypto - Raggruppati per Base Currency</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .stat-card h3 {
            color: #667eea;
            font-size: 2em;
            margin-bottom: 5px;
        }
        
        .stat-card p {
            color: #666;
            font-size: 0.9em;
        }
        
        .table-container {
            padding: 30px;
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 1.1em;
        }
        
        tbody tr {
            border-bottom: 1px solid #e0e0e0;
            transition: background 0.2s;
        }
        
        tbody tr:hover {
            background: #f5f5f5;
        }
        
        tbody tr.group-header {
            background: #f8f9fa;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        td {
            padding: 15px;
        }
        
        .symbol-cell {
            font-weight: 600;
            color: #667eea;
        }
        
        .quote-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .badge-usdt {
            background: #4CAF50;
            color: white;
        }
        
        .badge-eur {
            background: #2196F3;
            color: white;
        }
        
        .badge-usdc {
            background: #FF9800;
            color: white;
        }
        
        .status-active {
            color: #4CAF50;
            font-weight: 600;
        }
        
        .status-inactive {
            color: #f44336;
            font-weight: 600;
        }
        
        .klines-good {
            color: #4CAF50;
            font-weight: 600;
        }
        
        .klines-warning {
            color: #FF9800;
            font-weight: 600;
        }
        
        .klines-bad {
            color: #f44336;
            font-weight: 600;
        }
        
        .footer {
            padding: 20px;
            text-align: center;
            background: #f8f9fa;
            color: #666;
            font-size: 0.9em;
        }
        
        @media print {
            body {
                background: white;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Tabella Simboli Crypto</h1>
            <p>Raggruppati per Base Currency</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>${sortedBases.length}</h3>
                <p>Base Currencies</p>
            </div>
            <div class="stat-card">
                <h3>${totalSymbols}</h3>
                <p>Simboli Totali</p>
            </div>
            <div class="stat-card">
                <h3>${totalActive}</h3>
                <p>Bot Attivi</p>
            </div>
            <div class="stat-card">
                <h3>${totalWithKlines}</h3>
                <p>Con Klines Sufficienti</p>
            </div>
            <div class="stat-card">
                <h3>${byQuote.USDT}</h3>
                <p>USDT Pairs</p>
            </div>
            <div class="stat-card">
                <h3>${byQuote.EUR}</h3>
                <p>EUR Pairs</p>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Base Currency</th>
                        <th>Simbolo</th>
                        <th>Quote</th>
                        <th>Status Bot</th>
                        <th>Klines</th>
                        <th>Status Klines</th>
                    </tr>
                </thead>
                <tbody>`;

        // Genera righe tabella
        for (const base of sortedBases) {
            const group = grouped[base];
            const variants = group.variants.sort((a, b) => {
                const order = { 'USDT': 1, 'EUR': 2, 'USDC': 3 };
                return (order[a.quote] || 99) - (order[b.quote] || 99);
            });
            
            // Riga header gruppo
            html += `
                    <tr class="group-header">
                        <td colspan="6">📌 ${base}</td>
                    </tr>`;
            
            // Righe simboli
            for (const v of variants) {
                const klinesClass = v.klines >= 100 ? 'klines-good' : v.klines >= 50 ? 'klines-warning' : 'klines-bad';
                const klinesStatus = v.klines >= 100 ? '✅' : v.klines >= 50 ? '⚠️' : '❌';
                const badgeClass = `badge-${v.quote.toLowerCase()}`;
                
                html += `
                    <tr>
                        <td></td>
                        <td class="symbol-cell">${v.formatted}</td>
                        <td><span class="quote-badge ${badgeClass}">${v.quote}</span></td>
                        <td class="${v.active ? 'status-active' : 'status-inactive'}">${v.active ? '✅ Attivo' : '⏸️ Pausa'}</td>
                        <td>${v.klines}</td>
                        <td class="${klinesClass}">${klinesStatus}</td>
                    </tr>`;
            }
        }

        html += `
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Generato il ${new Date().toLocaleString('it-IT')} | TicketApp Crypto Dashboard</p>
        </div>
    </div>
</body>
</html>`;

        // 6. Salva file HTML (sia in backend che in frontend/public per accesso web)
        const backendPath = path.join(__dirname, 'symbols_table.html');
        const frontendPath = path.join(__dirname, '..', 'frontend', 'public', 'symbols_table.html');
        
        fs.writeFileSync(backendPath, html, 'utf8');
        console.log('✅ File HTML generato in backend!');
        console.log(`📄 Percorso backend: ${backendPath}`);
        
        // Salva anche in frontend/public se la directory esiste
        try {
            const frontendPublicDir = path.join(__dirname, '..', 'frontend', 'public');
            if (fs.existsSync(frontendPublicDir)) {
                fs.writeFileSync(frontendPath, html, 'utf8');
                console.log('✅ File HTML copiato in frontend/public!');
                console.log(`📄 Percorso frontend: ${frontendPath}`);
                console.log(`🌐 Accessibile via web: http://ticket.logikaservice.it/symbols_table.html`);
            }
        } catch (err) {
            console.log('⚠️ Impossibile salvare in frontend/public (continua...)');
        }
        console.log('');
        console.log('📊 Statistiche:');
        console.log(`   Base currencies: ${sortedBases.length}`);
        console.log(`   Simboli totali: ${totalSymbols}`);
        console.log(`   Bot attivi: ${totalActive}`);
        console.log(`   Con klines sufficienti: ${totalWithKlines}`);
        console.log(`   USDT: ${byQuote.USDT} | EUR: ${byQuote.EUR}`);
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante generazione HTML:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

generateSymbolsHTML().catch(console.error);

