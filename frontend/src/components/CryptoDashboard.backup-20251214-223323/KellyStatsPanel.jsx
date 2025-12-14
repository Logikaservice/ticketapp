import React from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';

const KellyStatsPanel = ({ stats }) => {
    if (!stats || stats.total_trades === 0) {
        return (
            <div style={{
                background: 'linear-gradient(145deg, #1c1c1e, #2a2a2d)',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #374151'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <BarChart3 size={20} style={{ color: '#3b82f6' }} />
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Kelly Criterion Stats</h3>
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                    📊 Nessun dato disponibile. Completa almeno 10 trade per vedere le statistiche.
                </div>
            </div>
        );
    }

    const winRate = stats.win_rate || 0;
    const avgWin = stats.avg_win || 0;
    const avgLoss = Math.abs(stats.avg_loss) || 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Calculate Kelly Percentage (same formula as backend)
    const p = winRate;
    const q = 1 - p;
    const b = riskRewardRatio;
    const kellyFraction = b > 0 ? (p * b - q) / b : 0;
    const safeKelly = Math.max(0.01, Math.min(0.15, kellyFraction / 2));

    // Color coding
    const winRateColor = winRate >= 0.55 ? '#22c55e' : winRate >= 0.45 ? '#eab308' : '#ef4444';
    const rrRatioColor = riskRewardRatio >= 1.5 ? '#22c55e' : riskRewardRatio >= 1.0 ? '#eab308' : '#ef4444';
    const kellyColor = safeKelly >= 0.08 ? '#22c55e' : safeKelly >= 0.05 ? '#eab308' : '#ef4444';

    const isReliable = stats.total_trades >= 10;

    return (
        <div style={{
            background: 'linear-gradient(145deg, #1c1c1e, #2a2a2d)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #374151'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BarChart3 size={20} style={{ color: '#3b82f6' }} />
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Kelly Criterion Stats</h3>
                </div>
                {!isReliable && (
                    <span style={{
                        background: '#fbbf24',
                        color: '#000',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                    }}>
                        {stats.total_trades}/10 trades
                    </span>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {/* Win Rate */}
                <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '8px',
                    padding: '15px',
                    border: `1px solid ${winRateColor}33`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Target size={16} style={{ color: winRateColor }} />
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Win Rate</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: winRateColor }}>
                        {(winRate * 100).toFixed(1)}%
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px' }}>
                        {stats.winning_trades}W / {stats.losing_trades}L
                    </div>
                </div>

                {/* Risk/Reward Ratio */}
                <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '8px',
                    padding: '15px',
                    border: `1px solid ${rrRatioColor}33`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={16} style={{ color: rrRatioColor }} />
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Risk/Reward</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: rrRatioColor }}>
                        {riskRewardRatio.toFixed(2)}x
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px' }}>
                        ${avgWin.toFixed(2)} / ${avgLoss.toFixed(2)}
                    </div>
                </div>

                {/* Kelly Percentage */}
                <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '8px',
                    padding: '15px',
                    border: `1px solid ${kellyColor}33`,
                    gridColumn: '1 / -1'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart3 size={16} style={{ color: kellyColor }} />
                            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Optimal Position Size (Half-Kelly)</span>
                        </div>
                        {isReliable && (
                            <span style={{
                                background: '#22c55e',
                                color: '#000',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold'
                            }}>
                                ACTIVE
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: kellyColor }}>
                            {(safeKelly * 100).toFixed(1)}%
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                            del capitale per trade
                        </div>
                    </div>
                    {!isReliable && (
                        <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            background: 'rgba(251, 191, 36, 0.1)',
                            borderRadius: '4px',
                            color: '#fbbf24',
                            fontSize: '0.75rem'
                        }}>
                            ⚠️ Kelly Criterion non ancora attivo. Servono almeno {10 - stats.total_trades} trade in più.
                        </div>
                    )}
                </div>

                {/* Total Profit/Loss */}
                <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '8px',
                    padding: '15px',
                    border: '1px solid #374151',
                    gridColumn: '1 / -1'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '4px' }}>Total Profit</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#22c55e' }}>
                                +${stats.total_profit.toFixed(2)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '4px' }}>Total Loss</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ef4444' }}>
                                ${Math.abs(stats.total_loss).toFixed(2)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '4px' }}>Net P&L</div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: (stats.total_profit + stats.total_loss) >= 0 ? '#22c55e' : '#ef4444'
                            }}>
                                {(stats.total_profit + stats.total_loss) >= 0 ? '+' : ''}${(stats.total_profit + stats.total_loss).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KellyStatsPanel;
