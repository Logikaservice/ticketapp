/**
 * Binance API Client
 * Supporta sia Testnet (per test) che Mainnet (produzione)
 * Con gestione errori, retry logic e rate limiting
 */

const crypto = require('crypto');
const https = require('https');

class BinanceClient {
    constructor(config = {}) {
        // Modalità: 'demo' (simulazione), 'testnet' (Binance Testnet), 'live' (produzione)
        this.mode = config.mode || process.env.BINANCE_MODE || 'demo';
        
        // API Configuration
        this.apiKey = config.apiKey || process.env.BINANCE_API_KEY || '';
        this.apiSecret = config.apiSecret || process.env.BINANCE_API_SECRET || '';
        
        // Base URLs
        this.testnetBaseUrl = 'https://testnet.binance.vision';
        this.mainnetBaseUrl = 'https://api.binance.com';
        
        // Rate limiting
        this.rateLimits = {
            orders: { count: 0, resetTime: Date.now() + 60000 }, // 10 ordini/secondo
            requests: { count: 0, resetTime: Date.now() + 1000 }  // 1200 requests/minuto
        };
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000, // 1 secondo
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
        };
    }

    /**
     * Get base URL based on mode
     */
    getBaseUrl() {
        if (this.mode === 'testnet') {
            return this.testnetBaseUrl;
        } else if (this.mode === 'live') {
            return this.mainnetBaseUrl;
        }
        return null; // Demo mode doesn't use real API
    }

    /**
     * Rate limiting check
     */
    async checkRateLimit(type = 'requests') {
        const now = Date.now();
        const limit = this.rateLimits[type];

        if (now > limit.resetTime) {
            limit.count = 0;
            limit.resetTime = now + (type === 'orders' ? 60000 : 1000);
        }

        const maxCount = type === 'orders' ? 10 : 20;
        if (limit.count >= maxCount) {
            const waitTime = limit.resetTime - now;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            limit.count = 0;
            limit.resetTime = Date.now() + (type === 'orders' ? 60000 : 1000);
        }

        limit.count++;
    }

    /**
     * Generate signature for authenticated requests
     */
    generateSignature(queryString) {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * Make HTTPS request with retry logic
     */
    async makeRequest(method, endpoint, params = {}, authenticated = false) {
        if (this.mode === 'demo') {
            throw new Error('Binance API non disponibile in modalità DEMO. Usa TESTNET o LIVE.');
        }

        await this.checkRateLimit(authenticated ? 'orders' : 'requests');

        const baseUrl = this.getBaseUrl();
        if (!baseUrl) {
            throw new Error('Modalità Binance non valida');
        }

        // Build query string
        let queryString = '';
        if (method === 'GET' && Object.keys(params).length > 0) {
            queryString = new URLSearchParams(params).toString();
        }

        // Add signature if authenticated
        if (authenticated) {
            if (!this.apiKey || !this.apiSecret) {
                throw new Error('API Key o Secret mancanti per richieste autenticate');
            }
            
            // Add timestamp
            params.timestamp = Date.now();
            queryString = new URLSearchParams(params).toString();
            
            // Generate signature
            const signature = this.generateSignature(queryString);
            queryString += `&signature=${signature}`;
        }

        const url = `${baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (authenticated) {
            options.headers['X-MBX-APIKEY'] = this.apiKey;
        }

        // Retry logic
        let lastError;
        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    console.log(`🔄 Retry attempt ${attempt} per ${endpoint}`);
                }

                const result = await this.executeRequest(options, method === 'POST' ? JSON.stringify(params) : null);
                return result;
            } catch (error) {
                lastError = error;
                
                // Check if error is retryable
                const isRetryable = this.retryConfig.retryableErrors.some(
                    errCode => error.code === errCode || error.message.includes(errCode)
                );

                if (!isRetryable || attempt === this.retryConfig.maxRetries) {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * Execute HTTP request
     */
    executeRequest(options, postData = null) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            const errorMessage = parsed.msg || parsed.error || `HTTP ${res.statusCode}: ${data.substring(0, 200)}`;
                            const error = new Error(errorMessage);
                            error.statusCode = res.statusCode;
                            error.code = parsed.code;
                            error.response = parsed; // Include full response for debugging
                            console.error(`❌ Binance API Error (${res.statusCode}):`, errorMessage);
                            console.error('❌ Full response:', JSON.stringify(parsed, null, 2));
                            reject(error);
                        }
                    } catch (e) {
                        const error = new Error(`Invalid JSON response: ${data.substring(0, 500)}`);
                        error.rawResponse = data;
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (postData) {
                req.write(postData);
            }

            req.end();
        });
    }

    /**
     * Get account balance
     */
    async getBalance(symbol = null) {
        try {
            const account = await this.makeRequest('GET', '/api/v3/account', {}, true);
            
            if (symbol) {
                const asset = account.balances.find(b => b.asset === symbol.toUpperCase());
                return asset ? {
                    asset: asset.asset,
                    free: parseFloat(asset.free),
                    locked: parseFloat(asset.locked),
                    total: parseFloat(asset.free) + parseFloat(asset.locked)
                } : null;
            }

            // Return all balances (filter out zeros)
            return account.balances
                .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
                .map(b => ({
                    asset: b.asset,
                    free: parseFloat(b.free),
                    locked: parseFloat(b.locked),
                    total: parseFloat(b.free) + parseFloat(b.locked)
                }));
        } catch (error) {
            console.error('❌ Errore getBalance Binance:', error.message);
            throw error;
        }
    }

    /**
     * Get current price for a symbol
     */
    async getPrice(symbol) {
        try {
            const ticker = await this.makeRequest('GET', '/api/v3/ticker/price', { symbol: symbol.toUpperCase() });
            return {
                symbol: ticker.symbol,
                price: parseFloat(ticker.price)
            };
        } catch (error) {
            console.error(`❌ Errore getPrice per ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Place market order
     */
    async placeMarketOrder(symbol, side, quantity) {
        try {
            const params = {
                symbol: symbol.toUpperCase(),
                side: side.toUpperCase(), // BUY or SELL
                type: 'MARKET',
                quantity: quantity.toString()
            };

            const order = await this.makeRequest('POST', '/api/v3/order', params, true);
            return {
                orderId: order.orderId,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                quantity: parseFloat(order.executedQty),
                price: parseFloat(order.fills?.[0]?.price || 0),
                status: order.status,
                fills: order.fills?.map(f => ({
                    price: parseFloat(f.price),
                    qty: parseFloat(f.qty),
                    commission: parseFloat(f.commission),
                    commissionAsset: f.commissionAsset
                })) || []
            };
        } catch (error) {
            console.error('❌ Errore placeMarketOrder:', error.message);
            throw error;
        }
    }

    /**
     * Place limit order
     */
    async placeLimitOrder(symbol, side, quantity, price) {
        try {
            const params = {
                symbol: symbol.toUpperCase(),
                side: side.toUpperCase(),
                type: 'LIMIT',
                timeInForce: 'GTC', // Good Till Cancel
                quantity: quantity.toString(),
                price: price.toString()
            };

            const order = await this.makeRequest('POST', '/api/v3/order', params, true);
            return {
                orderId: order.orderId,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                quantity: parseFloat(order.origQty),
                price: parseFloat(order.price),
                status: order.status
            };
        } catch (error) {
            console.error('❌ Errore placeLimitOrder:', error.message);
            throw error;
        }
    }

    /**
     * Place stop-loss order
     */
    async placeStopLossOrder(symbol, side, quantity, stopPrice) {
        try {
            const params = {
                symbol: symbol.toUpperCase(),
                side: side.toUpperCase(),
                type: 'STOP_LOSS',
                quantity: quantity.toString(),
                stopPrice: stopPrice.toString(),
                timeInForce: 'GTC'
            };

            const order = await this.makeRequest('POST', '/api/v3/order', params, true);
            return {
                orderId: order.orderId,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                quantity: parseFloat(order.origQty),
                stopPrice: parseFloat(order.stopPrice),
                status: order.status
            };
        } catch (error) {
            console.error('❌ Errore placeStopLossOrder:', error.message);
            throw error;
        }
    }

    /**
     * Get order history
     */
    async getOrderHistory(symbol = null, limit = 50) {
        try {
            const params = { limit };
            if (symbol) {
                params.symbol = symbol.toUpperCase();
            }

            const orders = await this.makeRequest('GET', '/api/v3/allOrders', params, true);
            return orders.map(order => ({
                orderId: order.orderId,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                quantity: parseFloat(order.origQty),
                executedQty: parseFloat(order.executedQty),
                price: parseFloat(order.price),
                stopPrice: order.stopPrice ? parseFloat(order.stopPrice) : null,
                status: order.status,
                timeInForce: order.timeInForce,
                timestamp: order.time,
                updateTime: order.updateTime
            }));
        } catch (error) {
            console.error('❌ Errore getOrderHistory:', error.message);
            throw error;
        }
    }

    /**
     * Cancel order
     */
    async cancelOrder(symbol, orderId) {
        try {
            const params = {
                symbol: symbol.toUpperCase(),
                orderId: orderId
            };

            const result = await this.makeRequest('DELETE', '/api/v3/order', params, true);
            return {
                orderId: result.orderId,
                symbol: result.symbol,
                status: result.status
            };
        } catch (error) {
            console.error('❌ Errore cancelOrder:', error.message);
            throw error;
        }
    }
}

module.exports = BinanceClient;

