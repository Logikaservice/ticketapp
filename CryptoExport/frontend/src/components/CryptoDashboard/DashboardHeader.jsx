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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Balance Card */}
            <div className="balance-card" style={{ marginBottom: 0 }}>
                <h2>TOTAL BALANCE (EQUITY)</h2>
                <div className="balance-amount">
                    {formatPriceWithSymbol(balance, 'USDT')}
                </div>
                <span className="balance-label">≈ €{(balance * 0.92).toFixed(2)}</span>
            </div>
            
            {/* Bot Status Card */}
            <div className="balance-card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div className="balance-label">AI BOT STATUS</div>
                    <Power size={20} style={{ color: botStatus?.active ? '#10b981' : '#ef4444' }} />
                </div>
                <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: botStatus?.active ? '#10b981' : '#ef4444' 
                }}>
                    {botStatus?.active ? '🟢 Active' : '🔴 Inactive'}
                </div>
            </div>
            
            {/* Actions Card */}
            <div className="balance-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="balance-label">Impostazioni</div>
                    <Settings size={20} style={{ color: '#3b82f6' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button 
                        className="toggle-btn"
                        onClick={onToggleBotSettings}
                        title="Bot Settings"
                        style={{ flex: 1, padding: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Settings size={18} />
                        <span>Bot</span>
                    </button>
                    
                    <button 
                        className="toggle-btn"
                        onClick={onToggleGeneralSettings}
                        title="General Settings"
                        style={{ flex: 1, padding: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Activity size={18} />
                        <span>Settings</span>
                    </button>
                    
                    <button 
                        className="toggle-btn"
                        onClick={onToggleHealthMonitor}
                        title="System Health"
                        style={{ 
                            padding: '10px 12px', 
                            fontSize: '0.9rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            backgroundColor: healthStatus?.criticalIssues?.length > 0 ? 'rgba(234, 179, 8, 0.15)' : '',
                            border: healthStatus?.criticalIssues?.length > 0 ? '2px solid rgba(234, 179, 8, 0.5)' : ''
                        }}
                    >
                        <AlertTriangle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
});

DashboardHeader.displayName = 'DashboardHeader';

export default DashboardHeader;
