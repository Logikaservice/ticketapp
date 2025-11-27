import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, X, Volume2, CheckCircle, AlertCircle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const GeminiAssistant = ({ onClose, onAnnuncioCreated, getAuthHeader, showNotification }) => {
  const [messages, setMessages] = useState([
    {
      type: 'assistant',
      content: 'Ciao! Sono pronto. Tieni premuto il microfono per dare un annuncio.',
      timestamp: new Date()
    },
    {
      type: 'assistant',
      content: 'Esempio: "Di ai clienti che il parcheggio chiude alle 21, ripetilo ogni 15 minuti."',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedAnnuncio, setParsedAnnuncio] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const micButtonRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Rileva se siamo su mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Gestione touch events per microfono
  useEffect(() => {
    const micButton = micButtonRef.current;
    if (!micButton) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      setIsRecording(true);
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      if (isRecording && inputMessage.trim()) {
        handleSendMessage();
      }
      setIsRecording(false);
    };

    const handleTouchCancel = (e) => {
      e.preventDefault();
      setIsRecording(false);
    };

    micButton.addEventListener('touchstart', handleTouchStart, { passive: false });
    micButton.addEventListener('touchend', handleTouchEnd, { passive: false });
    micButton.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      micButton.removeEventListener('touchstart', handleTouchStart);
      micButton.removeEventListener('touchend', handleTouchEnd);
      micButton.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [isRecording, inputMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);

    // Aggiungi messaggio utente
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    try {
      // Parsa comando con Gemini
      const parseResponse = await fetch(buildApiUrl('/api/vivaldi/parse'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMessage })
      });

      const parsed = await parseResponse.json();

      // Mostra risposta con analisi
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'Ricevuto. Ecco cosa ho programmato:',
        timestamp: new Date(),
        parsedData: parsed
      }]);

      setParsedAnnuncio(parsed);
    } catch (error) {
      console.error('Errore parsing comando:', error);
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'Errore nell\'analisi del comando. Riprova.',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAnnuncio = async () => {
    if (!parsedAnnuncio) return;

    setIsProcessing(true);
    try {
      // Crea annuncio
      const createResponse = await fetch(buildApiUrl('/api/vivaldi/annunci'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contenuto: parsedAnnuncio.contenuto,
          contenuto_pulito: parsedAnnuncio.contenuto_pulito,
          priorita: parsedAnnuncio.priorita,
          speaker: 'Giulia',
          velocita: 1.0,
          tono: 1.0,
          tipo: 'testuale'
        })
      });

      const createData = await createResponse.json();
      if (createData.success) {
        // Crea schedulazione
        const scheduleResponse = await fetch(buildApiUrl(`/api/vivaldi/annunci/${createData.annuncio.id}/schedule`), {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            priorita: parsedAnnuncio.priorita,
            ripetizione_ogni: parsedAnnuncio.ripetizione_ogni,
            ripetizione_fino_a: parsedAnnuncio.ripetizione_fino_a
          })
        });

        const scheduleData = await scheduleResponse.json();
        if (scheduleData.success) {
          showNotification('Annuncio creato e schedulato con successo!', 'success');
          onAnnuncioCreated({
            ...parsedAnnuncio,
            speaker: 'Giulia',
            velocita: 1.0,
            tono: 1.0
          });
        }
      }
    } catch (error) {
      console.error('Errore creazione annuncio:', error);
      showNotification('Errore creazione annuncio', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatRipetizione = (minuti) => {
    if (!minuti) return 'una tantum';
    if (minuti < 60) return `ogni ${minuti} minuti`;
    const ore = Math.floor(minuti / 60);
    const min = minuti % 60;
    if (min === 0) return `ogni ${ore} ${ore === 1 ? 'ora' : 'ore'}`;
    return `ogni ${ore}h ${min}min`;
  };

  return (
    <div className={`fixed inset-0 ${isMobile ? 'bg-white' : 'bg-black bg-opacity-50'} flex items-center justify-center z-50`}>
      <div className={`bg-white ${isMobile ? 'w-full h-full rounded-none' : 'rounded-lg w-full max-w-2xl h-[80vh]'} flex flex-col`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isMobile ? 'bg-gradient-to-r from-purple-50 to-pink-50' : ''}`}>
          <div>
            <h2 className="text-xl font-bold text-purple-900">Assistente Conad</h2>
            <p className="text-sm text-purple-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Online • Vivaldi Connected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-100 rounded-lg text-purple-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${isMobile ? 'max-w-[90%]' : ''} rounded-lg p-3 ${
                  msg.type === 'user'
                    ? 'bg-red-100 border-2 border-red-300 text-red-900'
                    : 'bg-gray-100 border border-gray-300 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Parsed Data Display */}
                {msg.parsedData && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          ANALISI INTENTO
                        </p>
                        <p className="text-sm font-medium">{msg.parsedData.intento || 'Annuncio generico'}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Messaggio Pulito:</p>
                        <p className="text-sm italic">"{msg.parsedData.contenuto_pulito || msg.parsedData.contenuto}"</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Schedulazione:</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                            {formatRipetizione(msg.parsedData.ripetizione_ogni)} & {msg.parsedData.priorita}
                          </span>
                          <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                            standard_female
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-gray-600">Elaborazione in corso...</p>
              </div>
            </div>
          )}

          {parsedAnnuncio && (
            <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-600 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-2">Ricevuto. Ecco cosa ho programmato:</p>
                  <div className="space-y-2 text-sm mb-3">
                    <p><strong>Messaggio Pulito:</strong> "{parsedAnnuncio.contenuto_pulito}"</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        {formatRipetizione(parsedAnnuncio.ripetizione_ogni)} & {parsedAnnuncio.priorita}
                      </span>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        standard_female
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleConfirmAnnuncio}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-semibold shadow-md"
                  >
                    Conferma
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${isMobile ? 'bg-gradient-to-r from-purple-50 to-pink-50' : ''}`}>
          {isMobile ? (
            /* Mobile Layout: Microfono grande centrale */
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 w-full">
                <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Scrivi o tieni premuto il microfono..."
                  className="flex-1 px-4 py-3 border-2 border-purple-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
              
              {/* Microfono grande centrale per mobile */}
              <button
                ref={micButtonRef}
                onMouseDown={() => setIsRecording(true)}
                onMouseUp={() => {
                  if (isRecording && inputMessage.trim()) {
                    handleSendMessage();
                  }
                  setIsRecording(false);
                }}
                onMouseLeave={() => setIsRecording(false)}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white scale-110 animate-pulse' 
                    : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                }`}
                title="Tieni premuto per parlare"
              >
                <Mic size={32} />
              </button>
              <p className="text-xs text-purple-600 text-center font-medium">
                Tieni premuto per parlare
              </p>
            </div>
          ) : (
            /* Desktop Layout: Input tradizionale */
            <div className="flex items-center gap-2">
              <button
                ref={micButtonRef}
                onMouseDown={() => setIsRecording(true)}
                onMouseUp={() => {
                  if (isRecording && inputMessage.trim()) {
                    handleSendMessage();
                  }
                  setIsRecording(false);
                }}
                onMouseLeave={() => setIsRecording(false)}
                className={`p-3 rounded-lg transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white scale-110' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Tieni premuto per parlare"
              >
                <Mic size={20} />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tieni premuto per parlare"
                className="flex-1 px-4 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2 text-center">
            Gemini potrebbe mostrare informazioni imprecise, anche riguardo a persone, quindi verifica le sue risposte.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeminiAssistant;

