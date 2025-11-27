import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Plus, Clock, History, Volume2, Mic, Send, Copy, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import GeminiAssistant from './GeminiAssistant';

const VivaldiManager = ({ currentUser, getAuthHeader, showNotification }) => {
  // Stati principali
  const [showSettings, setShowSettings] = useState(false);
  const [showGeminiAssistant, setShowGeminiAssistant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'queue', 'timeline', 'history'

  // Configurazione
  const [config, setConfig] = useState({
    speechgen_api_key: '',
    speechgen_email: '',
    gemini_api_key: ''
  });
  const [testResults, setTestResults] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [speakers, setSpeakers] = useState([]);

  // Editor annunci
  const [annuncioForm, setAnnuncioForm] = useState({
    contenuto: '',
    contenuto_pulito: '',
    speaker: 'Giulia',
    velocita: 1.0,
    tono: 1.0,
    priorita: 'Media',
    tipo: 'testuale'
  });

  // Lista annunci
  const [annunci, setAnnunci] = useState([]);
  const [selectedAnnuncio, setSelectedAnnuncio] = useState(null);

  // Coda annunci
  const [queue, setQueue] = useState([]);

  // Timeline (oggi/domani)
  const [timeline, setTimeline] = useState({
    oggi: [],
    domani: []
  });

  // Storico
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState({
    azienda_id: null,
    limit: 100
  });

  // Player audio
  const audioPlayerRef = useRef(null);
  const [playingAudio, setPlayingAudio] = useState(null);

  // Rileva se siamo su mobile
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Carica configurazione
  useEffect(() => {
    loadConfig();
    loadSpeakers();
    loadAnnunci();
    loadQueue();
    loadHistory();

    // Aggiorna coda ogni 5 secondi
    const queueInterval = setInterval(loadQueue, 5000);
    return () => clearInterval(queueInterval);
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/config'), {
        headers: getAuthHeader()
      });
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Errore caricamento config:', error);
    }
  };

  const loadSpeakers = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/speakers'), {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📢 Speaker ricevuti dal backend:', data);
        const speakersList = data.speakers || [];
        console.log(`✅ Caricati ${speakersList.length} speaker:`, speakersList.map(s => s.name || s).join(', '));
        setSpeakers(speakersList);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore caricamento speaker:', errorData);
        // Fallback: mantieni almeno un speaker di default
        if (speakers.length === 0) {
          setSpeakers([{ id: 'Giulia', name: 'Giulia' }]);
        }
      }
    } catch (error) {
      console.error('❌ Errore caricamento speaker:', error);
      // Fallback: mantieni almeno un speaker di default
      if (speakers.length === 0) {
        setSpeakers([{ id: 'Giulia', name: 'Giulia' }]);
      }
    }
  };

  const loadAnnunci = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/annunci'), {
        headers: getAuthHeader()
      });
      const data = await response.json();
      setAnnunci(data.annunci || []);
    } catch (error) {
      console.error('Errore caricamento annunci:', error);
    }
  };

  const loadQueue = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/queue'), {
        headers: getAuthHeader()
      });
      const data = await response.json();
      setQueue(data.queue || []);
    } catch (error) {
      console.error('Errore caricamento coda:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (historyFilter.azienda_id) params.append('azienda_id', historyFilter.azienda_id);
      params.append('limit', historyFilter.limit);

      const response = await fetch(buildApiUrl(`/api/vivaldi/history?${params}`), {
        headers: getAuthHeader()
      });
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Errore caricamento storico:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      for (const [chiave, valore] of Object.entries(config)) {
        await fetch(buildApiUrl('/api/vivaldi/config'), {
          method: 'PUT',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ chiave, valore })
        });
      }
      showNotification('Configurazione salvata', 'success');
      setShowSettings(false);
      // Ricarica speaker dopo salvataggio
      loadSpeakers();
    } catch (error) {
      console.error('Errore salvataggio config:', error);
      showNotification('Errore salvataggio configurazione', 'error');
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResults(null);
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/test-connection'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Errore test connessione:', error);
      showNotification('Errore durante il test', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateAnnuncio = async () => {
    if (!annuncioForm.contenuto.trim()) {
      showNotification('Inserisci il contenuto dell\'annuncio', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/annunci'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...annuncioForm,
          azienda_id: currentUser?.azienda_id || 1
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Annuncio creato con successo', 'success');
        setAnnuncioForm({
          contenuto: '',
          contenuto_pulito: '',
          speaker: 'Giulia',
          velocita: 1.0,
          tono: 1.0,
          priorita: 'Media',
          tipo: 'testuale'
        });
        loadAnnunci();
      }
    } catch (error) {
      console.error('Errore creazione annuncio:', error);
      showNotification('Errore creazione annuncio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleAnnuncio = async (annuncioId) => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl(`/api/vivaldi/annunci/${annuncioId}/schedule`), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          priorita: annuncioForm.priorita
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Annuncio schedulato con successo', 'success');
        loadQueue();
      }
    } catch (error) {
      console.error('Errore schedulazione annuncio:', error);
      showNotification('Errore schedulazione annuncio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAudio = async (annuncioId) => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl(`/api/vivaldi/annunci/${annuncioId}/generate-audio`), {
        method: 'POST',
        headers: getAuthHeader()
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Audio generato con successo', 'success');
        loadAnnunci();
      }
    } catch (error) {
      console.error('Errore generazione audio:', error);
      showNotification('Errore generazione audio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = (audioUrl) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.play();
      setPlayingAudio(audioUrl);
    }
  };

  const handleCopyAnnuncio = async (annuncio) => {
    setAnnuncioForm({
      contenuto: annuncio.contenuto,
      contenuto_pulito: annuncio.contenuto_pulito || annuncio.contenuto,
      speaker: annuncio.speaker,
      velocita: parseFloat(annuncio.velocita),
      tono: parseFloat(annuncio.tono),
      priorita: annuncio.priorita,
      tipo: annuncio.tipo
    });
    setActiveTab('editor');
    showNotification('Annuncio copiato nell\'editor', 'success');
  };

  const handleDeleteHistory = async (historyId) => {
    if (!window.confirm('Eliminare questo record dallo storico?')) return;

    try {
      const response = await fetch(buildApiUrl(`/api/vivaldi/history/${historyId}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Record eliminato', 'success');
        loadHistory();
      }
    } catch (error) {
      console.error('Errore eliminazione storico:', error);
      showNotification('Errore eliminazione record', 'error');
    }
  };

  const getPrioritaColor = (priorita) => {
    const colors = {
      'Urgente': 'bg-red-100 text-red-800 border-red-300',
      'Alta': 'bg-orange-100 text-orange-800 border-orange-300',
      'Media': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Bassa': 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[priorita] || colors['Media'];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vivaldi - Sistema Annunci Vocali</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gestione annunci vocali per punti vendita
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGeminiAssistant(!showGeminiAssistant)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Mic size={18} />
              Assistente AI
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 border-b">
          {[
            { id: 'editor', label: 'Editor Annunci' },
            { id: 'queue', label: 'Coda' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'history', label: 'Storico' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium ${activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gemini Assistant Modal */}
      {showGeminiAssistant && (
        <GeminiAssistant
          onClose={() => setShowGeminiAssistant(false)}
          onAnnuncioCreated={(annuncio) => {
            setAnnuncioForm(annuncio);
            setActiveTab('editor');
            setShowGeminiAssistant(false);
            loadAnnunci();
          }}
          getAuthHeader={getAuthHeader}
          showNotification={showNotification}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="text-blue-600" /> Configurazione Vivaldi
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-900 transition-colors p-1 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Volume2 size={18} /> SpeechGen.io
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700">API Key</label>
                    <input
                      type="text"
                      value={config.speechgen_api_key}
                      onChange={(e) => setConfig({ ...config, speechgen_api_key: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                      placeholder="f1d5e882-..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700">Email Account</label>
                    <input
                      type="email"
                      value={config.speechgen_email}
                      onChange={(e) => setConfig({ ...config, speechgen_email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <Mic size={18} /> Google Gemini AI
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">API Key (Opzionale)</label>
                  <input
                    type="text"
                    value={config.gemini_api_key}
                    onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-sm"
                    placeholder="AIzaSy..."
                  />
                </div>
              </div>

              {/* Test Results Area */}
              {testResults && (
                <div className={`p-4 rounded-lg text-sm border ${testResults.speechgen.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <p className="font-bold mb-1">Risultato Test SpeechGen:</p>
                  <p>{testResults.speechgen.message}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {testingConnection ? 'Test in corso...' : 'Test Connessione'}
                </button>
                <div className="flex-1"></div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
                >
                  Salva Configurazione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Tab */}
      {activeTab === 'editor' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Crea Nuovo Annuncio</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Contenuto Annuncio</label>
              <textarea
                value={annuncioForm.contenuto}
                onChange={(e) => setAnnuncioForm({ ...annuncioForm, contenuto: e.target.value })}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg h-32 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Inserisci il testo dell'annuncio..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Speaker</label>
                <select
                  value={annuncioForm.speaker}
                  onChange={(e) => setAnnuncioForm({ ...annuncioForm, speaker: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {speakers.length > 0 ? (
                    speakers.map(s => (
                      <option key={s.id || s.name} value={s.name || s}>
                        {s.name || s} {s.isPlus ? '⭐' : ''}
                      </option>
                    ))
                  ) : (
                    <option value="Giulia">Giulia</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Priorità</label>
                <select
                  value={annuncioForm.priorita}
                  onChange={(e) => setAnnuncioForm({ ...annuncioForm, priorita: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Bassa">Bassa (30 min)</option>
                  <option value="Media">Media (15 min)</option>
                  <option value="Alta">Alta (10 min)</option>
                  <option value="Urgente">Urgente (7 min)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Velocità: {annuncioForm.velocita.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={annuncioForm.velocita}
                  onChange={(e) => setAnnuncioForm({ ...annuncioForm, velocita: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Tono: {annuncioForm.tono.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={annuncioForm.tono}
                  onChange={(e) => setAnnuncioForm({ ...annuncioForm, tono: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateAnnuncio}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={18} />
                Crea Annuncio
              </button>
              {selectedAnnuncio && (
                <button
                  onClick={() => handleScheduleAnnuncio(selectedAnnuncio.id)}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Clock size={18} />
                  Schedula
                </button>
              )}
            </div>
          </div>

          {/* Lista Annunci Recenti */}
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Annunci Recenti</h3>
            <div className="space-y-2">
              {annunci.slice(0, 10).map(annuncio => (
                <div
                  key={annuncio.id}
                  className="p-4 border rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between bg-white"
                >
                  <div className="flex-1">
                    <p className="font-medium">{annuncio.contenuto_pulito || annuncio.contenuto}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${getPrioritaColor(annuncio.priorita)}`}>
                        {annuncio.priorita}
                      </span>
                      <span className="text-xs text-gray-500">{annuncio.speaker}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {annuncio.audio_url && (
                      <button
                        onClick={() => handlePlayAudio(annuncio.audio_url)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Volume2 size={18} />
                      </button>
                    )}
                    {!annuncio.audio_url && (
                      <button
                        onClick={() => handleGenerateAudio(annuncio.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Genera audio"
                      >
                        <Volume2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyAnnuncio(annuncio)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold mb-6 text-gray-900 flex items-center gap-2">
            <Clock className="text-blue-600" /> Coda di Riproduzione
          </h2>
          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Nessun annuncio in coda al momento</p>
                <p className="text-sm text-gray-400 mt-1">Gli annunci schedulati appariranno qui</p>
              </div>
            ) : (
              queue.map(item => (
                <div
                  key={item.id}
                  className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 flex items-center justify-between bg-white group"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{item.contenuto_pulito || item.contenuto}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPrioritaColor(item.priorita)}`}>
                        {item.priorita}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(item.scheduled_for).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.stato === 'playing' && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold animate-pulse">
                        IN RIPRODUZIONE
                      </span>
                    )}
                    {item.stato === 'pending' && (
                      <span className="px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-medium">
                        In attesa
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold mb-6 text-gray-900 flex items-center gap-2">
            <History className="text-purple-600" /> Timeline Annunci
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Oggi */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Oggi
              </h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {/* Mock data per ora, andrebbe popolato con dati reali */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-emerald-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <Clock size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-slate-900">Annuncio Apertura</div>
                      <time className="font-caveat font-medium text-indigo-500">09:00</time>
                    </div>
                    <div className="text-slate-500 text-sm">Benvenuti nel nostro punto vendita.</div>
                  </div>
                </div>
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-emerald-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <Clock size={16} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-slate-900">Offerta Speciale</div>
                      <time className="font-caveat font-medium text-indigo-500">10:30</time>
                    </div>
                    <div className="text-slate-500 text-sm">Sconto del 20% su tutti i prodotti freschi.</div>
                  </div>
                </div>
              </div>
              <p className="text-center text-gray-400 text-sm mt-4 italic">Visualizzazione timeline in sviluppo...</p>
            </div>

            {/* Domani */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Domani
              </h3>
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">Nessun annuncio programmato per domani</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Storico Esecuzioni</h2>
            <button
              onClick={loadHistory}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Aggiorna
            </button>
          </div>

          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nessun record nello storico</p>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between bg-white"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.contenuto_pulito || item.contenuto}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${getPrioritaColor(item.priorita)}`}>
                        {item.priorita}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.eseguito_at).toLocaleString('it-IT')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteHistory(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Audio Player (hidden) */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingAudio(null)}
        className="hidden"
      />

      {/* Floating Action Button per Mobile - Accesso Diretto Assistente AI */}
      {isMobile && !showGeminiAssistant && (
        <button
          onClick={() => setShowGeminiAssistant(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-40 transition-all hover:scale-110 active:scale-95"
          title="Assistente AI"
        >
          <Mic size={28} />
        </button>
      )}
    </div>
  );
};

export default VivaldiManager;

