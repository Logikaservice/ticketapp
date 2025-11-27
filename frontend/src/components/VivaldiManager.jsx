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
        setSpeakers(data.speakers || []);
      }
    } catch (error) {
      console.error('Errore caricamento speaker:', error);
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
    } catch (error) {
      console.error('Errore salvataggio config:', error);
      showNotification('Errore salvataggio configurazione', 'error');
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-purple-900">Vivaldi - Sistema Annunci Vocali</h1>
            <p className="text-sm text-purple-700 mt-1">
              Gestione annunci vocali per punti vendita
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGeminiAssistant(!showGeminiAssistant)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-md"
            >
              <Mic size={18} />
              Assistente AI
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 border-b border-purple-200">
          {[
            { id: 'editor', label: 'Editor Annunci' },
            { id: 'queue', label: 'Coda' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'history', label: 'Storico' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-purple-600 hover:text-purple-800'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-900">Configurazione</h2>
              <button onClick={() => setShowSettings(false)} className="text-purple-700 hover:text-purple-900">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-purple-800">SpeechGen API Key</label>
                <input
                  type="text"
                  value={config.speechgen_api_key}
                  onChange={(e) => setConfig({ ...config, speechgen_api_key: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="f1d5e882-e8ab-49c0-ac47-2df3a6a30090"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-purple-800">SpeechGen Email</label>
                <input
                  type="email"
                  value={config.speechgen_email}
                  onChange={(e) => setConfig({ ...config, speechgen_email: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="logikaserivce@gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-purple-800">Gemini API Key</label>
                <input
                  type="text"
                  value={config.gemini_api_key}
                  onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Inserisci API Key Gemini"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md"
                >
                  Salva
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-purple-200 text-purple-700 rounded-lg hover:bg-purple-300"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Tab */}
      {activeTab === 'editor' && (
        <div className="bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-purple-900">Crea Nuovo Annuncio</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-purple-800">Contenuto Annuncio</label>
              <textarea
                value={annuncioForm.contenuto}
                onChange={(e) => setAnnuncioForm({ ...annuncioForm, contenuto: e.target.value })}
                className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg h-32 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Inserisci il testo dell'annuncio..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-purple-800">Speaker</label>
                <select
                  value={annuncioForm.speaker}
                  onChange={(e) => setAnnuncioForm({ ...annuncioForm, speaker: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {speakers.length > 0 ? (
                    speakers.map(s => (
                      <option key={s.id || s.name} value={s.name || s}>{s.name || s}</option>
                    ))
                  ) : (
                    <option value="Giulia">Giulia</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-purple-800">Priorità</label>
                <select
                  value={annuncioForm.priorita}
                  onChange={(e) => setAnnuncioForm({ ...annuncioForm, priorita: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-md"
              >
                <Plus size={18} />
                Crea Annuncio
              </button>
              {selectedAnnuncio && (
                <button
                  onClick={() => handleScheduleAnnuncio(selectedAnnuncio.id)}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-md"
                >
                  <Clock size={18} />
                  Schedula
                </button>
              )}
            </div>
          </div>

          {/* Lista Annunci Recenti */}
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4 text-purple-900">Annunci Recenti</h3>
            <div className="space-y-2">
              {annunci.slice(0, 10).map(annuncio => (
                <div
                  key={annuncio.id}
                  className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-between bg-white"
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
                        className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                      >
                        <Volume2 size={18} />
                      </button>
                    )}
                    {!annuncio.audio_url && (
                      <button
                        onClick={() => handleGenerateAudio(annuncio.id)}
                        className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                        title="Genera audio"
                      >
                        <Volume2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyAnnuncio(annuncio)}
                      className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
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
        <div className="bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-purple-900">Coda Annunci</h2>
          <div className="space-y-2">
            {queue.length === 0 ? (
              <p className="text-purple-600 text-center py-8">Nessun annuncio in coda</p>
            ) : (
              queue.map(item => (
                <div
                  key={item.id}
                  className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-between bg-white"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.contenuto_pulito || item.contenuto}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${getPrioritaColor(item.priorita)}`}>
                        {item.priorita}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.scheduled_for).toLocaleString('it-IT')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.stato === 'playing' && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        In riproduzione
                      </span>
                    )}
                    {item.stato === 'pending' && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
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

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-purple-900">Storico Esecuzioni</h2>
            <button
              onClick={loadHistory}
              className="px-4 py-2 bg-purple-200 text-purple-700 rounded-lg hover:bg-purple-300 transition-colors"
            >
              Aggiorna
            </button>
          </div>

          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-purple-600 text-center py-8">Nessun record nello storico</p>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-between bg-white"
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
    </div>
  );
};

export default VivaldiManager;

