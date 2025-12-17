const https = require('https');

function httpsGet(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errorData.substring(0, 200)}`)));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error(`Request timeout after ${timeout}ms`)); });
        req.end();
    });
}

async function getPriceByPair(tradingPair) {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
    const data = await httpsGet(url);
    if (!data || !data.price) throw new Error('Invalid data from Binance');
    return parseFloat(data.price);
}

async function get24hVolumeByPair(tradingPair, timeoutMs = 15000) {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${tradingPair}`;
    const data = await httpsGet(url, timeoutMs);
    if (!data || typeof data.quoteVolume === 'undefined') throw new Error('Invalid data from Binance');
    return parseFloat(data.quoteVolume);
}

async function getKlinesByPair(tradingPair, interval = '15m', limit = 500, timeoutMs = 15000) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${interval}&limit=${limit}`;
    const data = await httpsGet(url, timeoutMs);
    if (!Array.isArray(data)) throw new Error('Invalid klines data from Binance');
    return data.map(item => ({
        openTime: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        closeTime: item[6],
    }));
}

module.exports = {
    httpsGet,
    getPriceByPair,
    get24hVolumeByPair,
    getKlinesByPair,
};
