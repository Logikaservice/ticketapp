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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            {/* Daily P&L Card */}
            <div className="balance-card" style={{ 
                marginBottom: 0, 
                borderLeft: `4px solid ${metrics.dailyPnL >= 0 ? '#10b981' : '#ef4444'}` 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="balance-label">Daily P&L</div>
                    {metrics.dailyPnL >= 0 ? <TrendingUp size={20} style={{ color: '#10b981' }} /> : <TrendingDown size={20} style={{ color: '#ef4444' }} />}
                </div>
                <div className="balance-amount" style={{ fontSize: '1.5rem', color: metrics.dailyPnL >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatPnL(metrics.dailyPnL)}
                </div>
            </div>
            
            {/* Open Positions Card */}
            <div className="balance-card" style={{ marginBottom: 0, borderLeft: '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="balance-label">Open Positions</div>
                    <Activity size={20} style={{ color: '#3b82f6' }} />
                </div>
                <div className="balance-amount" style={{ fontSize: '1.5rem' }}>{metrics.totalOpen}</div>
            </div>
            
            {/* Invested Volume Card */}
            <div className="balance-card" style={{ marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="balance-label">Invested</div>
                    <DollarSign size={20} style={{ color: '#f59e0b' }} />
                </div>
                <div className="balance-amount" style={{ fontSize: '1.2rem' }}>
                    {formatPriceWithSymbol(metrics.investedVolume, 'USDT')}
                </div>
            </div>
            
            {/* Unrealized P&L Card */}
            <div className="balance-card" style={{ 
                marginBottom: 0, 
                borderLeft: `4px solid ${metrics.unrealizedPnL >= 0 ? '#10b981' : '#ef4444'}` 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="balance-label">Unrealized P&L</div>
                    {metrics.unrealizedPnL >= 0 ? <TrendingUp size={20} style={{ color: '#10b981' }} /> : <TrendingDown size={20} style={{ color: '#ef4444' }} />}
                </div>
                <div className="balance-amount" style={{ fontSize: '1.2rem', color: metrics.unrealizedPnL >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatPnL(metrics.unrealizedPnL)}
                </div>
            </div>
            
            {/* Win Rate Card */}
            <div className="balance-card" style={{ 
                marginBottom: 0, 
                borderLeft: `4px solid ${metrics.winRate >= 50 ? '#10b981' : '#ef4444'}` 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="balance-label">Win Rate</div>
                    <TrendingUp size={20} style={{ color: metrics.winRate >= 50 ? '#10b981' : '#ef4444' }} />
                </div>
                <div className="balance-amount" style={{ fontSize: '1.5rem', color: metrics.winRate >= 50 ? '#10b981' : '#ef4444' }}>
                    {metrics.winRate.toFixed(1)}%
                </div>
            </div>
        </div>
    );
});

PortfolioSummary.displayName = 'PortfolioSummary';

export default PortfolioSummary;
