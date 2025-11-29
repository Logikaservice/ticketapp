
import React, { useState, useEffect } from 'react';
import { Clock, Send, Monitor, Layout, AlertTriangle, Info, CheckCircle, Settings, X, Maximize, GripVertical, Zap, Bell, MessageCircle, Edit2 } from 'lucide-react';

// --- CONFIGURAZIONE COLORI E GRADIENTI ---
const THEMES = {
    danger: {
        gradient: 'from-red-600 to-orange-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: <Zap size={48} className="text-white mb-4" />, // Simbolo fulmine per URGENTE
        label: 'URGENTE'
    },
    warning: {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        icon: <Bell size={48} className="text-white mb-4" />, // Simbolo campanello per ATTENZIONE
        label: 'ATTENZIONE'
    },
    info: {
        gradient: 'from-blue-600 to-cyan-500',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: <Info size={48} className="text-white mb-4" />, // Simbolo info per INFORMAZIONE
        label: 'INFORMAZIONE'
    },
    success: {
        gradient: 'from-emerald-500 to-teal-500',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        icon: <CheckCircle size={48} className="text-white mb-4" />, // Simbolo check per COMPLETATO
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
    // Filtra messaggi attivi e non scaduti
    const now = new Date();
    const activeMessages = messages.filter(msg => {
        if (!msg.active) return false;
        if (msg.expires_at) {
            const expiresAt = new Date(msg.expires_at);
            return expiresAt > now;
        }
        return true;
    });

    // Separa messaggi urgenti da non urgenti
    const urgentMessages = activeMessages.filter(msg => msg.priority === 'danger');
    const nonUrgentMessages = activeMessages.filter(msg => msg.priority !== 'danger');

    // Stati semplici per animazione icona
    const [showIconAnimation, setShowIconAnimation] = useState(false);
    const [currentUrgent, setCurrentUrgent] = useState(null);
    const [currentNonUrgent, setCurrentNonUrgent] = useState(null);
    const [currentNonUrgentIndex, setCurrentNonUrgentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [prevUrgentCount, setPrevUrgentCount] = useState(0);
    const [prevNonUrgentCount, setPrevNonUrgentCount] = useState(0);

    // Rileva quando viene creato un nuovo messaggio urgente
    useEffect(() => {
        // Se c'è un nuovo messaggio urgente
        if (urgentMessages.length > prevUrgentCount && urgentMessages.length > 0) {
            // Trova il messaggio più recente
            const mostRecentUrgent = urgentMessages.reduce((latest, current) => {
                const latestTime = new Date(latest.created_at || latest.id);
                const currentTime = new Date(current.created_at || current.id);
                return currentTime > latestTime ? current : latest;
            });

            console.log('🚨 [PackVision] Nuovo messaggio urgente rilevato:', mostRecentUrgent.id);
            
            // Imposta il messaggio corrente
            setCurrentUrgent(mostRecentUrgent);
            
            // Avvia animazione icona dal centro per 2 secondi
            setShowIconAnimation(true);
            
            // Dopo 2 secondi, nasconde animazione e mostra messaggio
            setTimeout(() => {
                setShowIconAnimation(false);
            }, 2000);
        }
        
        // Se non ci sono urgenti, pulisci
        if (urgentMessages.length === 0) {
            setCurrentUrgent(null);
            // Non resettare showIconAnimation se stiamo mostrando un messaggio non urgente
            if (urgentMessages.length === 0 && nonUrgentMessages.length === 0) {
                setShowIconAnimation(false);
            }
        }
        
        setPrevUrgentCount(urgentMessages.length);
    }, [urgentMessages.length, urgentMessages.map(m => `${m.id}-${m.created_at}`).join(','), nonUrgentMessages.length]);
    
    // Listener per eventi personalizzati (quando viene creato da handleSendMessage) - rilevamento immediato
    useEffect(() => {
        const handleNewUrgentMessage = (event) => {
            const { messageId, message } = event.detail;
            console.log('🚨 [PackVision] Evento nuovo messaggio urgente ricevuto:', messageId);
            
            // Usa il messaggio dall'evento o cerca nella lista
            const urgentMessage = message || urgentMessages.find(m => m.id === messageId);
            
            if (urgentMessage && urgentMessage.priority === 'danger' && !showIconAnimation) {
                console.log('✅ [PackVision] Avvio animazione per nuovo urgente:', messageId);
                
                // Imposta immediatamente il messaggio
                setCurrentUrgent(urgentMessage);
                
                // Avvia animazione icona con dissolvenza in entrata
                setShowIconAnimation(true);
                
                // Dopo 2 secondi, nasconde animazione e mostra messaggio con fade-in
                setTimeout(() => {
                    setShowIconAnimation(false);
                }, 2000);
            }
        };
        
        window.addEventListener('packvision:newUrgentMessage', handleNewUrgentMessage);
        return () => window.removeEventListener('packvision:newUrgentMessage', handleNewUrgentMessage);
    }, [urgentMessages, showIconAnimation]);
    
    // Rileva quando viene creato un nuovo messaggio non urgente (solo se non ci sono urgenti)
    useEffect(() => {
        // Solo se non ci sono messaggi urgenti
        if (urgentMessages.length === 0 && nonUrgentMessages.length > prevNonUrgentCount && nonUrgentMessages.length > 0) {
            // Trova il messaggio più recente
            const mostRecentNonUrgent = nonUrgentMessages.reduce((latest, current) => {
                const latestTime = new Date(latest.created_at || latest.id);
                const currentTime = new Date(current.created_at || current.id);
                return currentTime > latestTime ? current : latest;
            });

            console.log('📋 [PackVision] Nuovo messaggio non urgente rilevato (nessun urgente presente):', mostRecentNonUrgent.id);
            
            // Imposta il messaggio corrente
            setCurrentNonUrgent(mostRecentNonUrgent);
            
            // Avvia animazione icona dal centro per 2 secondi
            setShowIconAnimation(true);
            
            // Dopo 2 secondi, nasconde animazione e mostra messaggio
            setTimeout(() => {
                setShowIconAnimation(false);
            }, 2000);
        }
        
        // Se non ci sono messaggi, pulisci
        if (urgentMessages.length === 0 && nonUrgentMessages.length === 0) {
            setCurrentNonUrgent(null);
            setShowIconAnimation(false);
        }
        
        setPrevNonUrgentCount(nonUrgentMessages.length);
        
        // Se c'è un solo messaggio non urgente e non ci sono urgenti, impostalo come corrente
        if (urgentMessages.length === 0 && nonUrgentMessages.length === 1 && !currentNonUrgent) {
            setCurrentNonUrgent(nonUrgentMessages[0]);
            setCurrentNonUrgentIndex(0);
        }
        
        // Se ci sono 2+ messaggi non urgenti, inizializza l'indice se necessario
        if (urgentMessages.length === 0 && nonUrgentMessages.length >= 2 && currentNonUrgentIndex === 0 && !currentNonUrgent) {
            setCurrentNonUrgent(nonUrgentMessages[0]);
        }
    }, [urgentMessages.length, nonUrgentMessages.length, nonUrgentMessages.map(m => `${m.id}-${m.created_at}`).join(',')]);
    
    // Inizializza il primo messaggio non urgente quando ci sono 2+ messaggi e si passa da 1 a 2+
    useEffect(() => {
        if (urgentMessages.length === 0 && nonUrgentMessages.length >= 2) {
            // Se l'indice non è valido o non è ancora impostato, inizializzalo
            if (currentNonUrgentIndex >= nonUrgentMessages.length || currentNonUrgentIndex < 0) {
                setCurrentNonUrgentIndex(0);
            }
            // Se non c'è un messaggio corrente impostato, impostalo
            if (!nonUrgentMessages[currentNonUrgentIndex]) {
                setCurrentNonUrgentIndex(0);
            }
        }
    }, [urgentMessages.length, nonUrgentMessages.length, currentNonUrgentIndex, nonUrgentMessages]);
    
    // Rotazione automatica dei messaggi non urgenti ogni 10 secondi (quando ce ne sono 2+)
    useEffect(() => {
        if (urgentMessages.length > 0 || nonUrgentMessages.length < 2) {
            setIsTransitioning(false);
            return;
        }
        
        // Assicurati che l'indice corrente sia valido
        if (currentNonUrgentIndex >= nonUrgentMessages.length || currentNonUrgentIndex < 0) {
            setCurrentNonUrgentIndex(0);
        }
        
        const interval = setInterval(() => {
            setCurrentNonUrgentIndex(prev => {
                const nextIndex = (prev + 1) % nonUrgentMessages.length;
                
                // Avvia animazione di transizione
                setIsTransitioning(true);
                
                // Dopo 1 secondo (durata animazione), ferma l'animazione
                setTimeout(() => {
                    setIsTransitioning(false);
                }, 1000);
                
                return nextIndex;
            });
        }, 10000); // 10 secondi
        
        return () => clearInterval(interval);
    }, [urgentMessages.length, nonUrgentMessages.length, nonUrgentMessages, currentNonUrgentIndex]);
    
    // Listener per eventi personalizzati quando viene creato un messaggio non urgente (senza urgenti)
    useEffect(() => {
        const handleNewNonUrgentMessage = (event) => {
            // Solo se non ci sono urgenti
            if (urgentMessages.length > 0) return;
            
            const { messageId, message } = event.detail;
            console.log('📋 [PackVision] Evento nuovo messaggio non urgente ricevuto:', messageId);
            
            // Usa il messaggio dall'evento o cerca nella lista
            const nonUrgentMessage = message || nonUrgentMessages.find(m => m.id === messageId);
            
            if (nonUrgentMessage && nonUrgentMessage.priority !== 'danger' && !showIconAnimation) {
                console.log('✅ [PackVision] Avvio animazione per nuovo messaggio non urgente:', messageId);
                
                // Imposta immediatamente il messaggio
                setCurrentNonUrgent(nonUrgentMessage);
                
                // Avvia animazione icona con dissolvenza in entrata
                setShowIconAnimation(true);
                
                // Dopo 2 secondi, nasconde animazione e mostra messaggio con fade-in
                setTimeout(() => {
                    setShowIconAnimation(false);
                }, 2000);
            }
        };
        
        window.addEventListener('packvision:newNonUrgentMessage', handleNewNonUrgentMessage);
        return () => window.removeEventListener('packvision:newNonUrgentMessage', handleNewNonUrgentMessage);
    }, [urgentMessages.length, nonUrgentMessages, showIconAnimation]);

    // Genera lucciole casuali per l'animazione di sfondo
    const generateFireflies = () => {
        const fireflies = [];
        for (let i = 0; i < 30; i++) {
            fireflies.push({
                id: i,
                left: Math.random() * 100,
                top: Math.random() * 100,
                tx: (Math.random() - 0.5) * 100,
                ty: (Math.random() - 0.5) * 100,
                delay: Math.random() * 3
            });
        }
        return fireflies;
    };
    
    const [fireflies] = useState(generateFireflies());

    // Funzione per renderizzare un messaggio urgente
    const renderUrgentMessage = (msg) => {
        if (!msg) return null;
        const theme = THEMES[msg.priority] || THEMES.info;
        
        return (
            <div className="h-full w-full bg-gradient-to-br from-red-600 to-orange-600 flex flex-col items-center justify-center p-12 relative overflow-hidden">
                {/* Sfondo rotante */}
                <div className="rotating-background"></div>
                
                {/* Lucciole animate sullo sfondo */}
                {fireflies.map((fly) => (
                    <div
                        key={fly.id}
                        className="firefly"
                        style={{
                            '--left': `${fly.left}%`,
                            '--top': `${fly.top}%`,
                            '--tx': `${fly.tx}px`,
                            '--ty': `${fly.ty}px`,
                            '--delay': `${fly.delay}s`
                        }}
                    />
                ))}
                
                {/* Orologio in alto a destra */}
                <div className="absolute top-8 right-8 z-10">
                    <DigitalClock />
                </div>

                {/* Contenuto Messaggio - nascosto durante animazione icona, con fade-in */}
                {!showIconAnimation && (
                    <div className="glass-panel p-12 rounded-3xl max-w-4xl w-full text-center backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl relative z-10 message-fade-in">
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
                    </div>
                )}
            </div>
        );
    };
    
    // Funzione per renderizzare un messaggio non urgente (quando non ci sono urgenti)
    const renderNonUrgentMessage = (msg, isBottomHalf = false) => {
        if (!msg) return null;
        const theme = THEMES[msg.priority] || THEMES.info;
        
        // Determina i gradienti basati sulla priorità
        const gradientClass = `bg-gradient-to-br ${theme.gradient}`;
        
        return (
            <div className={`h-full w-full ${gradientClass} flex flex-col items-center justify-center p-12 relative overflow-hidden ${isBottomHalf && isTransitioning ? 'slide-out-left' : ''}`}>
                {/* Sfondo rotante */}
                <div className="rotating-background"></div>
                
                {/* Lucciole animate sullo sfondo */}
                {fireflies.map((fly) => (
                    <div
                        key={fly.id}
                        className="firefly"
                        style={{
                            '--left': `${fly.left}%`,
                            '--top': `${fly.top}%`,
                            '--tx': `${fly.tx}px`,
                            '--ty': `${fly.ty}px`,
                            '--delay': `${fly.delay}s`
                        }}
                    />
                ))}
                
                {/* Orologio in alto a destra (solo se schermo intero) */}
                {!isBottomHalf && (
                    <div className="absolute top-8 right-8 z-10">
                        <DigitalClock />
                    </div>
                )}

                {/* Contenuto Messaggio - nascosto durante animazione icona, con fade-in */}
                {!showIconAnimation && (
                    <div className={`glass-panel p-12 rounded-3xl max-w-4xl w-full text-center backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl relative z-10 ${isBottomHalf && isTransitioning ? 'slide-in-right' : isBottomHalf ? '' : 'message-fade-in'}`}>
                        <div className="flex justify-center">{theme.icon}</div>
                        <h2 className="text-2xl font-bold uppercase tracking-widest opacity-80 mb-6 border-b border-white/30 pb-4 inline-block">
                            {theme.label}
                        </h2>
                        <p className={`${isBottomHalf ? 'text-4xl md:text-5xl' : 'text-6xl md:text-7xl'} font-black leading-tight drop-shadow-lg break-words`}>
                            {msg.content}
                        </p>
                        <div className="mt-8 text-lg opacity-70">
                            Inviato: {new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {/* Animazioni CSS */}
            <style>{`
                @keyframes iconGrowCenter {
                    0% {
                        transform: scale(0.1);
                        opacity: 0;
                    }
                    30% {
                        transform: scale(1.2);
                        opacity: 0.8;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeInMessage {
                    0% {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                @keyframes lightBeam {
                    0% {
                        transform: translateX(-100%) skewX(-20deg);
                        opacity: 0;
                    }
                    30% {
                        opacity: 1;
                    }
                    70% {
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(200%) skewX(-20deg);
                        opacity: 0;
                    }
                }
                
                @keyframes slideOutLeft {
                    0% {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translateX(-100%);
                        opacity: 0;
                    }
                }
                
                @keyframes slideInRight {
                    0% {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    100% {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                .message-fade-in {
                    animation: fadeInMessage 1s ease-out forwards;
                }
                
                .light-beam {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(
                        90deg,
                        transparent 0%,
                        rgba(255, 255, 255, 0.1) 20%,
                        rgba(255, 255, 255, 0.3) 50%,
                        rgba(255, 255, 255, 0.1) 80%,
                        transparent 100%
                    );
                    pointer-events: none;
                    z-index: 50;
                    animation: lightBeam 1s ease-out forwards;
                }
                
                .slide-out-left {
                    animation: slideOutLeft 0.8s ease-in forwards;
                }
                
                .slide-in-right {
                    animation: slideInRight 0.8s ease-out forwards;
                }
                
                @keyframes firefly {
                    0%, 100% {
                        opacity: 0;
                        transform: translate(0, 0) scale(0) rotate(0deg);
                    }
                    10% {
                        opacity: 1;
                        transform: translate(var(--tx), var(--ty)) scale(1) rotate(0deg);
                    }
                    90% {
                        opacity: 1;
                        transform: translate(var(--tx), var(--ty)) scale(1) rotate(0deg);
                    }
                }
                
                @keyframes rotateBackground {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }
                
                .firefly {
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.8);
                    border-radius: 50%;
                    box-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 255, 255, 0.6);
                    animation: firefly 3s infinite;
                    animation-delay: var(--delay);
                    left: var(--left);
                    top: var(--top);
                }
                
                .rotating-background {
                    position: absolute;
                    inset: 0;
                    animation: rotateBackground 20s linear infinite;
                    transform-origin: center center;
                }
                
                .rotating-background::before {
                    content: '';
                    position: absolute;
                    width: 200%;
                    height: 200%;
                    top: -50%;
                    left: -50%;
                    background: conic-gradient(
                        from 0deg,
                        rgba(239, 68, 68, 0.1) 0deg,
                        rgba(220, 38, 38, 0.15) 45deg,
                        rgba(239, 68, 68, 0.1) 90deg,
                        rgba(251, 146, 60, 0.15) 135deg,
                        rgba(239, 68, 68, 0.1) 180deg,
                        rgba(220, 38, 38, 0.15) 225deg,
                        rgba(239, 68, 68, 0.1) 270deg,
                        rgba(251, 146, 60, 0.15) 315deg,
                        rgba(239, 68, 68, 0.1) 360deg
                    );
                    pointer-events: none;
                }
            `}</style>
            <div className="fixed inset-0 bg-black text-white overflow-hidden">
                {/* Se c'è un messaggio urgente */}
                {currentUrgent ? (
                    <>
                        {/* Animazione icona dal centro per 2 secondi */}
                        {showIconAnimation && (
                            <div 
                                className="fixed inset-0 flex items-center justify-center z-30 bg-gradient-to-br from-red-600 to-orange-600 overflow-hidden"
                            >
                                {/* Sfondo rotante */}
                                <div className="rotating-background"></div>
                                
                                {/* Lucciole animate sullo sfondo */}
                                {fireflies.map((fly) => (
                                    <div
                                        key={`fly-icon-${fly.id}`}
                                        className="firefly"
                                        style={{
                                            '--left': `${fly.left}%`,
                                            '--top': `${fly.top}%`,
                                            '--tx': `${fly.tx}px`,
                                            '--ty': `${fly.ty}px`,
                                            '--delay': `${fly.delay}s`
                                        }}
                                    />
                                ))}
                                
                                <div 
                                    className="text-white relative z-10"
                                    style={{
                                        animation: 'iconGrowCenter 2s ease-out forwards'
                                    }}
                                >
                                    {React.cloneElement(THEMES.danger.icon, { 
                                        size: 300, 
                                        className: 'text-white drop-shadow-2xl'
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Messaggio urgente a schermo intero (dopo animazione icona) */}
                        {!showIconAnimation && renderUrgentMessage(currentUrgent)}
                    </>
                ) : urgentMessages.length === 0 && nonUrgentMessages.length > 0 ? (
                    <>
                        {/* Se c'è un solo messaggio non urgente: schermo intero */}
                        {nonUrgentMessages.length === 1 ? (
                            <>
                                {/* Animazione icona dal centro per 2 secondi per messaggi non urgenti */}
                                {showIconAnimation && (() => {
                                    const theme = THEMES[nonUrgentMessages[0].priority] || THEMES.info;
                                    const gradientClass = `bg-gradient-to-br ${theme.gradient}`;
                                    return (
                                        <div 
                                            className={`fixed inset-0 flex items-center justify-center z-30 ${gradientClass} overflow-hidden`}
                                        >
                                            {/* Sfondo rotante */}
                                            <div className="rotating-background"></div>
                                            
                                            {/* Lucciole animate sullo sfondo */}
                                            {fireflies.map((fly) => (
                                                <div
                                                    key={`fly-icon-nonurgent-${fly.id}`}
                                                    className="firefly"
                                                    style={{
                                                        '--left': `${fly.left}%`,
                                                        '--top': `${fly.top}%`,
                                                        '--tx': `${fly.tx}px`,
                                                        '--ty': `${fly.ty}px`,
                                                        '--delay': `${fly.delay}s`
                                                    }}
                                                />
                                            ))}
                                            
                                            <div 
                                                className="text-white relative z-10"
                                                style={{
                                                    animation: 'iconGrowCenter 2s ease-out forwards'
                                                }}
                                            >
                                                {React.cloneElement(theme.icon, { 
                                                    size: 300, 
                                                    className: 'text-white drop-shadow-2xl'
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                {/* Messaggio non urgente a schermo intero (dopo animazione icona) */}
                                {!showIconAnimation && renderNonUrgentMessage(nonUrgentMessages[0])}
                            </>
                        ) : (
                            // Se ci sono 2+ messaggi non urgenti: divisione orizzontale
                            <>
                                {/* Metà superiore: nera */}
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-black flex items-center justify-center">
                                    <div className="absolute top-8 right-8 z-10">
                                        <DigitalClock />
                                    </div>
                                </div>
                                
                                {/* Metà inferiore: messaggi non urgenti che ruotano ogni 10 secondi */}
                                <div className="absolute bottom-0 left-0 w-full h-1/2 relative overflow-hidden">
                                    {nonUrgentMessages[currentNonUrgentIndex] && (
                                        <>
                                            {renderNonUrgentMessage(nonUrgentMessages[currentNonUrgentIndex], true)}
                                            
                                            {/* Fascio di luce durante la transizione - sopra tutto */}
                                            {isTransitioning && (
                                                <div className="absolute inset-0 z-50 pointer-events-none">
                                                    <div className="light-beam"></div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    // Nessun messaggio: schermo nero con orologio
                    <div className="h-full w-full bg-black flex items-center justify-center">
                        <div className="absolute top-8 right-8 z-10">
                            <DigitalClock />
                        </div>
                        <div className="text-white text-4xl opacity-50">In attesa di messaggi...</div>
                    </div>
                )}
            </div>
        </>
    );
};

// --- COMPONENTE ADMIN / SENDER ---
const AdminPanel = ({ onSendMessage, onUpdateSettings, currentSettings, activeMessages, onClearMessage, onReorderMessages, onUpdateMessage }) => {
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState('info');
    const [duration, setDuration] = useState('24'); // Default 24 ore
    const [customDuration, setCustomDuration] = useState('');
    const [editingMessage, setEditingMessage] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        
        const durationHours = duration === 'custom' ? parseInt(customDuration) || 24 : parseInt(duration);
        
        if (editingMessage) {
            // Modifica messaggio esistente
            onUpdateMessage(editingMessage.id, { content: message, priority, duration_hours: durationHours });
            setEditingMessage(null);
        } else {
            // Crea nuovo messaggio
            onSendMessage({ content: message, priority, duration_hours: durationHours });
        }
        
        setMessage('');
        setPriority('info');
        setDuration('24');
        setCustomDuration('');
    };

    const handleEditMessage = (msg) => {
        setEditingMessage(msg);
        setMessage(msg.content);
        setPriority(msg.priority || 'info');
        setDuration(msg.duration_hours ? msg.duration_hours.toString() : '24');
        setCustomDuration('');
        // Scroll al form
        document.querySelector('.bg-white.rounded-2xl.shadow-lg').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
        setMessage('');
        setPriority('info');
        setDuration('24');
        setCustomDuration('');
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
                            {editingMessage ? <Edit2 size={20} className="text-blue-500" /> : <Send size={20} className="text-blue-500" />}
                            {editingMessage ? 'Modifica Messaggio' : 'Nuovo Messaggio'}
                        </h2>
                        {editingMessage && (
                            <button
                                onClick={handleCancelEdit}
                                className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                            >
                                Annulla modifica
                            </button>
                        )}
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Durata Messaggio</label>
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    {['6', '12', '18', '24'].map((hours) => (
                                        <button
                                            key={hours}
                                            type="button"
                                            onClick={() => {
                                                setDuration(hours);
                                                setCustomDuration('');
                                            }}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                duration === hours && duration !== 'custom'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {hours}h
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDuration('custom');
                                        if (!customDuration) setCustomDuration('24');
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all mb-2 ${
                                        duration === 'custom'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    Personalizzato
                                </button>
                                {duration === 'custom' && (
                                    <input
                                        type="number"
                                        min="1"
                                        max="168"
                                        value={customDuration}
                                        onChange={(e) => setCustomDuration(e.target.value)}
                                        placeholder="Ore (1-168)"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={!message.trim() || (duration === 'custom' && (!customDuration || parseInt(customDuration) < 1))}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingMessage ? 'AGGIORNA MESSAGGIO' : 'INVIA AL MAXI SCHERMO'}
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
                            activeMessages.map((msg, index) => {
                                const theme = THEMES[msg.priority] || THEMES.info;
                                return (
                                    <div 
                                        key={msg.id} 
                                        draggable
                                        onDragStart={(e) => {
                                            setDraggedIndex(index);
                                            e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (draggedIndex !== null && draggedIndex !== index) {
                                                onReorderMessages(draggedIndex, index);
                                            }
                                            setDraggedIndex(null);
                                        }}
                                        onDragEnd={() => setDraggedIndex(null)}
                                        onClick={(e) => {
                                            // Previeni il click se si sta facendo drag
                                            if (draggedIndex === null) {
                                                handleEditMessage(msg);
                                            }
                                        }}
                                        className={`bg-white p-4 rounded-xl border shadow-sm flex items-start justify-between group hover:shadow-md transition-all cursor-pointer ${
                                            editingMessage?.id === msg.id 
                                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                                                : 'border-gray-200'
                                        } ${
                                            draggedIndex === index ? 'opacity-50 scale-95' : ''
                                        } ${draggedIndex !== null && draggedIndex !== index ? 'border-blue-300 bg-blue-50' : ''}`}
                                    >
                                        <div className="flex items-start gap-4 flex-1">
                                            {/* Handle per il drag */}
                                            <div 
                                                className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0 pt-1"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <GripVertical size={20} />
                                            </div>
                                            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                                                {React.cloneElement(theme.icon, { size: 24, className: 'text-white mb-0' })}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 ${theme.text}`}>
                                                        {theme.label}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(msg.created_at).toLocaleTimeString()}
                                                    </span>
                                                    {msg.duration_hours && (
                                                        <span className="text-xs text-blue-600 font-medium">
                                                            ⏱️ {msg.duration_hours}h
                                                        </span>
                                                    )}
                                                    {msg.expires_at && (
                                                        <span className="text-xs text-gray-500">
                                                            Scade: {new Date(msg.expires_at).toLocaleString('it-IT', { 
                                                                day: '2-digit', 
                                                                month: '2-digit', 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </span>
                                                    )}
                                                    {activeMessages.length > 1 && (
                                                        <span className="text-xs text-gray-500 font-medium">
                                                            #{index + 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-gray-800 text-lg leading-tight">{msg.content}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClearMessage(msg.id);
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ml-2"
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
                    // Applica l'ordine salvato se presente
                    const savedOrder = localStorage.getItem('packvision_message_order');
                    if (savedOrder && dataMsg.length > 0) {
                        try {
                            const order = JSON.parse(savedOrder);
                            const sorted = [...dataMsg].sort((a, b) => {
                                const indexA = order.indexOf(a.id);
                                const indexB = order.indexOf(b.id);
                                if (indexA === -1) return 1;
                                if (indexB === -1) return -1;
                                return indexA - indexB;
                            });
                            setMessages(sorted);
                        } catch (err) {
                            console.error('Errore caricamento ordine messaggi:', err);
                            setMessages(dataMsg);
                        }
                    } else {
                        setMessages(dataMsg);
                    }
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
            console.log('📤 [PackVision] Invio messaggio:', newMessage);
            
            // Calcola expires_at se duration_hours è fornito
            let expiresAt = null;
            if (newMessage.duration_hours) {
                const expiresDate = new Date();
                expiresDate.setHours(expiresDate.getHours() + parseInt(newMessage.duration_hours, 10));
                expiresAt = expiresDate.toISOString();
                console.log('📅 [PackVision] Scadenza calcolata:', expiresAt);
            }

            const messageToSend = {
                ...newMessage,
                expires_at: expiresAt
            };

            console.log('📦 [PackVision] Dati da inviare al backend:', messageToSend);

            const res = await fetch('/api/packvision/messages', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messageToSend)
            });

            console.log('📡 [PackVision] Risposta ricevuta - Status:', res.status, res.statusText);

            let responseData;
            try {
                const text = await res.text();
                console.log('📄 [PackVision] Risposta raw:', text);
                responseData = text ? JSON.parse(text) : {};
            } catch (parseErr) {
                console.error('❌ [PackVision] Errore parsing risposta:', parseErr);
                throw new Error('Impossibile leggere la risposta del server');
            }

            if (res.ok) {
                console.log('✅ [PackVision] Messaggio creato con successo:', responseData);
                
                // Controlla se ci sono urgenti PRIMA di aggiornare lo stato
                const hasUrgentMessages = messages.some(m => m.priority === 'danger' && m.active);
                
                setMessages(prev => {
                    const newMessages = [responseData, ...prev];
                    console.log('📋 [PackVision] Nuovo stato messaggi:', newMessages.length, 'messaggi');
                    return newMessages;
                });
                
                // Se è urgente, segnalalo immediatamente tramite evento personalizzato
                if (responseData.priority === 'danger') {
                    console.log('🚨 [PackVision] Messaggio urgente creato, emetto evento');
                    // Emetti subito l'evento senza timeout per pubblicazione veloce
                    window.dispatchEvent(new CustomEvent('packvision:newUrgentMessage', { 
                        detail: { 
                            messageId: responseData.id, 
                            timestamp: Date.now(),
                            message: responseData
                        } 
                    }));
                } else {
                    // Se è non urgente, controlla se ci sono urgenti
                    // Se non ci sono urgenti, emetti evento per messaggio non urgente
                    if (!hasUrgentMessages) {
                        console.log('📋 [PackVision] Messaggio non urgente creato (nessun urgente presente), emetto evento');
                        
                        // Controlla se ci sono già altri messaggi non urgenti
                        const existingNonUrgent = messages.filter(m => m.priority !== 'danger' && m.active);
                        
                        // Se questo è il primo messaggio non urgente, emetti evento per animazione icona
                        if (existingNonUrgent.length === 0) {
                            window.dispatchEvent(new CustomEvent('packvision:newNonUrgentMessage', { 
                                detail: { 
                                    messageId: responseData.id, 
                                    timestamp: Date.now(),
                                    message: responseData
                                } 
                            }));
                        }
                        // Se ce ne sono già altri, lo schermo si dividerà automaticamente
                    }
                }
            } else {
                console.error('❌ [PackVision] Errore risposta server:', {
                    status: res.status,
                    statusText: res.statusText,
                    data: responseData
                });
                const errorMsg = responseData.error || responseData.details || 'Errore sconosciuto';
                alert(`Errore nella creazione del messaggio: ${errorMsg}`);
            }
        } catch (err) {
            console.error('❌ [PackVision] Errore invio messaggio:', err);
            console.error('❌ [PackVision] Stack trace:', err.stack);
            const errorMsg = err.message || 'Errore di connessione';
            alert(`Errore nella creazione del messaggio: ${errorMsg}`);
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

    const handleUpdateMessage = async (id, updatedData) => {
        try {
            const res = await fetch(`/api/packvision/messages/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (res.ok) {
                const updatedMsg = await res.json();
                setMessages(prev => prev.map(m => m.id === id ? updatedMsg : m));
            }
        } catch (err) {
            console.error('Errore aggiornamento messaggio:', err);
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

    const handleReorderMessages = (fromIndex, toIndex) => {
        setMessages(prev => {
            const newMessages = [...prev];
            const [moved] = newMessages.splice(fromIndex, 1);
            newMessages.splice(toIndex, 0, moved);
            
            // Salva l'ordine in localStorage per persistenza
            const order = newMessages.map(m => m.id);
            localStorage.setItem('packvision_message_order', JSON.stringify(order));
            
            return newMessages;
        });
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
                onReorderMessages={handleReorderMessages}
                onUpdateMessage={handleUpdateMessage}
            />
        </div>
    );
}
