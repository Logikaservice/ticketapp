import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Sparkles, Loader2, Minimize2 } from 'lucide-react';
import './AiAssistant.css';

const CandleMascot = ({ mood = 'happy', size = 40 }) => {
    // Svg semplice per la candela mascotte
    const color = '#10b981'; // Green emerald

    return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Body */}
            <rect x="35" y="30" width="30" height="50" rx="4" fill={color} />
            {/* Wicks */}
            <line x1="50" y1="10" x2="50" y2="30" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <line x1="50" y1="80" x2="50" y2="90" stroke={color} strokeWidth="4" strokeLinecap="round" />

            {/* Face Expressions */}
            {mood === 'happy' && (
                <>
                    <circle cx="43" cy="45" r="3" fill="#064e3b" />
                    <circle cx="57" cy="45" r="3" fill="#064e3b" />
                    <path d="M42 58 Q50 65 58 58" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
                    {/* Cheeks */}
                    <circle cx="38" cy="52" r="3" fill="#a7f3d0" fillOpacity="0.5" />
                    <circle cx="62" cy="52" r="3" fill="#a7f3d0" fillOpacity="0.5" />
                </>
            )}
            {mood === 'thinking' && (
                <>
                    <circle cx="43" cy="45" r="3" fill="#064e3b" />
                    <circle cx="57" cy="45" r="3" fill="#064e3b" />
                    <line x1="45" y1="60" x2="55" y2="60" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
                </>
            )}
            {mood === 'excited' && (
                <>
                    <path d="M40 45 L46 45" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
                    <path d="M54 45 L60 45" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
                    <path d="M42 55 Q50 70 58 55" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" fill="#065f46" />
                </>
            )}
        </svg>
    );
};

const AiAssistant = ({ currentSymbol, currentPrice, apiBase }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: 'Ciao! Sono Greeny, il tuo assistente di trading. 🕯️\nPosso analizzare grafici, spiegarti le mie mosse o controllare lo stato del mercato. Dimmi tutto!' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newMsg = { id: Date.now(), type: 'user', text: inputValue };
        setMessages(prev => [...prev, newMsg]);
        setInputValue('');
        setIsTyping(true);

        // Chiamata reale al Backend AI
        try {
            const response = await fetch(`${apiBase}/api/crypto/bot/ai-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: inputValue,
                    symbol: currentSymbol || 'BTCUSDT'
                })
            });

            if (!response.ok) throw new Error('Errore API');

            const data = await response.json();

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                type: 'bot',
                text: data.reply || "Scusa, non ho capito. Riprova! 🕯️"
            }]);

        } catch (error) {
            console.error("Errore chat:", error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                type: 'bot',
                text: "Ho perso la connessione con il cervello centrale... 🔌 Riprova tra poco."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    // Use Portal to render outside of any overflow/transform container
    return ReactDOM.createPortal(
        <div className={`ai-assistant-container ${isOpen ? 'open' : ''}`}>
            {/* Chat Window */}
            {isOpen && (
                <div className="ai-chat-window">
                    <div className="ai-header">
                        <div className="ai-mascot-header">
                            <CandleMascot mood="happy" size={32} />
                            <div className="ai-title">
                                <span>Greeny AI</span>
                                <span className="ai-status">Online</span>
                            </div>
                        </div>
                        <div className="ai-controls">
                            <button onClick={() => setIsOpen(false)} className="ai-close-btn">
                                <Minimize2 size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="ai-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`ai-message ${msg.type}`}>
                                {msg.type === 'bot' && <div className="ai-avatar-small"><CandleMascot mood="happy" size={24} /></div>}
                                <div className="ai-bubble">
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="ai-message bot">
                                <div className="ai-avatar-small"><CandleMascot mood="thinking" size={24} /></div>
                                <div className="ai-bubble typing">
                                    <span>.</span><span>.</span><span>.</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="ai-input-area" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Chiedi a Greeny..."
                            autoFocus
                        />
                        <button type="submit" disabled={!inputValue.trim()}>
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Toggle Button */}
            {!isOpen && (
                <button className="ai-toggle-btn" onClick={() => setIsOpen(true)}>
                    <div className="ai-mascot-wrapper">
                        <CandleMascot mood="happy" size={40} />
                        <div className="ai-notification-dot"></div>
                    </div>
                </button>
            )}
        </div>,
        document.body
    );
};

export default AiAssistant;
