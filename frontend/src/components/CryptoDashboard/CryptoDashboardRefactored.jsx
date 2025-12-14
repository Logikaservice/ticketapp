import React, { useMemo } from 'react';
import { CryptoDashboardProvider, useCryptoDashboard } from '../../contexts/CryptoDashboardContext';
import { useCryptoWebSocket } from '../../hooks/useCryptoWebSocket';
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePriceUpdates } from '../../hooks/usePriceUpdates';

// Components
import DashboardHeader from './DashboardHeader';
import PortfolioSummary from './PortfolioSummary';
import OpenPositions from './OpenPositions';
import TradingViewChart from './TradingViewChart';
import BotSettings from './BotSettings';
import StatisticsPanel from './StatisticsPanel';
import CryptoNotification from './CryptoNotification';
import MarketScanner from './MarketScanner';
import GeneralSettings from './GeneralSettings';
import SystemHealthMonitor from './SystemHealthMonitor';

import cryptoSounds from '../../utils/cryptoSounds';
import './CryptoLayout.css';
import './CryptoStandalone.css';

/**
 * 🎯 CRYPTO DASHBOARD (REFACTORED)
 * 
 * Versione ottimizzata con:
 * - Context API per stato globale
 * - Custom hooks per logica
 * - Componenti piccoli e memoizzati
 * - Migliori performance (no re-render inutili)
 */

// Inner component that uses context
const CryptoDashboardInner = () => {
    const {
        portfolio,
        openPositions,
        closedPositions,
        allTrades,
        botStatus,
        botParameters,
        currentSymbol,
        currentPrice,
        prices,
        priceData,
        availableSymbols,
        performanceAnalytics,
        healthStatus,
        showBotSettings,
        showBacktestPanel,
        showGeneralSettings,
        showDetailsModal,
        showHealthMonitor,
        selectedPositionDetails,
        notifications,
        setShowBotSettings,
        setShowGeneralSettings,
        setShowHealthMonitor,
        selectSymbol,
        addNotification,
        removeNotification,
    } = useCryptoDashboard();
    
    // API Base URL
    const apiBase = useMemo(() => {
        return window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : '';
    }, []);
    
    // WebSocket connection
    const { connected: wsConnected } = useCryptoWebSocket(
        (data) => {
            // Position opened
            cryptoSounds.success();
            addNotification({
                type: 'success',
                message: `✅ Position opened: ${data.symbol} ${data.type}`,
            });
        },
        (data) => {
            // Position closed
            const isProfit = data.pnl > 0;
            if (isProfit) {
                cryptoSounds.success();
            }
            addNotification({
                type: isProfit ? 'success' : 'warning',
                message: `${isProfit ? '✅' : '⚠️'} Position closed: ${data.symbol} P&L: ${data.pnl?.toFixed(2)}`,
            });
        }
    );
    
    // Custom hooks for data fetching
    useDashboardData(apiBase);
    usePriceUpdates(apiBase, wsConnected);
    
    // Calculate total balance
    const totalBalance = useMemo(() => {
        return portfolio.balance_usd || 0;
    }, [portfolio.balance_usd]);
    
    return (
        <div className="crypto-dashboard">
            {/* Header */}
            <div className="crypto-header">
                <DashboardHeader
                    balance={totalBalance}
                    botStatus={botStatus}
                    healthStatus={healthStatus}
                    onToggleBotSettings={() => setShowBotSettings(!showBotSettings)}
                    onToggleGeneralSettings={() => setShowGeneralSettings(!showGeneralSettings)}
                    onToggleHealthMonitor={() => setShowHealthMonitor(!showHealthMonitor)}
                />
            </div>
            
            {/* Portfolio Summary Cards */}
            <PortfolioSummary
                openPositions={openPositions}
                closedPositions={closedPositions}
                performanceAnalytics={performanceAnalytics}
                prices={prices}
            />
            
            {/* Main Content - Grid Layout */}
            <div className="crypto-grid">
                {/* Left Column: Positions + Market Scanner */}
                <div className="crypto-card">
                    <OpenPositions
                        positions={openPositions}
                        currentPrice={currentPrice}
                        currentSymbol={currentSymbol}
                        allSymbolPrices={prices}
                        onClosePosition={async (id) => {
                            // Handle close position
                            console.log('Close position:', id);
                        }}
                        onUpdatePnL={() => {}}
                        availableSymbols={availableSymbols}
                        onSelectSymbol={selectSymbol}
                        apiBase={apiBase}
                    />
                    
                    <MarketScanner
                        apiBase={apiBase}
                        onSelectSymbol={selectSymbol}
                        currentSymbol={currentSymbol}
                    />
                </div>
                
                {/* Right Column: Chart + Statistics */}
                <div className="crypto-card" style={{ gridColumn: 'span 2' }}>
                    <TradingViewChart
                        symbol={currentSymbol}
                        trades={allTrades}
                        openPositions={openPositions}
                        currentPrice={currentPrice}
                        priceHistory={priceData}
                        closedTrades={closedPositions}
                        currentSymbol={currentSymbol}
                        availableSymbols={availableSymbols}
                    />
                    
                    <StatisticsPanel
                        performanceAnalytics={performanceAnalytics}
                        botParameters={botParameters}
                    />
                </div>
            </div>
            
            {/* Modals */}
            {showBotSettings && (
                <BotSettings
                    onClose={() => setShowBotSettings(false)}
                    apiBase={apiBase}
                />
            )}
            
            {showGeneralSettings && (
                <GeneralSettings
                    onClose={() => setShowGeneralSettings(false)}
                    apiBase={apiBase}
                />
            )}
            
            {showHealthMonitor && (
                <SystemHealthMonitor
                    onClose={() => setShowHealthMonitor(false)}
                    apiBase={apiBase}
                />
            )}
            
            {/* Notifications */}
            <div className="crypto-notifications-container">
                {notifications.map((notif) => (
                    <CryptoNotification
                        key={notif.id}
                        notification={notif}
                        onClose={() => removeNotification(notif.id)}
                    />
                ))}
            </div>
        </div>
    );
};

// Wrapper with Context Provider
const CryptoDashboardRefactored = () => {
    return (
        <CryptoDashboardProvider>
            <CryptoDashboardInner />
        </CryptoDashboardProvider>
    );
};

export default CryptoDashboardRefactored;
