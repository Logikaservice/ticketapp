
import React, { useState, useEffect } from 'react';
import { Clock, Send, Monitor, Layout, AlertTriangle, Info, CheckCircle, Settings, X, Maximize } from 'lucide-react';

// --- CONFIGURAZIONE COLORI E GRADIENTI ---
const THEMES = {
    danger: {
        gradient: 'from-red-600 to-orange-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: <AlertTriangle size={48} className="text-white mb-4" />,
        label: 'URGENTE'
    },
    warning: {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        icon: <AlertTriangle size={48} className="text-white mb-4" />,
        label: 'ATTENZIONE'
    },
    info: {
        gradient: 'from-blue-600 to-cyan-500',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: <Info size={48} className="text-white mb-4" />,
        label: 'INFORMAZIONE'
    },
    success: {
        gradient: 'from-emerald-500 to-teal-500',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        icon: <CheckCircle size={48} className="text-white mb-4" />,
        label: 'COMPLETATO'
    }
};

// --- COMPONENTE OROLOGIO ---
const DigitalClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-end text-white drop-shadow-md">
            <div className="text-5xl font-bold tracking-wider">
                {time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xl font-medium opacity-90">
                {time.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
        </div>
    );
};

// --- COMPONENTE DISPLAY (MAXI SCHERMO) ---
const DisplayView = ({ messages, viewMode }) => {
    // Mock messages se vuoto
    const activeMessages = messages.length > 0 ? messages : [
        { id: 1, content: 'In attesa di messaggi...', priority: 'info', created_at: new Date() }
    ];

    // Stato per tracciare quale messaggio mostrare in modalità singolo con slide
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // Logica per visualizzazione singola o split
    let displayMessages;
    if (viewMode === 'split') {
        // Se split, prendiamo i primi 2 messaggi attivi
        displayMessages = activeMessages.slice(0, 2);
    } else {
        // Se singolo e ci sono più messaggi, usiamo lo slide automatico
        if (activeMessages.length > 1) {
            // Usa l'indice corrente per ciclare tra i messaggi
            displayMessages = [activeMessages[currentSlideIndex % activeMessages.length]];
        } else {
            displayMessages = [activeMessages[0]];
        }
    }

    // Slide automatico ogni 5 secondi per modalità singolo con più messaggi
    useEffect(() => {
        if (viewMode === 'single' && activeMessages.length > 1) {
            const slideInterval = setInterval(() => {
                setCurrentSlideIndex((prevIndex) => (prevIndex + 1) % activeMessages.length);
            }, 5000); // 5 secondi

            return () => clearInterval(slideInterval);
        }
    }, [viewMode, activeMessages.length]);

    // Reset l'indice quando cambiano i messaggi
    useEffect(() => {
        setCurrentSlideIndex(0);
    }, [activeMessages.map(m => m.id).join(',')]);

    return (
        <div className="fixed inset-0 bg-black text-white overflow-hidden flex">
            {displayMessages.map((msg, index) => {
                const theme = THEMES[msg.priority] || THEMES.info;
                const isSplit = viewMode === 'split';
                const widthClass = isSplit ? 'w-1/2' : 'w-full';

                return (
                    <div
                        key={`${msg.id}-${currentSlideIndex}`}
                        className={`${widthClass} h-full bg-gradient-to-br ${theme.gradient} flex flex-col items-center justify-center p-12 relative transition-all duration-1000 ease-in-out`}
                    >
                        {/* Orologio solo nel primo pannello o in alto a destra assoluto */}
                        {index === (isSplit ? 1 : 0) && (
                            <div className="absolute top-8 right-8 z-10">
                                <DigitalClock />
                            </div>
                        )}

                        {/* Indicatore slide (solo in modalità singolo con più messaggi) */}
                        {viewMode === 'single' && activeMessages.length > 1 && (
                            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex gap-2">
                                {activeMessages.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-2 rounded-full transition-all duration-300 ${
                                            idx === currentSlideIndex
                                                ? 'w-8 bg-white'
                                                : 'w-2 bg-white/50'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Contenuto Messaggio */}
                        <div className="glass-panel p-12 rounded-3xl max-w-4xl w-full text-center backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl transform transition-all duration-1000 ease-in-out hover:scale-105">
                            <div className="flex justify-center">{theme.icon}</div>
                            <h2 className="text-2xl font-bold uppercase tracking-widest opacity-80 mb-6 border-b border-white/30 pb-4 inline-block">
                                {theme.label}
                            </h2>
                            <p className="text-6xl md:text-7xl font-black leading-tight drop-shadow-lg break-words">
                                {msg.content}
                            </p>
                            <div className="mt-8 text-lg opacity-70">
                                Inviato: {new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {/* Indicatore posizione slide (solo se più messaggi) */}
                            {viewMode === 'single' && activeMessages.length > 1 && (
                                <div className="mt-4 text-sm opacity-60">
                                    {currentSlideIndex + 1} / {activeMessages.length}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// --- COMPONENTE ADMIN / SENDER ---
const AdminPanel = ({ onSendMessage, onUpdateSettings, currentSettings, activeMessages, onClearMessage }) => {
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState('info');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        onSendMessage({ content: message, priority });
        setMessage('');
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Monitor className="text-blue-600" />
                        PackVision Control
                    </h1>
                    <p className="text-gray-500 mt-1">Gestione messaggi maxi-schermo in tempo reale</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm">
                    <span className="text-sm font-medium text-gray-600 px-2">Modalità Schermo:</span>
                    <button
                        onClick={() => onUpdateSettings({ viewMode: 'single' })}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${currentSettings.viewMode === 'single'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Singolo
                    </button>
                    <button
                        onClick={() => onUpdateSettings({ viewMode: 'split' })}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${currentSettings.viewMode === 'split'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Split (2 Messaggi)
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Invio Messaggio */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Send size={20} className="text-blue-500" />
                            Nuovo Messaggio
                        </h2>
                    </div>
                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Priorità & Stile</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(THEMES).map(([key, theme]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setPriority(key)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${priority === key
                                                ? `border-${theme.text.split('-')[1]}-500 bg-${theme.text.split('-')[1]}-50 ring-2 ring-${theme.text.split('-')[1]}-200`
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${theme.gradient}`}></div>
                                            <span className={`font-semibold ${priority === key ? theme.text : 'text-gray-600'}`}>
                                                {theme.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Messaggio</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg min-h-[120px]"
                                    placeholder="Scrivi il messaggio da visualizzare..."
                                    maxLength={100}
                                />
                                <div className="text-right text-xs text-gray-400 mt-1">
                                    {message.length}/100 caratteri
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!message.trim()}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                INVIA AL MAXI SCHERMO
                            </button>
                        </form>
                    </div>
                </div>

                {/* Anteprima / Messaggi Attivi */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Layout size={20} className="text-purple-500" />
                            Messaggi Attivi
                        </h2>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
                            {activeMessages.length} attivi
                        </span>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto max-h-[500px] space-y-4 bg-gray-50/50">
                        {activeMessages.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Monitor size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Nessun messaggio attivo.</p>
                                <p className="text-sm">Invia un messaggio per vederlo qui.</p>
                            </div>
                        ) : (
                            activeMessages.map((msg) => {
                                const theme = THEMES[msg.priority] || THEMES.info;
                                return (
                                    <div key={msg.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between group hover:shadow-md transition-all">
                                        <div className="flex items-start gap-4">
                                            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                                                {React.cloneElement(theme.icon, { size: 24, className: 'text-white mb-0' })}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 ${theme.text}`}>
                                                        {theme.label}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(msg.created_at).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-gray-800 text-lg leading-tight">{msg.content}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onClearMessage(msg.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Rimuovi messaggio"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPALE ---
export default function PackVision({ onClose }) {
    const [mode, setMode] = useState('admin'); // 'admin' o 'display'
    const [settings, setSettings] = useState({ viewMode: 'single' });
    const [messages, setMessages] = useState([]);

    // Caricamento iniziale
    useEffect(() => {
        const loadData = async () => {
            try {
                // Carica messaggi
                const resMsg = await fetch('/api/packvision/messages');
                if (resMsg.ok) {
                    const dataMsg = await resMsg.json();
                    setMessages(dataMsg);
                }

                // Carica impostazioni
                const resSet = await fetch('/api/packvision/settings');
                if (resSet.ok) {
                    const dataSet = await resSet.json();
                    if (dataSet.viewMode) {
                        setSettings(prev => ({ ...prev, ...dataSet }));
                    }
                }
            } catch (err) {
                console.error('Errore caricamento dati PackVision:', err);
            }
        };

        loadData();

        // Polling di fallback ogni 5 secondi
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    // Check URL params for display mode
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'display') {
            setMode('display');
        }
    }, []);

    const handleSendMessage = async (newMessage) => {
        try {
            const res = await fetch('/api/packvision/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMessage)
            });

            if (res.ok) {
                const savedMsg = await res.json();
                setMessages(prev => [savedMsg, ...prev]);
            }
        } catch (err) {
            console.error('Errore invio messaggio:', err);
            // Fallback ottimistico
            const msg = {
                id: Date.now(),
                ...newMessage,
                created_at: new Date(),
                active: true
            };
            setMessages(prev => [msg, ...prev]);
        }
    };

    const handleClearMessage = async (id) => {
        try {
            await fetch(`/api/packvision/messages/${id}`, { method: 'DELETE' });
            setMessages(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error('Errore cancellazione messaggio:', err);
        }
    };

    const handleUpdateSettings = async (newSettings) => {
        try {
            await fetch('/api/packvision/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            setSettings(prev => ({ ...prev, ...newSettings }));
        } catch (err) {
            console.error('Errore aggiornamento impostazioni:', err);
        }
    };

    if (mode === 'display') {
        return <DisplayView messages={messages} viewMode={settings.viewMode} />;
    }

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
            {/* Header Navigazione */}
            <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} className="text-gray-600" />
                    </button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <h1 className="font-bold text-xl text-gray-800">PackVision</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('mode', 'display');
                            window.open(url.toString(), '_blank');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                        <Maximize size={16} />
                        Apri Schermo Remoto
                    </button>
                </div>
            </div>

            <AdminPanel
                onSendMessage={handleSendMessage}
                onUpdateSettings={handleUpdateSettings}
                currentSettings={settings}
                activeMessages={messages}
                onClearMessage={handleClearMessage}
            />
        </div>
    );
}
