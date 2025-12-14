import React from 'react';
import { Power, Settings, Activity, AlertTriangle } from 'lucide-react';
import { formatPriceWithSymbol } from '../../utils/priceFormatter';

/**
 * 📊 Dashboard Header Component
 * 
 * Mostra:
 * - Balance totale
 * - Bot status
 * - Pulsanti impostazioni
 */
const DashboardHeader = React.memo(({ 
    balance, 
    botStatus, 
    onToggleBotSettings,
    onToggleGeneralSettings,
    onToggleHealthMonitor,
    healthStatus 
}) => {
    return (
        <div className="dashboard-header">
            {/* Balance Card */}
            <div className="balance-card">
                <h2>TOTAL BALANCE (EQUITY)</h2>
                <div className="balance-amount">
                    {formatPriceWithSymbol(balance, 'USDT')}
                </div>
                <span className="balance-label">≈ €{(balance * 0.92).toFixed(2)}</span>
            </div>
            
            {/* Bot Status Card */}
            <div className={`bot-status-card ${botStatus?.active ? 'active' : 'inactive'}`}>
                <div className="bot-status-header">
                    <Power size={20} />
                    <span>AI BOT STATUS</span>
                </div>
                <div className="bot-status-indicator">
                    {botStatus?.active ? '🟢 Active' : '🔴 Disconnected'}
                </div>
            </div>
            
            {/* Actions */}
            <div className="header-actions">
                <button 
                    className="icon-button"
                    onClick={onToggleBotSettings}
                    title="Bot Settings"
                >
                    <Settings size={20} />
                </button>
                
                <button 
                    className="icon-button"
                    onClick={onToggleGeneralSettings}
                    title="General Settings"
                >
                    <Activity size={20} />
                </button>
                
                <button 
                    className={`icon-button ${healthStatus?.overall !== 'healthy' ? 'warning' : ''}`}
                    onClick={onToggleHealthMonitor}
                    title="System Health"
                >
                    <AlertTriangle size={20} />
                </button>
            </div>
        </div>
    );
});

DashboardHeader.displayName = 'DashboardHeader';

export default DashboardHeader;
