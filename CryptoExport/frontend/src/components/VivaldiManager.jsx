import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Plus, Clock, History, Volume2, Mic, Send, Copy, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import GeminiAssistant from './GeminiAssistant';
import VivaldiSettingsModal from './VivaldiSettingsModal';
import VivaldiQuickCreateModal from './VivaldiQuickCreateModal';

const VivaldiManager = ({ currentUser, getAuthHeader, showNotification }) => {
  // Stati principali
  const [showSettings, setShowSettings] = useState(false);
  const [showGeminiAssistant, setShowGeminiAssistant] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
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

  const handleQuickCreate = async (quickAnnuncio) => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/vivaldi/annunci'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...quickAnnuncio,
          azienda_id: currentUser?.azienda_id || 1
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Annuncio rapido creato', 'success');
        loadAnnunci();
        setShowQuickCreate(false);
      }
    } catch (error) {
      console.error('Errore creazione annuncio rapido:', error);
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
    <div className="p-4 bg-gray-50 min-h-screen font-sans relative">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Classico */}
        <div className="bg-slate-800 text-white p-4 rounded-lg shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md">
                <Volume2 size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Sistema Vivaldi</h1>
                <p className="text-slate-300 text-sm">Gestione Annunci Vocali</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGeminiAssistant(!showGeminiAssistant)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors shadow-md"
              >
                <Mic size={18} />
                Assistente AI
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded transition-colors ${showSettings ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title="Impostazioni"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'editor', label: 'Editor', icon: Plus },
              { id: 'queue', label: 'Coda', icon: Clock },
              { id: 'timeline', label: 'Timeline', icon: History },
              { id: 'history', label: 'Storico', icon: CheckCircle }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-4 py-2 rounded font-semibold text-sm transition-all flex items-center gap-2
                    ${isActive
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                  `}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="transition-all duration-500 ease-in-out">

          {/* Editor Tab */}
          {activeTab === 'editor' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Editor */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Plus size={18} />
                      </span>
                      Nuovo Annuncio
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Contenuto Messaggio</label>
                      <textarea
                        value={annuncioForm.contenuto}
                        onChange={(e) => setAnnuncioForm({ ...annuncioForm, contenuto: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none h-40 text-gray-700 placeholder-gray-400"
                        placeholder="Scrivi qui il testo dell'annuncio..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 ml-1">Voce Speaker</label>
                        <div className="relative">
                          <select
                            value={annuncioForm.speaker}
                            onChange={(e) => setAnnuncioForm({ ...annuncioForm, speaker: e.target.value })}
                            className="w-full pl-4 pr-10 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none transition-all cursor-pointer"
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
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <Volume2 size={16} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 ml-1">Priorità</label>
                        <div className="relative">
                          <select
                            value={annuncioForm.priorita}
                            onChange={(e) => setAnnuncioForm({ ...annuncioForm, priorita: e.target.value })}
                            className="w-full pl-4 pr-10 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none transition-all cursor-pointer"
                          >
                            <option value="Bassa">Bassa (30 min)</option>
                            <option value="Media">Media (15 min)</option>
                            <option value="Alta">Alta (10 min)</option>
                            <option value="Urgente">Urgente (7 min)</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <AlertCircle size={16} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-semibold text-gray-700">Velocità</label>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{annuncioForm.velocita.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={annuncioForm.velocita}
                          onChange={(e) => setAnnuncioForm({ ...annuncioForm, velocita: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-semibold text-gray-700">Tono</label>
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{annuncioForm.tono.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={annuncioForm.tono}
                          onChange={(e) => setAnnuncioForm({ ...annuncioForm, tono: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={handleCreateAnnuncio}
                        disabled={loading}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                        ) : (
                          <>
                            <Plus size={20} />
                            Crea Annuncio
                          </>
                        )}
                      </button>

                      {selectedAnnuncio && (
                        <button
                          onClick={() => handleScheduleAnnuncio(selectedAnnuncio.id)}
                          disabled={loading}
                          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2"
                        >
                          <Clock size={20} />
                          Schedula
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Recent List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-gray-800 text-lg">Recenti</h3>
                  <button onClick={loadAnnunci} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Aggiorna</button>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {annunci.slice(0, 10).map(annuncio => (
                    <div
                      key={annuncio.id}
                      className="group bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 cursor-pointer relative overflow-hidden"
                      onClick={() => setSelectedAnnuncio(annuncio)}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${annuncio.priorita === 'Urgente' ? 'bg-red-500' :
                        annuncio.priorita === 'Alta' ? 'bg-orange-500' :
                          annuncio.priorita === 'Media' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}></div>

                      <div className="pl-3">
                        <p className="font-medium text-gray-800 line-clamp-2 text-sm leading-relaxed mb-2">
                          {annuncio.contenuto_pulito || annuncio.contenuto}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Volume2 size={10} /> {annuncio.speaker}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {annuncio.audio_url ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePlayAudio(annuncio.audio_url); }}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Ascolta"
                              >
                                <Volume2 size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateAudio(annuncio.id); }}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Genera Audio"
                              >
                                <Volume2 size={16} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyAnnuncio(annuncio); }}
                              className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                              title="Copia"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Clock size={18} />
                  </span>
                  Coda di Riproduzione
                </h2>
                <div className="text-sm text-gray-500">
                  Aggiornamento automatico
                </div>
              </div>

              <div className="space-y-4">
                {queue.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <Clock size={32} />
                    </div>
                    <p className="text-gray-600 font-medium text-lg">La coda è vuota</p>
                    <p className="text-gray-400 text-sm mt-1">Gli annunci schedulati appariranno qui automaticamente</p>
                  </div>
                ) : (
                  queue.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`
                        relative p-5 rounded-lg border transition-all duration-300 flex items-center justify-between group
                        ${item.stato === 'playing'
                          ? 'bg-emerald-50 border-emerald-300 shadow-lg scale-[1.02] z-10'
                          : 'bg-white border-gray-200 hover:border-emerald-200 hover:shadow-md'}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg
                          ${item.stato === 'playing' ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-200 text-gray-600'}
                        `}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className={`font-semibold text-lg ${item.stato === 'playing' ? 'text-emerald-900' : 'text-gray-800'}`}>
                            {item.contenuto_pulito || item.contenuto}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${item.priorita === 'Urgente' ? 'bg-red-100 text-red-700' :
                              item.priorita === 'Alta' ? 'bg-orange-100 text-orange-700' :
                                item.priorita === 'Media' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                              {item.priorita}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                              <Clock size={12} />
                              {new Date(item.scheduled_for).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {item.stato === 'playing' && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-sm animate-pulse">
                            <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                            IN ONDA
                          </div>
                        )}
                        {item.stato === 'pending' && (
                          <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium text-sm">
                            In attesa
                          </div>
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
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                    <History size={18} />
                  </span>
                  Timeline Giornaliera
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Oggi */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
                    Oggi
                  </h3>
                  <div className="space-y-8 relative pl-8 border-l-2 border-gray-200">
                    {/* Mock Item 1 */}
                    <div className="relative">
                      <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-emerald-100 border-4 border-white shadow-sm flex items-center justify-center">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-800">Apertura Negozio</span>
                          <span className="text-sm font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">09:00</span>
                        </div>
                        <p className="text-sm text-gray-600">Benvenuti nel nostro punto vendita. Vi auguriamo buono shopping.</p>
                      </div>
                    </div>

                    {/* Mock Item 2 */}
                    <div className="relative">
                      <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-teal-100 border-4 border-white shadow-sm flex items-center justify-center">
                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-800">Offerta Lampo</span>
                          <span className="text-sm font-mono text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">10:30</span>
                        </div>
                        <p className="text-sm text-gray-600">Sconto del 20% su tutti i prodotti da forno per i prossimi 30 minuti.</p>
                      </div>
                    </div>

                    <div className="text-center pt-4">
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Fine Programmazione</p>
                    </div>
                  </div>
                </div>

                {/* Domani */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg">
                    <span className="w-3 h-3 rounded-full bg-teal-400 shadow-md"></span>
                    Domani
                  </h3>
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-gray-300">
                      <Clock size={24} />
                    </div>
                    <p className="text-gray-500 font-medium">Nessuna programmazione</p>
                    <button className="mt-4 text-emerald-600 text-sm font-semibold hover:underline">
                      Copia da oggi
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                    <CheckCircle size={18} />
                  </span>
                  Storico Esecuzioni
                </h2>
                <button
                  onClick={loadHistory}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md"
                >
                  Aggiorna
                </button>
              </div>

              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">Nessun record nello storico</p>
                ) : (
                  history.map(item => (
                    <div
                      key={item.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white hover:shadow-md transition-all flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.contenuto_pulito || item.contenuto}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.priorita === 'Urgente' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                            {item.priorita}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.eseguito_at).toLocaleString('it-IT')}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteHistory(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal - Premium Style */}
      <VivaldiSettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        setConfig={setConfig}
        onSave={handleSaveConfig}
        onTestConnection={handleTestConnection}
        testingConnection={testingConnection}
        testResults={testResults}
        getAuthHeader={getAuthHeader}
      />

      {/* Gemini Assistant Modal - Premium Style */}
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

      {/* Hidden Audio Player */}
      <audio ref={audioPlayerRef} className="hidden" onEnded={() => setPlayingAudio(null)} />

      {/* Mobile Quick Create FAB */}
      <button
        onClick={() => setShowQuickCreate(true)}
        className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
      >
        <Plus size={28} />
      </button>

      {/* Mobile Quick Create Modal */}
      <VivaldiQuickCreateModal
        show={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onCreate={handleQuickCreate}
        speakers={speakers}
        loading={loading}
      />
    </div>
  );
};

export default VivaldiManager;
