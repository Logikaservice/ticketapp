const { getBinanceClient } = require('../utils/binanceConfig');

/**
 * Get price by trading pair (e.g., 'BTCUSDT')
 * Uses binanceClient which respects BINANCE_MODE (testnet/live)
 */
async function getPriceByPair(tradingPair) {
    try {
        const client = getBinanceClient();
        const result = await client.getPrice(tradingPair);
        return result.price;
    } catch (error) {
        // Fallback to mainnet for backward compatibility if in demo mode
        if (process.env.BINANCE_MODE === 'demo') {
            const https = require('https');
            const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
            const data = await new Promise((resolve, reject) => {
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
                req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
                req.end();
            });
            if (!data || !data.price) throw new Error('Invalid data from Binance');
            return parseFloat(data.price);
        }
        throw error;
    }
}

/**
 * Get 24h volume by trading pair
 * Uses binanceClient which respects BINANCE_MODE (testnet/live)
 */
async function get24hVolumeByPair(tradingPair, timeoutMs = 15000) {
    try {
        const client = getBinanceClient();
        const volume = await client.get24hVolume(tradingPair);
        return volume;
    } catch (error) {
        // Fallback to mainnet for backward compatibility if in demo mode
        if (process.env.BINANCE_MODE === 'demo') {
            const https = require('https');
            const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${tradingPair}`;
            const data = await new Promise((resolve, reject) => {
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
                req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Request timeout after ${timeoutMs}ms`)); });
                req.end();
            });
            if (!data || typeof data.quoteVolume === 'undefined') throw new Error('Invalid data from Binance');
            return parseFloat(data.quoteVolume);
        }
        throw error;
    }
}

/**
 * Get klines (candlestick data) by trading pair
 * Uses binanceClient which respects BINANCE_MODE (testnet/live)
 */
async function getKlinesByPair(tradingPair, interval = '15m', limit = 500, timeoutMs = 15000) {
    try {
        const client = getBinanceClient();
        const klines = await client.getKlines(tradingPair, interval, limit);
        return klines.map(item => ({
            openTime: item.openTime,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
            closeTime: item.closeTime,
        }));
    } catch (error) {
        // Fallback to mainnet for backward compatibility if in demo mode
        if (process.env.BINANCE_MODE === 'demo') {
            const https = require('https');
            const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${interval}&limit=${limit}`;
            const data = await new Promise((resolve, reject) => {
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
                req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Request timeout after ${timeoutMs}ms`)); });
                req.end();
            });
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
        throw error;
    }
}

// Keep httpsGet for backward compatibility (used by other files)
function httpsGet(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const https = require('https');
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

module.exports = {
    httpsGet,
    getPriceByPair,
    get24hVolumeByPair,
    getKlinesByPair,
};
