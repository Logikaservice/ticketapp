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
        let postBody = null;

        // Add signature if authenticated
        if (authenticated) {
            if (!this.apiKey || !this.apiSecret) {
                throw new Error('API Key o Secret mancanti per richieste autenticate');
            }
            
            // Add timestamp
            params.timestamp = Date.now();
            
            // For authenticated requests, parameters go in query string, not body
            queryString = new URLSearchParams(params).toString();
            
            // Generate signature
            const signature = this.generateSignature(queryString);
            queryString += `&signature=${signature}`;
            
            // Log parameters for debugging
            console.log(`📤 Binance POST Request (${endpoint}):`);
            console.log(`   Query string: ${queryString}`);
            console.log(`   Parameters count: ${Object.keys(params).length + 1} (params) + 1 (signature) = ${Object.keys(params).length + 2}`);
            
            // For POST authenticated requests, body should be empty
            postBody = null;
        } else {
            // For non-authenticated GET requests, params go in query string
            if (method === 'GET' && Object.keys(params).length > 0) {
                queryString = new URLSearchParams(params).toString();
            }
            // For non-authenticated POST requests, params can go in body as JSON
            if (method === 'POST' && Object.keys(params).length > 0) {
                postBody = JSON.stringify(params);
            }
        }

        const url = `${baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {}
        };

        // Set Content-Type header
        if (postBody) {
            options.headers['Content-Type'] = 'application/json';
        }

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

                const result = await this.executeRequest(options, postBody);
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
     * Get 24h ticker statistics for a symbol
     */
    async get24hTicker(symbol) {
        try {
            const ticker = await this.makeRequest('GET', '/api/v3/ticker/24hr', { symbol: symbol.toUpperCase() });
            return {
                symbol: ticker.symbol,
                priceChange: parseFloat(ticker.priceChange),
                priceChangePercent: parseFloat(ticker.priceChangePercent),
                weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
                prevClosePrice: parseFloat(ticker.prevClosePrice),
                lastPrice: parseFloat(ticker.lastPrice),
                bidPrice: parseFloat(ticker.bidPrice),
                askPrice: parseFloat(ticker.askPrice),
                openPrice: parseFloat(ticker.openPrice),
                highPrice: parseFloat(ticker.highPrice),
                lowPrice: parseFloat(ticker.lowPrice),
                volume: parseFloat(ticker.volume),
                quoteVolume: parseFloat(ticker.quoteVolume),
                openTime: ticker.openTime,
                closeTime: ticker.closeTime,
                count: ticker.count
            };
        } catch (error) {
            console.error(`❌ Errore get24hTicker per ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get 24h volume for a symbol (returns quoteVolume in USDT)
     */
    async get24hVolume(symbol) {
        try {
            const ticker = await this.get24hTicker(symbol);
            return ticker.quoteVolume;
        } catch (error) {
            console.error(`❌ Errore get24hVolume per ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get klines (candlestick data) for a symbol
     */
    async getKlines(symbol, interval = '15m', limit = 500, startTime = null, endTime = null) {
        try {
            const params = {
                symbol: symbol.toUpperCase(),
                interval: interval,
                limit: limit
            };

            if (startTime) {
                params.startTime = startTime;
            }
            if (endTime) {
                params.endTime = endTime;
            }

            const klines = await this.makeRequest('GET', '/api/v3/klines', params);
            
            return klines.map(item => ({
                openTime: item[0],
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5]),
                closeTime: item[6],
                quoteAssetVolume: parseFloat(item[7]),
                numberOfTrades: item[8],
                takerBuyBaseAssetVolume: parseFloat(item[9]),
                takerBuyQuoteAssetVolume: parseFloat(item[10])
            }));
        } catch (error) {
            console.error(`❌ Errore getKlines per ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Get exchange information (symbols, filters, etc.)
     */
    async getExchangeInfo() {
        try {
            const info = await this.makeRequest('GET', '/api/v3/exchangeInfo');
            return {
                timezone: info.timezone,
                serverTime: info.serverTime,
                rateLimits: info.rateLimits,
                exchangeFilters: info.exchangeFilters,
                symbols: info.symbols.map(s => ({
                    symbol: s.symbol,
                    status: s.status,
                    baseAsset: s.baseAsset,
                    baseAssetPrecision: s.baseAssetPrecision,
                    quoteAsset: s.quoteAsset,
                    quotePrecision: s.quotePrecision,
                    quoteAssetPrecision: s.quoteAssetPrecision,
                    orderTypes: s.orderTypes,
                    icebergAllowed: s.icebergAllowed,
                    ocoAllowed: s.ocoAllowed,
                    isSpotTradingAllowed: s.isSpotTradingAllowed,
                    isMarginTradingAllowed: s.isMarginTradingAllowed,
                    filters: s.filters,
                    permissions: s.permissions
                }))
            };
        } catch (error) {
            console.error('❌ Errore getExchangeInfo:', error.message);
            throw error;
        }
    }

    /**
     * Get symbol filters (LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL)
     */
    async getSymbolFilters(symbol) {
        try {
            const exchangeInfo = await this.getExchangeInfo();
            const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol.toUpperCase());
            
            if (!symbolInfo) {
                throw new Error(`Symbol ${symbol} not found in exchange info`);
            }

            const filters = {
                lotSize: symbolInfo.filters?.find(f => f.filterType === 'LOT_SIZE'),
                priceFilter: symbolInfo.filters?.find(f => f.filterType === 'PRICE_FILTER'),
                minNotional: symbolInfo.filters?.find(f => f.filterType === 'MIN_NOTIONAL')
            };

            return {
                minQty: parseFloat(filters.lotSize?.minQty || '0'),
                maxQty: parseFloat(filters.lotSize?.maxQty || '999999999'),
                stepSize: parseFloat(filters.lotSize?.stepSize || '0.00000001'),
                minPrice: parseFloat(filters.priceFilter?.minPrice || '0'),
                maxPrice: parseFloat(filters.priceFilter?.maxPrice || '999999999'),
                tickSize: parseFloat(filters.priceFilter?.tickSize || '0.00000001'),
                minNotional: parseFloat(filters.minNotional?.minNotional || '0'),
                baseAssetPrecision: symbolInfo.baseAssetPrecision || 8,
                quotePrecision: symbolInfo.quotePrecision || 8
            };
        } catch (error) {
            console.error(`❌ Errore getSymbolFilters per ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Round quantity to valid stepSize
     */
    roundQuantity(quantity, stepSize) {
        if (stepSize <= 0) return quantity;
        const precision = Math.abs(Math.log10(stepSize));
        return Math.floor(quantity / stepSize) * stepSize;
    }

    /**
     * Round price to valid tickSize
     */
    roundPrice(price, tickSize) {
        if (tickSize <= 0) return price;
        const precision = Math.abs(Math.log10(tickSize));
        return Math.floor(price / tickSize) * tickSize;
    }

    /**
     * Validate and adjust order parameters according to Binance filters
     */
    async validateOrderParams(symbol, side, quantity, price = null) {
        try {
            const filters = await this.getSymbolFilters(symbol);
            
            // Round quantity to stepSize
            let adjustedQuantity = this.roundQuantity(quantity, filters.stepSize);
            
            // Ensure minQty
            if (adjustedQuantity < filters.minQty) {
                throw new Error(`Quantity ${adjustedQuantity} is below minimum ${filters.minQty} for ${symbol}`);
            }
            
            // Ensure maxQty
            if (adjustedQuantity > filters.maxQty) {
                throw new Error(`Quantity ${adjustedQuantity} exceeds maximum ${filters.maxQty} for ${symbol}`);
            }

            // For limit orders, validate and round price
            let adjustedPrice = price;
            if (price !== null) {
                adjustedPrice = this.roundPrice(price, filters.tickSize);
                
                if (adjustedPrice < filters.minPrice || adjustedPrice > filters.maxPrice) {
                    throw new Error(`Price ${adjustedPrice} is outside valid range [${filters.minPrice}, ${filters.maxPrice}] for ${symbol}`);
                }
            }

            // Validate minNotional (for market orders, use current price estimate)
            const notionalValue = adjustedPrice ? adjustedPrice * adjustedQuantity : null;
            if (notionalValue && notionalValue < filters.minNotional) {
                throw new Error(`Order value ${notionalValue} is below minimum notional ${filters.minNotional} for ${symbol}`);
            }

            return {
                quantity: adjustedQuantity,
                price: adjustedPrice,
                filters: filters
            };
        } catch (error) {
            console.error(`❌ Errore validateOrderParams per ${symbol}:`, error.message);
            throw error;
        }
    }

    /**
     * Place market order
     */
    async placeMarketOrder(symbol, side, quantity) {
        try {
            // ✅ CRITICAL: Validate and adjust quantity according to Binance filters
            const validated = await this.validateOrderParams(symbol, side, quantity);
            const adjustedQuantity = validated.quantity;

            const params = {
                symbol: symbol.toUpperCase(),
                side: side.toUpperCase(), // BUY or SELL
                type: 'MARKET',
                quantity: adjustedQuantity.toString()
            };

            console.log(`📤 PlaceMarketOrder: ${symbol} ${side} ${quantity} → ${adjustedQuantity} (adjusted)`);
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
            // ✅ CRITICAL: Validate and adjust quantity/price according to Binance filters
            const validated = await this.validateOrderParams(symbol, side, quantity, price);
            const adjustedQuantity = validated.quantity;
            const adjustedPrice = validated.price;

            const params = {
                symbol: symbol.toUpperCase(),
                side: side.toUpperCase(),
                type: 'LIMIT',
                timeInForce: 'GTC', // Good Till Cancel
                quantity: adjustedQuantity.toString(),
                price: adjustedPrice.toString()
            };

            console.log(`📤 PlaceLimitOrder: ${symbol} ${side} ${quantity}@${price} → ${adjustedQuantity}@${adjustedPrice} (adjusted)`);
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
            // ✅ CRITICAL: Validate and adjust quantity/stopPrice according to Binance filters
            const validated = await this.validateOrderParams(symbol, side, quantity, stopPrice);
            const adjustedQuantity = validated.quantity;
            const adjustedStopPrice = validated.price;

            const params = {
                symbol: symbol.toUpperCase(),
                side: side.toUpperCase(),
                type: 'STOP_LOSS',
                quantity: adjustedQuantity.toString(),
                stopPrice: adjustedStopPrice.toString(),
                timeInForce: 'GTC'
            };

            console.log(`📤 PlaceStopLossOrder: ${symbol} ${side} ${quantity}@${stopPrice} → ${adjustedQuantity}@${adjustedStopPrice} (adjusted)`);
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

