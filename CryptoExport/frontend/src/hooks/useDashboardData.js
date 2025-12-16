import { useEffect, useCallback, useRef } from 'react';
import { useCryptoDashboard } from '../contexts/CryptoDashboardContext';
import { fetchJsonWithRetry } from '../utils/apiWithRetry';

/**
 * 🔄 Custom Hook per Fetch Dati Dashboard
 * 
 * Gestisce il caricamento di:
 * - Portfolio & Balance
 * - Posizioni aperte/chiuse
 * - Performance analytics
 * - Bot status
 */
export const useDashboardData = (apiBase) => {
    const {
        setPortfolio,
        setOpenPositions,
        setClosedPositions,
        setAllTrades,
        setPerformanceAnalytics,
        setActiveBots,
        fetchingDataRef,
    } = useCryptoDashboard();
    
    const fetchData = useCallback(async () => {
        // Prevent concurrent fetches
        if (fetchingDataRef.current) {
            return;
        }
        
        fetchingDataRef.current = true;
        
        try {
            // Fetch data with error handling for each request
            const results = await Promise.allSettled([
                fetchJsonWithRetry(`${apiBase}/api/crypto/portfolio`).catch(e => null),
                fetchJsonWithRetry(`${apiBase}/api/crypto/positions`).catch(e => null),
                fetchJsonWithRetry(`${apiBase}/api/crypto/performance-analytics`).catch(e => null),
                fetchJsonWithRetry(`${apiBase}/api/crypto/bot/active-bots`).catch(e => null),
            ]);
            
            const [portfolioResult, positionsResult, analyticsResult, botsResult] = results;
            
            // Update portfolio
            if (portfolioResult.status === 'fulfilled' && portfolioResult.value) {
                setPortfolio(portfolioResult.value);
            }
            
            // Update positions - validate it's an array
            if (positionsResult.status === 'fulfilled' && positionsResult.value) {
                const positionsData = positionsResult.value;
                if (Array.isArray(positionsData)) {
                    const open = positionsData.filter(p => p?.status === 'open') || [];
                    const closed = positionsData.filter(p => p?.status === 'closed') || [];
                    setOpenPositions(open);
                    setClosedPositions(closed);
                    setAllTrades(positionsData);
                }
            }
            
            // Update analytics
            if (analyticsResult.status === 'fulfilled' && analyticsResult.value) {
                setPerformanceAnalytics(analyticsResult.value);
            }
            
            // Update bots
            if (botsResult.status === 'fulfilled' && botsResult.value?.bots) {
                setActiveBots(botsResult.value.bots);
            }
        } catch (error) {
            // Silent fail - don't spam console
        } finally {
            fetchingDataRef.current = false;
        }
    }, [apiBase, setPortfolio, setOpenPositions, setClosedPositions, setAllTrades, setPerformanceAnalytics, setActiveBots, fetchingDataRef]);
    
    // Auto-refresh every 5 seconds
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);
    
    return { fetchData };
};
