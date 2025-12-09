/**
 * Calcolo Performance Reale con Capitale $1,080
 * Analisi mese per mese e totale composto
 */

// Dati dai backtest
const results60d = {
    'Ethereum': { return: 2.68, winRate: 46.3, trades: 54 },
    'Polkadot': { return: 0.94, winRate: 41.9, trades: 74 },
    'Bitcoin': { return: 0.91, winRate: 45.7, trades: 35 },
    'Litecoin': { return: 0.84, winRate: 43.3, trades: 67 },
    'Solana': { return: 0.48, winRate: 36.7, trades: 60 },
    'Dogecoin': { return: -0.04, winRate: 33.3, trades: 63 },
    'XRP': { return: -0.70, winRate: 39.3, trades: 61 },
    'Cardano': { return: -0.83, winRate: 44.4, trades: 63 },
    'Chainlink': { return: -3.86, winRate: 36.7, trades: 79 }
};

const INITIAL_CAPITAL = 1080;

console.log('\n💰 ANALISI PERFORMANCE REALE - CAPITALE INIZIALE: $1,080\n');
console.log('='.repeat(80));

// Scenario 1: Portfolio Equamente Distribuito (tutti i 9 asset)
console.log('\n📊 SCENARIO 1: Portfolio Equamente Distribuito (9 asset)');
console.log('─'.repeat(80));
console.log('Allocazione: $120 per asset\n');

let totalReturn1 = 0;
let capitalPerAsset = INITIAL_CAPITAL / 9;

console.log('Asset          | Capitale | Return  | Profitto/Perdita | Capitale Finale');
console.log('-'.repeat(80));

Object.entries(results60d).forEach(([asset, data]) => {
    const profit = capitalPerAsset * (data.return / 100);
    const finalCapital = capitalPerAsset + profit;
    totalReturn1 += profit;

    const profitStr = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
    console.log(
        `${asset.padEnd(14)} | $${capitalPerAsset.toFixed(2).padStart(6)} | ${(data.return >= 0 ? '+' : '') + data.return.toFixed(2).padStart(6)}% | ${profitStr.padStart(16)} | $${finalCapital.toFixed(2)}`
    );
});

const finalCapital1 = INITIAL_CAPITAL + totalReturn1;
const totalReturnPct1 = (totalReturn1 / INITIAL_CAPITAL) * 100;

console.log('-'.repeat(80));
console.log(`TOTALE         | $${INITIAL_CAPITAL.toFixed(2).padStart(6)} |         | ${(totalReturn1 >= 0 ? '+' : '') + '$' + totalReturn1.toFixed(2).padStart(15)} | $${finalCapital1.toFixed(2)}`);
console.log(`\n📈 Rendimento Totale: ${totalReturnPct1 >= 0 ? '+' : ''}${totalReturnPct1.toFixed(2)}%`);
console.log(`💵 Capitale Finale: $${finalCapital1.toFixed(2)}`);

// Scenario 2: Portfolio Ottimizzato (solo top 3)
console.log('\n\n📊 SCENARIO 2: Portfolio Ottimizzato (Solo Top 3)');
console.log('─'.repeat(80));
console.log('Allocazione: Ethereum 50%, Bitcoin 30%, Polkadot 20%\n');

const optimizedAllocation = {
    'Ethereum': 0.50,
    'Bitcoin': 0.30,
    'Polkadot': 0.20
};

let totalReturn2 = 0;

console.log('Asset          | Allocazione | Capitale | Return  | Profitto/Perdita | Capitale Finale');
console.log('-'.repeat(90));

Object.entries(optimizedAllocation).forEach(([asset, allocation]) => {
    const capital = INITIAL_CAPITAL * allocation;
    const returnPct = results60d[asset].return;
    const profit = capital * (returnPct / 100);
    const finalCapital = capital + profit;
    totalReturn2 += profit;

    const profitStr = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
    console.log(
        `${asset.padEnd(14)} | ${(allocation * 100).toFixed(0).padStart(10)}% | $${capital.toFixed(2).padStart(6)} | ${(returnPct >= 0 ? '+' : '') + returnPct.toFixed(2).padStart(6)}% | ${profitStr.padStart(16)} | $${finalCapital.toFixed(2)}`
    );
});

const finalCapital2 = INITIAL_CAPITAL + totalReturn2;
const totalReturnPct2 = (totalReturn2 / INITIAL_CAPITAL) * 100;

