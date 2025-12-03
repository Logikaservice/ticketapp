import React, { useState, useEffect } from 'react';
import { Play, X, TrendingUp, TrendingDown, BarChart2, Clock, DollarSign, Percent, Trash2 } from 'lucide-react';
import './BacktestPanel.css';

const BacktestPanel = ({ isOpen, onClose, apiBase, currentBotParams }) => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [selectedResult, setSelectedResult] = useState(null);
    const [testParams, setTestParams] = useState({
        startDate: '',
        endDate: '',
        initialBalance: 10000,
        testName: '',
        // Will use current bot params or allow customization
        useCurrentParams: true
    });
    const [error, setError] = useState(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadResults();
            // Set default date range (last 30 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            
            setTestParams(prev => ({
                ...prev,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }));
        }
    }, [isOpen]);

    const loadResults = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/crypto/backtest/results?limit=20`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results || []);
            }
        } catch (err) {
            console.error('Error loading backtest results:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRunBacktest = async () => {
        if (!testParams.startDate || !testParams.endDate) {
            setError('Seleziona le date di inizio e fine');
            return;
        }

        if (new Date(testParams.startDate) >= new Date(testParams.endDate)) {
            setError('La data di inizio deve essere precedente alla data di fine');
            return;
        }

        setError(null);
        setRunning(true);

        try {
            // Use current bot params or create custom ones
            const params = testParams.useCurrentParams && currentBotParams 
                ? currentBotParams 
                : {
                    rsi_period: 14,
                    rsi_oversold: 30,
                    rsi_overbought: 70,
                    stop_loss_pct: 2.0,
                    take_profit_pct: 3.0,
                    trade_size_eur: 50
                };

            const res = await fetch(`${apiBase}/api/crypto/backtest/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    params,
                    startDate: testParams.startDate,
                    endDate: testParams.endDate,
                    initialBalance: testParams.initialBalance,
                    testName: testParams.testName || `Backtest ${new Date().toLocaleString()}`
                })
            });

            if (res.ok) {
                const data = await res.json();
                await loadResults(); // Reload results list
                setError(null);
                // Optionally show success message
            } else {
                const errorData = await res.json();
                setError(errorData.error || 'Errore durante il backtest');
            }
        } catch (err) {
            setError('Errore di rete durante il backtest');
            console.error('Backtest error:', err);
        } finally {
            setRunning(false);
        }
    };

    const handleViewDetails = async (id) => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/backtest/results/${id}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedResult(data.result);
            }
        } catch (err) {
            console.error('Error loading backtest details:', err);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Sei sicuro di voler eliminare questo risultato?')) return;

        try {
            const res = await fetch(`${apiBase}/api/crypto/backtest/results/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await loadResults();
                if (selectedResult && selectedResult.id === id) {
                    setSelectedResult(null);
                }
            }
        } catch (err) {
            console.error('Error deleting backtest:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="backtest-panel-overlay">
            <div className="backtest-panel-content">
                <div className="backtest-panel-header">
                    <h2>📊 Backtesting Strategia</h2>
                    <button onClick={onClose} className="close-button">
                        <X size={20} />
                    </button>
                </div>

                <div className="backtest-panel-body">
                    {/* Run New Backtest Form */}
                    <div className="backtest-form-section">
                        <h3>Esegui Nuovo Backtest</h3>
                        
                        {error && (
                            <div className="backtest-error">{error}</div>
                        )}

                        <div className="backtest-form-grid">
                            <div className="form-group">
                                <label>Nome Test (opzionale)</label>
                                <input
                                    type="text"
                                    value={testParams.testName}
                                    onChange={(e) => setTestParams({ ...testParams, testName: e.target.value })}
                                    placeholder="Backtest Gennaio 2024"
                                />
                            </div>

                            <div className="form-group">
                                <label>Data Inizio</label>
                                <input
                                    type="date"
                                    value={testParams.startDate}
                                    onChange={(e) => setTestParams({ ...testParams, startDate: e.target.value })}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="form-group">
                                <label>Data Fine</label>
                                <input
                                    type="date"
                                    value={testParams.endDate}
                                    onChange={(e) => setTestParams({ ...testParams, endDate: e.target.value })}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="form-group">
                                <label>Capitale Iniziale (€)</label>
                                <input
                                    type="number"
                                    value={testParams.initialBalance}
                                    onChange={(e) => setTestParams({ ...testParams, initialBalance: parseFloat(e.target.value) || 10000 })}
                                    min="100"
                                    max="1000000"
                                />
                            </div>
                        </div>

                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={testParams.useCurrentParams}
                                    onChange={(e) => setTestParams({ ...testParams, useCurrentParams: e.target.checked })}
                                />
                                Usa parametri strategia attuali
                            </label>
                        </div>

                        <button 
                            className="btn-run-backtest" 
                            onClick={handleRunBacktest}
                            disabled={running || loading}
                        >
                            {running ? (
                                <>⏳ Esecuzione in corso...</>
                            ) : (
                                <>
                                    <Play size={18} /> Avvia Backtest
                                </>
                            )}
                        </button>
                    </div>

                    {/* Results List */}
                    <div className="backtest-results-section">
                        <h3>Risultati Precedenti</h3>
                        
                        {loading ? (
                            <div className="backtest-loading">Caricamento risultati...</div>
                        ) : results.length === 0 ? (
                            <div className="backtest-empty">Nessun risultato disponibile. Esegui un backtest per iniziare.</div>
                        ) : (
                            <div className="backtest-results-list">
                                {results.map((result) => (
                                    <div 
                                        key={result.id} 
                                        className="backtest-result-item"
                                        onClick={() => handleViewDetails(result.id)}
                                    >
                                        <div className="result-header">
                                            <div className="result-name">
                                                <strong>{result.test_name || 'Backtest'}</strong>
                                                <span className="result-date">
                                                    {new Date(result.start_date).toLocaleDateString()} - {new Date(result.end_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <button 
                                                className="btn-delete-result"
                                                onClick={(e) => handleDelete(result.id, e)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="result-stats">
                                            <div className="stat-item">
                                                <DollarSign size={16} />
                                                <span className="stat-label">P&L:</span>
                                                <span className={`stat-value ${result.total_pnl >= 0 ? 'positive' : 'negative'}`}>
                                                    €{result.total_pnl.toFixed(2)} ({result.total_pnl_pct.toFixed(2)}%)
                                                </span>
                                            </div>
                                            <div className="stat-item">
                                                <BarChart2 size={16} />
                                                <span className="stat-label">Trade:</span>
                                                <span className="stat-value">{result.total_trades}</span>
                                            </div>
                                            <div className="stat-item">
                                                <TrendingUp size={16} />
                                                <span className="stat-label">Win Rate:</span>
                                                <span className="stat-value">{result.win_rate.toFixed(1)}%</span>
                                            </div>
                                            <div className="stat-item">
                                                <Percent size={16} />
                                                <span className="stat-label">Profit Factor:</span>
                                                <span className="stat-value">{result.profit_factor.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detailed Result View */}
                    {selectedResult && (
                        <div className="backtest-detail-section">
                            <h3>Dettagli Backtest: {selectedResult.test_name}</h3>
                            <button 
                                className="btn-close-detail"
                                onClick={() => setSelectedResult(null)}
                            >
                                <X size={16} /> Chiudi
                            </button>
                            
                            <div className="detail-grid">
                                <div className="detail-card">
                                    <h4>Capitale</h4>
                                    <div className="detail-value">
                                        <div>Iniziale: €{selectedResult.initial_balance.toFixed(2)}</div>
                                        <div>Finale: €{selectedResult.final_balance.toFixed(2)}</div>
                                        <div className={selectedResult.total_pnl >= 0 ? 'positive' : 'negative'}>
                                            P&L: €{selectedResult.total_pnl.toFixed(2)} ({selectedResult.total_pnl_pct.toFixed(2)}%)
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-card">
                                    <h4>Trade</h4>
                                    <div className="detail-value">
                                        <div>Totali: {selectedResult.total_trades}</div>
                                        <div className="positive">Vincite: {selectedResult.winning_trades}</div>
                                        <div className="negative">Perdite: {selectedResult.losing_trades}</div>
                                    </div>
                                </div>

                                <div className="detail-card">
                                    <h4>Statistiche</h4>
                                    <div className="detail-value">
                                        <div>Win Rate: {selectedResult.win_rate.toFixed(2)}%</div>
                                        <div>Profit Factor: {selectedResult.profit_factor.toFixed(2)}</div>
                                        <div>Max Drawdown: {selectedResult.max_drawdown_pct.toFixed(2)}%</div>
                                        <div>Sharpe Ratio: {selectedResult.sharpe_ratio.toFixed(2)}</div>
                                    </div>
                                </div>

                                <div className="detail-card">
                                    <h4>Periodo</h4>
                                    <div className="detail-value">
                                        <div>
                                            <Clock size={14} /> {new Date(selectedResult.start_date).toLocaleString()}
                                        </div>
                                        <div>
                                            <Clock size={14} /> {new Date(selectedResult.end_date).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedResult.strategy_params && (
                                <div className="detail-card full-width">
                                    <h4>Parametri Strategia</h4>
                                    <pre className="strategy-params">
                                        {JSON.stringify(JSON.parse(selectedResult.strategy_params), null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BacktestPanel;

