import React, { useState, useEffect } from 'react';
import { Settings, Mail, Volume2, VolumeX, Wallet, Bell, Moon, Sun, RefreshCw, X } from 'lucide-react';
import cryptoSounds from '../../utils/cryptoSounds';
import './GeneralSettings.css';

const GeneralSettings = ({
    isOpen,
    onClose,
    onResetPortfolio,
    onAddFunds
}) => {
    const [settings, setSettings] = useState({
        emailNotifications: true,
        soundEnabled: true,
        soundVolume: 30,
        marketScannerAlerts: true,
        darkMode: false,
        autoRefreshInterval: 10 // seconds
    });

    // Load settings from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('crypto_general_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            setSettings(parsed);
            // Apply sound settings
            cryptoSounds.setEnabled(parsed.soundEnabled);
            cryptoSounds.setVolume(parsed.soundVolume / 100);
        }
    }, []);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('crypto_general_settings', JSON.stringify(settings));
        // Apply sound settings
        cryptoSounds.setEnabled(settings.soundEnabled);
        cryptoSounds.setVolume(settings.soundVolume / 100);
    }, [settings]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const testSound = () => {
        cryptoSounds.positionOpened();
    };

    if (!isOpen) return null;

    return (
        <div className="general-settings-overlay" onClick={onClose}>
            <div className="general-settings-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="general-settings-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Settings size={24} className="text-blue-500" />
                        <h2>Impostazioni Generali</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Settings Content */}
                <div className="general-settings-content">

                        {/* Email Notifications */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Mail size={18} style={{ color: '#10b981' }} />
                                    <span style={{ color: '#fff', fontWeight: '500' }}>
                                        Notifiche Email
                                    </span>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.emailNotifications}
                                        onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: settings.emailNotifications ? '#10b981' : '#374151',
                                        borderRadius: '24px',
                                        transition: '0.3s'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '',
                                            height: '18px',
                                            width: '18px',
                                            left: settings.emailNotifications ? '28px' : '3px',
                                            bottom: '3px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            transition: '0.3s'
                                        }}></span>
                                    </span>
                                </label>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', paddingLeft: '26px' }}>
                                Invia email a info@logikaservice.it quando apre/chiude posizioni
                            </p>
                        </div>

                        {/* Sound Notifications */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {settings.soundEnabled ? (
                                        <Volume2 size={18} style={{ color: '#3b82f6' }} />
                                    ) : (
                                        <VolumeX size={18} style={{ color: '#6b7280' }} />
                                    )}
                                    <span style={{ color: '#fff', fontWeight: '500' }}>
                                        Suoni Notifiche
                                    </span>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.soundEnabled}
                                        onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: settings.soundEnabled ? '#3b82f6' : '#374151',
                                        borderRadius: '24px',
                                        transition: '0.3s'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '',
                                            height: '18px',
                                            width: '18px',
                                            left: settings.soundEnabled ? '28px' : '3px',
                                            bottom: '3px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            transition: '0.3s'
                                        }}></span>
                                    </span>
                                </label>
                            </div>

                            {settings.soundEnabled && (
                                <>
                                    <div style={{ paddingLeft: '26px', marginTop: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                            <span style={{ color: '#9ca3af', fontSize: '0.8rem', minWidth: '60px' }}>
                                                Volume: {settings.soundVolume}%
                                            </span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={settings.soundVolume}
                                                onChange={(e) => updateSetting('soundVolume', parseInt(e.target.value))}
                                                style={{
                                                    flex: 1,
                                                    height: '4px',
                                                    borderRadius: '2px',
                                                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${settings.soundVolume}%, #374151 ${settings.soundVolume}%, #374151 100%)`,
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={testSound}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '0.75rem',
                                                background: '#374151',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = '#4b5563'}
                                            onMouseLeave={(e) => e.target.style.background = '#374151'}
                                        >
                                            🔊 Test Suono
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Market Scanner Alerts */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bell size={18} style={{ color: '#f59e0b' }} />
                                    <span style={{ color: '#fff', fontWeight: '500' }}>
                                        Avvisi Market Scanner
                                    </span>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.marketScannerAlerts}
                                        onChange={(e) => updateSetting('marketScannerAlerts', e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: settings.marketScannerAlerts ? '#f59e0b' : '#374151',
                                        borderRadius: '24px',
                                        transition: '0.3s'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '',
                                            height: '18px',
                                            width: '18px',
                                            left: settings.marketScannerAlerts ? '28px' : '3px',
                                            bottom: '3px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            transition: '0.3s'
                                        }}></span>
                                    </span>
                                </label>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', paddingLeft: '26px' }}>
                                Mostra badge quando rileva opportunità di trading
                            </p>
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', background: '#374151', margin: '20px 0' }}></div>

                        {/* Portfolio Management */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '12px'
                            }}>
                                <Wallet size={18} style={{ color: '#6366f1' }} />
                                <span style={{ color: '#fff', fontWeight: '500' }}>
                                    Gestione Portfolio
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '26px' }}>
                                <button
                                    onClick={() => {
                                        onClose();
                                        onAddFunds();
                                    }}
                                    style={{
                                        padding: '10px 14px',
                                        background: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: '500',
                                        transition: 'background 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#059669'}
                                    onMouseLeave={(e) => e.target.style.background = '#10b981'}
                                >
                                    💰 Aggiungi Fondi
                                </button>

                                <button
                                    onClick={() => {
                                        onClose();
                                        onResetPortfolio();
                                    }}
                                    style={{
                                        padding: '10px 14px',
                                        background: '#ef4444',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: '500',
                                        transition: 'background 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                                    onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                                >
                                    🔄 Reset Portfolio
                                </button>
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', background: '#374151', margin: '20px 0' }}></div>

                        {/* Auto Refresh */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '12px'
                            }}>
                                <RefreshCw size={18} style={{ color: '#8b5cf6' }} />
                                <span style={{ color: '#fff', fontWeight: '500' }}>
                                    Auto-Refresh
                                </span>
                            </div>

                            <div style={{ paddingLeft: '26px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '0.8rem', minWidth: '100px' }}>
                                        Ogni {settings.autoRefreshInterval}s
                                    </span>
                                    <input
                                        type="range"
                                        min="5"
                                        max="60"
                                        step="5"
                                        value={settings.autoRefreshInterval}
                                        onChange={(e) => updateSetting('autoRefreshInterval', parseInt(e.target.value))}
                                        style={{
                                            flex: 1,
                                            height: '4px',
                                            borderRadius: '2px',
                                            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings.autoRefreshInterval - 5) / 55) * 100}%, #374151 ${((settings.autoRefreshInterval - 5) / 55) * 100}%, #374151 100%)`,
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                    Frequenza aggiornamento dati dashboard
                                </p>
                            </div>
                        </div>

                </div>

                {/* Footer */}
                <div className="general-settings-footer">
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                        ✅ Impostazioni salvate automaticamente
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;
