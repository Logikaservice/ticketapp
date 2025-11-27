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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Assistente Conad</h2>
            <p className="text-sm text-gray-600">Online • Vivaldi Connected</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
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
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.type === 'user'
                    ? 'bg-red-100 text-red-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Parsed Data Display */}
                {msg.parsedData && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">ANALISI INTENTO</p>
                        <p className="text-sm font-medium">{msg.parsedData.intento || 'Annuncio generico'}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">MESSAGGIO PULITO</p>
                        <p className="text-sm">{msg.parsedData.contenuto_pulito || msg.parsedData.contenuto}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {formatRipetizione(msg.parsedData.ripetizione_ogni)} & {msg.parsedData.priorita}
                        </span>
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          A standard_female
                        </span>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-blue-600 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-2">Conferma Annuncio</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>Testo:</strong> {parsedAnnuncio.contenuto_pulito}</p>
                    <p><strong>Priorità:</strong> {parsedAnnuncio.priorita}</p>
                    <p><strong>Ripetizione:</strong> {formatRipetizione(parsedAnnuncio.ripetizione_ogni)}</p>
                  </div>
                  <button
                    onClick={handleConfirmAnnuncio}
                    disabled={isProcessing}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              onMouseLeave={() => setIsRecording(false)}
              className={`p-2 rounded-lg ${
                isRecording ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isProcessing}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Gemini potrebbe mostrare informazioni imprecise, anche riguardo a persone, quindi verifica le sue risposte.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeminiAssistant;

