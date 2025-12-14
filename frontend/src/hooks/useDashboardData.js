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
            const [portfolioData, positionsData, analyticsData, botsData] = await Promise.all([
                fetchJsonWithRetry(`${apiBase}/api/crypto/portfolio`),
                fetchJsonWithRetry(`${apiBase}/api/crypto/positions`),
                fetchJsonWithRetry(`${apiBase}/api/crypto/performance-analytics`),
                fetchJsonWithRetry(`${apiBase}/api/crypto/bot/active-bots`),
            ]);
            
            // Update portfolio
            if (portfolioData) {
                setPortfolio(portfolioData);
            }
            
            // Update positions
            if (positionsData) {
                const open = positionsData.filter(p => p.status === 'open') || [];
                const closed = positionsData.filter(p => p.status === 'closed') || [];
                setOpenPositions(open);
                setClosedPositions(closed);
                setAllTrades(positionsData);
            }
            
            // Update analytics
            if (analyticsData) {
                setPerformanceAnalytics(analyticsData);
            }
            
            // Update bots
            if (botsData?.bots) {
                setActiveBots(botsData.bots);
            }
        } catch (error) {
            console.error("❌ Error fetching dashboard data:", error);
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
