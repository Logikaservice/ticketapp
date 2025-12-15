import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Target, Activity, DollarSign, Percent } from 'lucide-react';
import { formatPriceWithSymbol } from '../../utils/priceFormatter';
import './StatisticsPanel.css';

// ✅ PERFORMANCE: React.memo previene re-render inutili
const StatisticsPanel = React.memo(({ apiBase, getAuthHeader = () => ({}) }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStatistics = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/statistics`, {
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.statistics) {
                    setStats(data.statistics);
                    setError(null);
                } else {
                    console.error('StatisticsPanel: Invalid response format', data);
                    setError('Formato risposta non valido');
                }
            } else if (res.status === 502) {
                // 502 Bad Gateway - backend non raggiungibile, non mostrare errore critico
                // Mantieni i dati precedenti se disponibili
                setError(null); // Non mostrare errore per 502 temporanei
            } else {
                const errorText = await res.text();
                // Non loggare 502 come errore critico
                if (res.status !== 502) {
                    console.error('StatisticsPanel: API error', res.status, errorText);
                    setError(`Errore ${res.status}: ${errorText.substring(0, 100)}`);
                }
            }
        } catch (err) {
            // Non loggare errori 502 come errori critici
            if (err.message && !err.message.includes('502')) {
                console.error('Error fetching statistics:', err);
                setError(`Errore di connessione: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatistics();
        // ✅ PERFORMANCE FIX: Ridotto a 10s per ridurre lag
        const interval = setInterval(fetchStatistics, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="statistics-panel">
                <div className="statistics-header">
                    <BarChart3 size={24} className="text-blue-500" />
                    <h3>Statistiche Avanzate</h3>
                </div>
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    Caricamento statistiche...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="statistics-panel">
                <div className="statistics-header">
                    <BarChart3 size={24} className="text-blue-500" />
                    <h3>Statistiche Avanzate</h3>
                </div>
                <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>
                    {error}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="statistics-panel">
            <div className="statistics-header">
                <BarChart3 size={24} className="text-blue-500" />
                <h3>Statistiche Avanzate</h3>
            </div>

            <div className="statistics-grid">
                {/* Total P&L */}
                <div className="stat-card stat-card-primary">
                    <div className="stat-label">
                        <DollarSign size={18} />
                        P&L Totale
                    </div>
                    <div className={`stat-value ${stats.pnl_total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stats.pnl_total >= 0 ? '+' : ''}${stats.pnl_total.toFixed(2)}
                    </div>
                    <div className="stat-change">
                        <Percent size={14} />
                        {stats.pnl_percent >= 0 ? '+' : ''}{stats.pnl_percent.toFixed(2)}%
                    </div>
                    <div className="stat-sublabel">ROI: {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(2)}%</div>
                </div>

                {/* Win Rate */}
                <div className="stat-card">
                    <div className="stat-label">
                        <Target size={18} />
                        Win Rate
                    </div>
                    <div className="stat-value" style={{ color: stats.win_rate >= 50 ? '#4ade80' : '#f87171' }}>
                        {stats.win_rate.toFixed(1)}%
                    </div>
                    <div className="stat-sublabel">
                        {stats.winning_trades} vincenti / {stats.total_trades} totali
                    </div>
                    {stats.profit_factor !== null && (
                        <div className="stat-change">
                            Profit Factor: {stats.profit_factor.toFixed(2)}
                        </div>
                    )}
                </div>

                {/* Total Trades */}
                <div className="stat-card">
                    <div className="stat-label">
                        <Activity size={18} />
                        Trade Totali
                    </div>
                    <div className="stat-value">{stats.total_trades}</div>
                    <div className="stat-sublabel">
                        Oggi: {stats.trades_today} | Settimana: {stats.trades_this_week} | Mese: {stats.trades_this_month}
                    </div>
                </div>

                {/* Average Win/Loss */}
                <div className="stat-card">
                    <div className="stat-label">
                        <TrendingUp size={18} />
                        Media Vincite/Perdite
                    </div>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <div className="stat-mini-label" style={{ color: '#4ade80' }}>Vincita Media</div>
                            <div className="stat-mini-value" style={{ color: '#4ade80' }}>
                                +${stats.avg_win.toFixed(2)}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="stat-mini-label" style={{ color: '#f87171' }}>Perdita Media</div>
                            <div className="stat-mini-value" style={{ color: '#f87171' }}>
                                -${stats.avg_loss.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total Volume */}
                <div className="stat-card">
                    <div className="stat-label">
                        <BarChart3 size={18} />
                        Volume Totale
                    </div>
                    <div className="stat-value">{formatPriceWithSymbol(stats.total_volume_usdt || stats.total_volume_eur || 0, 2)}</div>
                    <div className="stat-sublabel">Volume totale scambiato</div>
                </div>

                {/* Profit/Loss Breakdown */}
                <div className="stat-card">
                    <div className="stat-label">
                        <TrendingDown size={18} />
                        Profitti/Perdite
                    </div>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <div className="stat-mini-label" style={{ color: '#4ade80' }}>Profitti</div>
                            <div className="stat-mini-value" style={{ color: '#4ade80' }}>
                                +${stats.total_profit.toFixed(2)}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="stat-mini-label" style={{ color: '#f87171' }}>Perdite</div>
                            <div className="stat-mini-value" style={{ color: '#f87171' }}>
                                -${stats.total_loss.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default StatisticsPanel;

