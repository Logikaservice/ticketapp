import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * 🎯 CRYPTO DASHBOARD CONTEXT
 * 
 * Centralizza lo stato globale del dashboard per:
 * - Evitare prop drilling (passare props attraverso molti livelli)
 * - Ottimizzare re-render (solo componenti interessati si aggiornano)
 * - Semplificare la gestione dello stato
 */

const CryptoDashboardContext = createContext(null);

export const useCryptoDashboard = () => {
    const context = useContext(CryptoDashboardContext);
    if (!context) {
        throw new Error('useCryptoDashboard must be used within CryptoDashboardProvider');
    }
    return context;
};

export const CryptoDashboardProvider = ({ children }) => {
    // ========== STATE ==========
    
    // Portfolio & Balance
    const [portfolio, setPortfolio] = useState({ 
        balance_usd: 10800, 
        holdings: {}, 
        rsi: null 
    });
    
    // Trading State
    const [openPositions, setOpenPositions] = useState([]);
    const [closedPositions, setClosedPositions] = useState([]);
    const [trades, setTrades] = useState([]);
    const [allTrades, setAllTrades] = useState([]);
    
    // Bot State
    const [botStatus, setBotStatus] = useState({ 
        active: false, 
        strategy: 'RSI_Strategy' 
    });
    const [activeBots, setActiveBots] = useState([]);
    const [botParameters, setBotParameters] = useState(null);
    
    // Market Data
    const [currentSymbol, setCurrentSymbol] = useState('bitcoin');
    const [currentPrice, setCurrentPrice] = useState(0);
    const [prices, setPrices] = useState({});
    const [priceData, setPriceData] = useState([]);
    const [availableSymbols, setAvailableSymbols] = useState([]);
    
    // Analytics
    const [performanceAnalytics, setPerformanceAnalytics] = useState(null);
    const [performanceStats, setPerformanceStats] = useState(null);
    const [healthStatus, setHealthStatus] = useState(null);
    
    // UI State
    const [showBotSettings, setShowBotSettings] = useState(false);
    const [showBacktestPanel, setShowBacktestPanel] = useState(false);
    const [showGeneralSettings, setShowGeneralSettings] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showHealthMonitor, setShowHealthMonitor] = useState(false);
    const [selectedPositionDetails, setSelectedPositionDetails] = useState(null);
    const [notifications, setNotifications] = useState([]);
    
    // Refs for performance
    const pricesRef = useRef({});
    const fetchingDataRef = useRef(false);
    
    // ========== ACTIONS ==========
    
    const addNotification = useCallback((notification) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { ...notification, id }]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);
    
    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);
    
    const updatePrices = useCallback((newPrices) => {
        pricesRef.current = { ...pricesRef.current, ...newPrices };
        setPrices(pricesRef.current);
    }, []);
    
    const selectSymbol = useCallback((symbol) => {
        setCurrentSymbol(symbol);
    }, []);
    
    // ========== CONTEXT VALUE ==========
    
    const value = {
        // State
        portfolio,
        openPositions,
        closedPositions,
        trades,
        allTrades,
        botStatus,
        activeBots,
        botParameters,
        currentSymbol,
        currentPrice,
        prices,
        priceData,
        availableSymbols,
        performanceAnalytics,
        performanceStats,
        healthStatus,
        showBotSettings,
        showBacktestPanel,
        showGeneralSettings,
        showDetailsModal,
        showHealthMonitor,
        selectedPositionDetails,
        notifications,
        
        // Setters
        setPortfolio,
        setOpenPositions,
        setClosedPositions,
        setTrades,
        setAllTrades,
        setBotStatus,
        setActiveBots,
        setBotParameters,
        setCurrentSymbol,
        setCurrentPrice,
        setPrices,
        setPriceData,
        setAvailableSymbols,
        setPerformanceAnalytics,
        setPerformanceStats,
        setHealthStatus,
        setShowBotSettings,
        setShowBacktestPanel,
        setShowGeneralSettings,
        setShowDetailsModal,
        setShowHealthMonitor,
        setSelectedPositionDetails,
        
        // Actions
        addNotification,
        removeNotification,
        updatePrices,
        selectSymbol,
        
        // Refs
        pricesRef,
        fetchingDataRef,
    };
    
    return (
        <CryptoDashboardContext.Provider value={value}>
            {children}
        </CryptoDashboardContext.Provider>
    );
};
