import { useEffect, useCallback } from 'react';
import { useCryptoDashboard } from '../contexts/CryptoDashboardContext';
import { fetchJsonWithRetry } from '../utils/apiWithRetry';

/**
 * 💰 Custom Hook per Aggiornamenti Prezzi
 * 
 * Gestisce aggiornamenti prezzi via:
 * - WebSocket (real-time)
 * - HTTP Polling (fallback)
 */
export const usePriceUpdates = (apiBase, wsConnected) => {
    const {
        openPositions,
        portfolio,
        updatePrices,
        setCurrentPrice,
        currentSymbol,
    } = useCryptoDashboard();
    
    // Fetch single price
    const fetchPrice = useCallback(async (symbol) => {
        try {
            const data = await fetchJsonWithRetry(
                `${apiBase}/api/crypto/price/${symbol}?currency=usdt`
            ).catch(() => null);
            
            if (data && typeof data.price === 'number') {
                updatePrices({ [symbol]: data.price });
                
                // Update current price if it's the current symbol
                if (symbol === currentSymbol) {
                    setCurrentPrice(data.price);
                }
                
                return data.price;
            }
        } catch (error) {
            // Silent fail
        }
        return null;
    }, [apiBase, updatePrices, setCurrentPrice, currentSymbol]);
    
    // Fetch all prices for open positions
    const fetchAllPrices = useCallback(async () => {
        const symbols = new Set();
        
        // Add symbols from open positions
        openPositions?.forEach(pos => {
            if (pos.symbol) symbols.add(pos.symbol);
        });
        
        // Add symbols from portfolio holdings
        Object.keys(portfolio.holdings || {}).forEach(symbol => {
            symbols.add(symbol);
        });
        
        // Add current symbol
        if (currentSymbol) symbols.add(currentSymbol);
        
        // Fetch all prices in parallel
        const pricePromises = Array.from(symbols).map(symbol => fetchPrice(symbol));
        await Promise.all(pricePromises);
    }, [openPositions, portfolio.holdings, currentSymbol, fetchPrice]);
    
    // ✅ WebSocket Real-Time: Listen to price updates
    useEffect(() => {
        const handlePriceUpdate = (event) => {
            const { prices } = event.detail;
            
            // Update all prices from WebSocket
            const priceUpdates = {};
            for (const [symbol, data] of Object.entries(prices)) {
                priceUpdates[symbol] = data.price;
                
                // Update current price if it's the current symbol
                if (symbol === currentSymbol) {
                    setCurrentPrice(data.price);
                }
            }
            
            updatePrices(priceUpdates);
        };
        
        window.addEventListener('crypto-prices-update', handlePriceUpdate);
        
        return () => {
            window.removeEventListener('crypto-prices-update', handlePriceUpdate);
        };
    }, [currentSymbol, updatePrices, setCurrentPrice]);
    
    // ✅ Fallback: HTTP Polling only if WebSocket disconnected
    useEffect(() => {
        // Initial fetch
        fetchAllPrices();
        
        // Polling only if WebSocket is down
        const interval = setInterval(() => {
            if (!wsConnected) {
                fetchAllPrices();
            }
        }, 5000);
        
        return () => clearInterval(interval);
    }, [fetchAllPrices, wsConnected]);
    
    return { fetchPrice, fetchAllPrices };
};
