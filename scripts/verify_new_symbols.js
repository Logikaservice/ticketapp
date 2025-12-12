const https = require('https');

// Nuovi simboli da verificare
const NEW_SYMBOLS_TO_CHECK = {
    // Stablecoins
    'dai': 'DAIUSDT',
    'dai_eur': 'DAIEUR',
    'usdc': 'USDCUSDT',
    'usdc_eur': 'USDCEUR',

    // Layer 1 Emergenti
    'sui': 'SUIUSDT',
    'sui_eur': 'SUIEUR',
    'apt': 'APTUSDT',
    'apt_eur': 'APTEUR',
    'sei': 'SEIUSDT',
    'sei_eur': 'SEIEUR',
    'ton': 'TONUSDT',
    'ton_eur': 'TONEUR',
    'inj': 'INJUSDT',
    'inj_eur': 'INJEUR',

    // DeFi Popolari
    'mkr': 'MKRUSDT',
    'mkr_eur': 'MKREUR',
    'comp': 'COMPUSDT',
    'comp_eur': 'COMPEUR',
    'snx': 'SNXUSDT',
    'snx_eur': 'SNXEUR',

    // AI/Data
    'fet': 'FETUSDT',
    'fet_eur': 'FETEUR',
    'render': 'RENDERUSDT',
    'render_eur': 'RENDEREUR',
    'grt': 'GRTUSDT',
    'grt_eur': 'GRTEUR',

    // Gaming/Metaverse
    'imx': 'IMXUSDT',
    'imx_eur': 'IMXEUR',
    'gala': 'GALAUSDT',
    'gala_eur': 'GALAEUR',
    'enj': 'ENJUSDT',
    'enj_eur': 'ENJEUR',

    // Meme Coins Popolari
    'pepe': 'PEPEUSDT',
    'pepe_eur': 'PEPEEUR',
    'floki': 'FLOKIUSDT',
    'floki_eur': 'FLOKIEUR',
    'bonk': 'BONKUSDT',
    'bonk_eur': 'BONKEUR',

    // Altri Layer 1
    'algo': 'ALGOUSDT',
    'algo_eur': 'ALGOEUR',
    'vet': 'VETUSDT',
    'vet_eur': 'VETEUR',
    'icp': 'ICPUSDT',
    'icp_eur': 'ICPEUR',

    // Exchange Tokens
    'okb': 'OKBUSDT',
    'okb_eur': 'OKBEUR',

    // Storage/Infrastructure
    'ar': 'ARUSDT',
    'ar_eur': 'AREUR',

    // Privacy
    'xmr': 'XMRUSDT', // Potrebbe non essere disponibile
    'xmr_eur': 'XMREUR'
};

const checkSymbol = (symbol) => {
    return new Promise((resolve) => {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.symbol && parsed.lastPrice) {
                        const volume24h = parseFloat(parsed.quoteVolume);
                        const price = parseFloat(parsed.lastPrice);
                        resolve({
                            symbol,
                            available: true,
                            price,
                            volume24h,
                            priceChange24h: parseFloat(parsed.priceChangePercent)
                        });
                    } else {
                        resolve({ symbol, available: false, error: 'Invalid response' });
                    }
                } catch (e) {
                    resolve({ symbol, available: false, error: e.message });
                }
            });
        }).on('error', (err) => {
            resolve({ symbol, available: false, error: err.message });
        });
    });
};

const verifyAllSymbols = async () => {
    console.log('🔍 Verifying new symbols on Binance...\n');

    const results = {
        available: [],
        notAvailable: [],
        lowVolume: []
    };

    const MIN_VOLUME_24H = 100000; // Minimo €100k di volume giornaliero

    for (const [key, symbol] of Object.entries(NEW_SYMBOLS_TO_CHECK)) {
        const result = await checkSymbol(symbol);

        // Delay per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

        if (result.available) {
            if (result.volume24h >= MIN_VOLUME_24H) {
                results.available.push({ key, ...result });
                console.log(`✅ ${symbol.padEnd(15)} - Price: €${result.price.toFixed(6).padEnd(12)} | Volume: €${(result.volume24h / 1000000).toFixed(2)}M | Change: ${result.priceChange24h.toFixed(2)}%`);
            } else {
                results.lowVolume.push({ key, ...result });
                console.log(`⚠️  ${symbol.padEnd(15)} - Available but LOW VOLUME (€${(result.volume24h / 1000).toFixed(0)}k)`);
            }
        } else {
            results.notAvailable.push({ key, ...result });
            console.log(`❌ ${symbol.padEnd(15)} - NOT AVAILABLE`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Available with good volume: ${results.available.length}`);
    console.log(`⚠️  Available but low volume: ${results.lowVolume.length}`);
    console.log(`❌ Not available: ${results.notAvailable.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('📝 SYMBOLS TO ADD (Good Volume):');
    console.log('='.repeat(80));

    // Raggruppa per categoria
    const categories = {
        'Stablecoins': ['dai', 'usdc'],
        'Layer 1': ['sui', 'apt', 'sei', 'ton', 'inj', 'algo', 'vet', 'icp'],
        'DeFi': ['mkr', 'comp', 'snx'],
        'AI/Data': ['fet', 'render', 'grt'],
        'Gaming': ['imx', 'gala', 'enj'],
        'Meme': ['pepe', 'floki', 'bonk'],
        'Storage': ['ar'],
        'Exchange': ['okb']
    };

    for (const [category, symbols] of Object.entries(categories)) {
        const categorySymbols = results.available.filter(r =>
            symbols.some(s => r.key.startsWith(s))
        );

        if (categorySymbols.length > 0) {
            console.log(`\n${category}:`);
            categorySymbols.forEach(r => {
                console.log(`  '${r.key}': '${r.symbol}',`);
            });
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 RECOMMENDED ADDITIONS (Top 20 by Volume):');
    console.log('='.repeat(80));

    const top20 = results.available
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 20);

    top20.forEach((r, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${r.symbol.padEnd(15)} - Volume: €${(r.volume24h / 1000000).toFixed(2)}M`);
    });
};

verifyAllSymbols().catch(console.error);
