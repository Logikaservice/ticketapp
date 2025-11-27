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
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-40 transition-all hover:scale-110 active:scale-95"
          title="Assistente AI"
      >
      <Mic size={28} />
        </button >
      )}
    </div >
  );
};

export default VivaldiManager;