console.log('-'.repeat(90));
console.log(`TOTALE         |        100% | $${INITIAL_CAPITAL.toFixed(2).padStart(6)} |         | ${(totalReturn2 >= 0 ? '+' : '') + '$' + totalReturn2.toFixed(2).padStart(15)} | $${finalCapital2.toFixed(2)}`);
console.log(`\n📈 Rendimento Totale: ${totalReturnPct2 >= 0 ? '+' : ''}${totalReturnPct2.toFixed(2)}%`);
console.log(`💵 Capitale Finale: $${finalCapital2.toFixed(2)}`);

// Scenario 3: Solo Ethereum (massima concentrazione)
console.log('\n\n📊 SCENARIO 3: Massima Concentrazione (100% Ethereum)');
console.log('─'.repeat(80));

const ethReturn = results60d['Ethereum'].return;
const ethProfit = INITIAL_CAPITAL * (ethReturn / 100);
const ethFinalCapital = INITIAL_CAPITAL + ethProfit;

console.log(`Capitale Iniziale: $${INITIAL_CAPITAL.toFixed(2)}`);
console.log(`Return Ethereum: ${ethReturn >= 0 ? '+' : ''}${ethReturn.toFixed(2)}%`);
console.log(`Profitto: ${ethProfit >= 0 ? '+' : ''}$${ethProfit.toFixed(2)}`);
console.log(`Capitale Finale: $${ethFinalCapital.toFixed(2)}`);

// Proiezione mensile (assumendo rendimenti costanti)
console.log('\n\n📅 PROIEZIONE MENSILE (60 giorni = 2 mesi)');
console.log('─'.repeat(80));
console.log('Assumendo rendimenti costanti e reinvestimento profitti (compound)\n');

const monthlyReturnPct = ethReturn / 2; // Dividi per 2 mesi

console.log('ETHEREUM (100% allocazione):');
console.log(`Mese 1: $${INITIAL_CAPITAL.toFixed(2)} → ${monthlyReturnPct >= 0 ? '+' : ''}${monthlyReturnPct.toFixed(2)}% → $${(INITIAL_CAPITAL * (1 + monthlyReturnPct / 100)).toFixed(2)}`);

const month1Capital = INITIAL_CAPITAL * (1 + monthlyReturnPct / 100);
console.log(`Mese 2: $${month1Capital.toFixed(2)} → ${monthlyReturnPct >= 0 ? '+' : ''}${monthlyReturnPct.toFixed(2)}% → $${ethFinalCapital.toFixed(2)}`);

// Confronto scenari
console.log('\n\n🏆 CONFRONTO SCENARI (2 mesi)');
console.log('='.repeat(80));

const scenarios = [
    { name: 'Scenario 1: Tutti i 9 asset', initial: INITIAL_CAPITAL, final: finalCapital1, return: totalReturnPct1 },
    { name: 'Scenario 2: Top 3 ottimizzato', initial: INITIAL_CAPITAL, final: finalCapital2, return: totalReturnPct2 },
    { name: 'Scenario 3: 100% Ethereum', initial: INITIAL_CAPITAL, final: ethFinalCapital, return: ethReturn }
];

scenarios.sort((a, b) => b.return - a.return);

console.log('\nRanking per Performance:\n');
scenarios.forEach((s, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
    const profit = s.final - s.initial;
    console.log(`${medal} ${s.name}`);
    console.log(`   Capitale Iniziale: $${s.initial.toFixed(2)}`);
    console.log(`   Capitale Finale: $${s.final.toFixed(2)}`);
    console.log(`   Profitto/Perdita: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`);
    console.log(`   Return: ${s.return >= 0 ? '+' : ''}${s.return.toFixed(2)}%\n`);
});

// Proiezione annuale
console.log('\n📊 PROIEZIONE ANNUALE (Ipotetica)');
console.log('─'.repeat(80));
console.log('⚠️  ATTENZIONE: Questa è una proiezione teorica, non una garanzia!\n');

const annualReturnEth = Math.pow(1 + ethReturn / 100, 6) - 1; // 6 periodi di 2 mesi
const annualCapitalEth = INITIAL_CAPITAL * (1 + annualReturnEth);

console.log(`Se il rendimento di Ethereum si mantenesse costante per 12 mesi:`);
console.log(`Return Annuale: ${annualReturnEth >= 0 ? '+' : ''}${(annualReturnEth * 100).toFixed(2)}%`);
console.log(`Capitale dopo 12 mesi: $${annualCapitalEth.toFixed(2)}`);
console.log(`Profitto totale: ${(annualCapitalEth - INITIAL_CAPITAL) >= 0 ? '+' : ''}$${(annualCapitalEth - INITIAL_CAPITAL).toFixed(2)}`);

console.log('\n' + '='.repeat(80));
console.log('✅ Analisi completata!\n');
