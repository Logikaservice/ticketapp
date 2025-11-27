import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'it-IT';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInputMessage(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Errore riconoscimento vocale:', event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Errore start recording:", e);
      }
    } else {
      alert("Il tuo browser non supporta il riconoscimento vocale.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Gestione touch events per microfono
  useEffect(() => {
    const micButton = micButtonRef.current;
    if (!micButton) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      startRecording();
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      stopRecording();
      // Non inviamo automaticamente per dare tempo di verificare il testo
    };

    const handleTouchCancel = (e) => {
      e.preventDefault();
      stopRecording();
    };

    micButton.addEventListener('touchstart', handleTouchStart, { passive: false });
    micButton.addEventListener('touchend', handleTouchEnd, { passive: false });
    micButton.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      micButton.removeEventListener('touchstart', handleTouchStart);
      micButton.removeEventListener('touchend', handleTouchEnd);
      micButton.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

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

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(errorData.error || 'Errore parsing comando');
      }

      const parsed = await parseResponse.json();

      // Verifica che i dati parsati siano validi
      if (!parsed || !parsed.contenuto) {
        throw new Error('Dati parsati non validi');
      }

      // Mostra risposta con analisi (NON mostrare il testo grezzo)
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `✅ Annuncio analizzato: "${parsed.contenuto_pulito || parsed.contenuto}"`,
        timestamp: new Date(),
        parsedData: parsed
      }]);

      setParsedAnnuncio(parsed);
    } catch (error) {
      console.error('Errore parsing comando:', error);
      const errorMessage = error.message || 'Errore sconosciuto durante l\'analisi del comando';
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `❌ Errore: ${errorMessage}\n\nAssicurati di includere:\n- Il messaggio dell'annuncio\n- La frequenza di ripetizione (es. "ogni 15 minuti")\n- Eventualmente la priorità`,
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
          
          // Aggiungi messaggio di conferma nella chat
          setMessages(prev => [...prev, {
            type: 'assistant',
            content: `✅ Annuncio creato e schedulato!\n\n📋 Messaggio: "${parsedAnnuncio.contenuto_pulito}"\n⏰ Ripetizione: ogni ${parsedAnnuncio.ripetizione_ogni} minuti\n🎯 Priorità: ${parsedAnnuncio.priorita}`,
            timestamp: new Date()
          }]);
          
          // Reset parsedAnnuncio dopo un breve delay per permettere all'utente di vedere il messaggio
          setTimeout(() => {
            setParsedAnnuncio(null);
            onAnnuncioCreated({
              ...parsedAnnuncio,
              speaker: 'Giulia',
              velocita: 1.0,
              tono: 1.0
            });
          }, 2000);
        } else {
          throw new Error('Errore nella schedulazione: ' + (scheduleData.error || 'Errore sconosciuto'));
        }
      } else {
        throw new Error('Errore nella creazione: ' + (createData.error || 'Errore sconosciuto'));
      }
    } catch (error) {
      console.error('Errore creazione annuncio:', error);
      const errorMessage = error.message || 'Errore sconosciuto durante la creazione dell\'annuncio';
      showNotification(errorMessage, 'error');
      
      // Aggiungi messaggio di errore nella chat
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `❌ Errore: ${errorMessage}\n\nRiprova o modifica il comando.`,
        timestamp: new Date()
      }]);
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

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className={`bg-white ${isMobile ? 'w-full h-full rounded-none' : 'rounded-2xl w-full max-w-2xl h-[80vh]'} flex flex-col shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 border-b border-slate-100 flex items-center justify-between ${isMobile ? 'bg-slate-50' : 'bg-white'}`}>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Mic size={18} />
              </span>
              Assistente Conad
            </h2>
            <p className="text-sm text-slate-500 flex items-center gap-2 ml-1 mt-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              Online • Vivaldi Connected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${isMobile ? 'max-w-[90%]' : ''} rounded-2xl p-4 shadow-sm ${msg.type === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                  }`}
              >
                {msg.type === 'assistant' && msg.parsedData ? (
                  // Se abbiamo dati parsati, mostra solo quelli (non il testo grezzo)
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">{msg.content}</p>
                  </div>
                ) : (
                  // Altrimenti mostra il contenuto normale
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}

                {/* Parsed Data Display */}
                {msg.parsedData && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          ANALISI INTENTO
                        </p>
                        <p className="text-sm font-semibold text-slate-700">{msg.parsedData.intento || 'Annuncio generico'}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Messaggio Pulito</p>
                        <p className="text-sm italic text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">"{msg.parsedData.contenuto_pulito || msg.parsedData.contenuto}"</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Schedulazione</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-bold">
                            {formatRipetizione(msg.parsedData.ripetizione_ogni)}
                          </span>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${msg.parsedData.priorita === 'Urgente' ? 'bg-red-50 text-red-700 border-red-100' :
                            msg.parsedData.priorita === 'Alta' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                              'bg-yellow-50 text-yellow-700 border-yellow-100'
                            }`}>
                            {msg.parsedData.priorita}
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
              <div className="bg-white border border-slate-100 rounded-2xl p-4 rounded-tl-none shadow-sm flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <p className="text-slate-500 text-sm font-medium">Elaborazione...</p>
              </div>
            </div>
          )}

          {parsedAnnuncio && (
            <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/10">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 mb-1">Conferma Programmazione</p>
                  <p className="text-sm text-slate-500 mb-4">Verifica i dettagli prima di confermare.</p>

                  <div className="space-y-3 text-sm mb-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Messaggio</span>
                      <p className="font-medium text-slate-800 bg-white p-2 rounded border border-slate-200">
                        "{parsedAnnuncio.contenuto_pulito || parsedAnnuncio.contenuto || 'Nessun messaggio'}"
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Ripetizione</span>
                        <p className="font-medium text-slate-800 bg-white p-2 rounded border border-slate-200">
                          {formatRipetizione(parsedAnnuncio.ripetizione_ogni)}
                        </p>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Priorità</span>
                        <p className={`font-medium p-2 rounded border ${
                          parsedAnnuncio.priorita === 'Urgente' ? 'bg-red-50 text-red-700 border-red-200' :
                          parsedAnnuncio.priorita === 'Alta' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          parsedAnnuncio.priorita === 'Media' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {parsedAnnuncio.priorita || 'Media'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmAnnuncio}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 font-bold shadow-md transition-all active:scale-[0.98]"
                  >
                    Conferma e Schedula
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t border-slate-100 ${isMobile ? 'bg-slate-50' : 'bg-white'}`}>
          {isMobile ? (
            /* Mobile Layout: Microfono grande centrale */
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Scrivi o tieni premuto..."
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                >
                  <Send size={20} />
                </button>
              </div>

              {/* Microfono grande centrale per mobile */}
              <button
                ref={micButtonRef}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${isRecording
                  ? 'bg-red-500 text-white scale-110 animate-pulse ring-4 ring-red-500/30'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/40 active:scale-95'
                  }`}
                title="Tieni premuto per parlare"
              >
                <Mic size={32} />
              </button>
              <p className="text-xs text-slate-500 text-center font-medium">
                Tieni premuto per parlare
              </p>
            </div>
          ) : (
            /* Desktop Layout: Input tradizionale */
            <div className="flex items-center gap-3">
              <button
                ref={micButtonRef}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                className={`p-3 rounded-xl transition-all ${isRecording
                  ? 'bg-red-500 text-white scale-110 ring-4 ring-red-500/30'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
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
                placeholder="Scrivi un comando o tieni premuto per parlare..."
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5"
              >
                <Send size={20} />
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3 text-center">
            Gemini potrebbe mostrare informazioni imprecise. Verifica sempre i dettagli.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GeminiAssistant;
