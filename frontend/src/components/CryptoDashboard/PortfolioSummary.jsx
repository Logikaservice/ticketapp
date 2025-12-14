import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { formatPriceWithSymbol, formatPnL } from '../../utils/priceFormatter';

/**
 * 💼 Portfolio Summary Component
 * 
 * Mostra cards con:
 * - P&L giornaliero
 * - Posizioni aperte
 * - Volume investito
 * - Win rate
 */
const PortfolioSummary = React.memo(({ 
    openPositions = [],
    closedPositions = [],
    performanceAnalytics,
    prices = {}
}) => {
    // Calculate metrics
    const metrics = useMemo(() => {
        // Total open positions
        const totalOpen = openPositions.length;
        
        // Calculate unrealized P&L
        const unrealizedPnL = openPositions.reduce((sum, pos) => {
            const currentPrice = prices[pos.symbol] || 0;
            if (!currentPrice || !pos.entry_price) return sum;
            
            const pnl = pos.type === 'LONG'
                ? (currentPrice - pos.entry_price) * pos.volume
                : (pos.entry_price - currentPrice) * pos.volume;
            
            return sum + pnl;
        }, 0);
        
        // Calculate invested volume
        const investedVolume = openPositions.reduce((sum, pos) => {
            return sum + (pos.entry_price * pos.volume || 0);
        }, 0);
        
        // Calculate win rate
        const totalTrades = closedPositions.length;
        const winningTrades = closedPositions.filter(p => (p.pnl || 0) > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        // Daily P&L from analytics
        const dailyPnL = performanceAnalytics?.day?.pnl || 0;
        
        return {
            totalOpen,
            unrealizedPnL,
            investedVolume,
            winRate,
            dailyPnL,
        };
    }, [openPositions, closedPositions, performanceAnalytics, prices]);
    
    return (
        <div className="portfolio-summary">
            {/* Daily P&L Card */}
            <div className={`summary-card ${metrics.dailyPnL >= 0 ? 'positive' : 'negative'}`}>
                <div className="card-icon">
                    {metrics.dailyPnL >= 0 ? <TrendingUp /> : <TrendingDown />}
                </div>
                <div className="card-content">
                    <div className="card-label">Daily P&L</div>
                    <div className="card-value">
                        {formatPnL(metrics.dailyPnL)}
                    </div>
                </div>
            </div>
            
            {/* Open Positions Card */}
            <div className="summary-card">
                <div className="card-icon">
                    <Activity />
                </div>
                <div className="card-content">
                    <div className="card-label">Open Positions</div>
                    <div className="card-value">{metrics.totalOpen}</div>
                </div>
            </div>
            
            {/* Invested Volume Card */}
            <div className="summary-card">
                <div className="card-icon">
                    <DollarSign />
                </div>
                <div className="card-content">
                    <div className="card-label">Invested</div>
                    <div className="card-value">
                        {formatPriceWithSymbol(metrics.investedVolume, 'USDT')}
                    </div>
                </div>
            </div>
            
            {/* Unrealized P&L Card */}
            <div className={`summary-card ${metrics.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
                <div className="card-icon">
                    {metrics.unrealizedPnL >= 0 ? <TrendingUp /> : <TrendingDown />}
                </div>
                <div className="card-content">
                    <div className="card-label">Unrealized P&L</div>
                    <div className="card-value">
                        {formatPnL(metrics.unrealizedPnL)}
                    </div>
                </div>
            </div>
            
            {/* Win Rate Card */}
            <div className={`summary-card ${metrics.winRate >= 50 ? 'positive' : 'negative'}`}>
                <div className="card-icon">
                    <TrendingUp />
                </div>
                <div className="card-content">
                    <div className="card-label">Win Rate</div>
                    <div className="card-value">{metrics.winRate.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
});

PortfolioSummary.displayName = 'PortfolioSummary';

export default PortfolioSummary;
