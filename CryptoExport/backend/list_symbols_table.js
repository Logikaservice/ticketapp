/**
 * 📊 Script per Generare Tabella Simboli Raggruppati per Base Currency
 * 
 * Mostra tutti i simboli nel database raggruppati per base currency (BTC, ETH, ecc.)
 * e mostra tutte le varianti disponibili (USDT, EUR, ecc.)
 */

const { dbAll } = require('./crypto_db');

// Mappa per normalizzare nomi base currency
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
    'arweave': 'AR',
    'floki': 'FLOKI',
    'bonk': 'BONK',
    'axs': 'AXS',
    'enj': 'ENJ'
};

function getBaseCurrency(symbol) {
    const symbolLower = symbol.toLowerCase();
    
    // Prova mappa diretta
    if (BASE_CURRENCY_MAP[symbolLower]) {
        return BASE_CURRENCY_MAP[symbolLower];
    }
    
    // Rimuovi suffissi comuni
    let base = symbolLower
        .replace(/_usdt$/, '')
        .replace(/_eur$/, '')
        .replace(/usdt$/, '')
        .replace(/eur$/, '')
        .replace(/_/g, '');
    
    // Normalizza alcuni nomi comuni
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
        'arweave': 'AR'
    };
    
    if (normalizations[base]) {
        return normalizations[base];
    }
    
    // Fallback: prima lettera maiuscola
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
    
    // Default: USDT
    return 'USDT';
}

async function listSymbolsTable() {
    console.log('📊 TABELLA SIMBOLI RAGGRUPPATI PER BASE CURRENCY');
    console.log('='.repeat(100));
    console.log('');

    try {
        // 1. Recupera tutti i simboli da bot_settings
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
            
            // Verifica klines disponibili
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
                active: isActive
            });
        }

        // 3. Ordina per base currency
        const sortedBases = Object.keys(grouped).sort();
        
        // 4. Genera tabella
        console.log('BASE CURRENCY | SIMBOLI DISPONIBILI');
        console.log('-'.repeat(100));
        console.log('');

        for (const base of sortedBases) {
            const group = grouped[base];
            const variants = group.variants.sort((a, b) => {
                // Ordina: USDT prima, poi EUR, poi altri
                const order = { 'USDT': 1, 'EUR': 2, 'USDC': 3 };
                return (order[a.quote] || 99) - (order[b.quote] || 99);
            });
            
            console.log(`📌 ${base}:`);
            
            // Crea riga con tutte le varianti
            const variantStrings = variants.map(v => {
                const status = v.active ? '✅' : '⏸️';
                const klinesStatus = v.klines >= 100 ? '✅' : v.klines >= 50 ? '⚠️' : '❌';
                return `${v.symbol} (${v.quote}) ${status} [${v.klines} klines ${klinesStatus}]`;
            });
            
            // Mostra in formato tabella
            console.log(`   ${variantStrings.join(' | ')}`);
            console.log('');
        }

        // 5. Statistiche
        console.log('='.repeat(100));
        console.log('📊 STATISTICHE');
        console.log('='.repeat(100));
        console.log('');
        
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
        
        console.log(`📊 Base currencies: ${sortedBases.length}`);
        console.log(`📊 Simboli totali: ${totalSymbols}`);
        console.log(`✅ Bot attivi: ${totalActive}`);
        console.log(`📈 Con klines sufficienti: ${totalWithKlines}`);
        console.log('');
        console.log('📊 Distribuzione per quote currency:');
        console.log(`   USDT: ${byQuote.USDT}`);
        console.log(`   EUR: ${byQuote.EUR}`);
        console.log(`   USDC: ${byQuote.USDC || 0}`);
        console.log(`   Altri: ${byQuote.OTHER || 0}`);
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante generazione tabella:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

listSymbolsTable().catch(console.error);

