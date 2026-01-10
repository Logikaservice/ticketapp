// src/components/Modals/CreateAgentModal.jsx
// Modal wizard per creazione guidata agent Network Monitoring

import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Copy, CheckCircle, AlertCircle, Wifi, Building, Server, Clock, ChevronRight, Loader } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const CreateAgentModal = ({ isOpen, onClose, getAuthHeader, onAgentCreated, setShowCreateAgentModal }) => {
  const [step, setStep] = useState(1); // 1: Informazioni, 2: Configurazione, 3: Download
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    agent_name: '',
    azienda_id: '',
    network_ranges: ['192.168.1.0/24'], // Array di range IP
    scan_interval_minutes: 15
  });
  const [createdAgent, setCreatedAgent] = useState(null);
  const [configJson, setConfigJson] = useState(null);
  const [copied, setCopied] = useState(false);

  // Carica lista aziende al mount
  useEffect(() => {
    if (isOpen && companies.length === 0) {
      loadCompanies();
    }
  }, [isOpen]);

  // Usa localStorage per persistere lo stato durante i refresh
  const STORAGE_KEY = 'createAgentModal_state';
  
  // Salva lo stato in localStorage quando raggiungi lo step 3
  useEffect(() => {
    if (step === 3 && createdAgent && configJson) {
      const stateToSave = {
        step: 3,
        createdAgent,
        configJson,
        formData,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.error('Errore salvataggio stato:', e);
      }
    }
  }, [step, createdAgent, configJson, formData]);

  // Ripristina lo stato da localStorage quando il modal si apre (solo se lo stato è stato perso)
  const hasRestoredStateRef = useRef(false);
  useEffect(() => {
    if (isOpen && !hasRestoredStateRef.current) {
      try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          // Ripristina solo se salvato meno di 1 ora fa (evita stati vecchi)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
            // Ripristina solo se lo stato attuale è vuoto (step 1, no agent)
            if (step === 1 && !createdAgent) {
              setStep(parsed.step || 1);
              setCreatedAgent(parsed.createdAgent);
              setConfigJson(parsed.configJson);
              if (parsed.formData) {
                setFormData(parsed.formData);
              }
              hasRestoredStateRef.current = true;
            }
          } else {
            // Stato troppo vecchio, rimuovilo
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error('Errore ripristino stato:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    } else if (!isOpen) {
      // Reset flag quando il modal viene chiuso
      hasRestoredStateRef.current = false;
    }
  }, [isOpen, step, createdAgent]);

  // Reset form quando il modal viene chiuso (gestito da handleCloseModal)
  // Non resettare automaticamente qui per evitare perdita di stato durante refresh

  // Funzione per chiudere il modal esplicitamente
  const handleCloseModal = (shouldRefresh = false) => {
    // Pulisci localStorage e resetta tutto
    localStorage.removeItem(STORAGE_KEY);
    setStep(1);
    setFormData({
      agent_name: '',
      azienda_id: '',
      network_ranges: ['192.168.1.0/24'],
      scan_interval_minutes: 15
    });
    setCreatedAgent(null);
    setConfigJson(null);
    setError(null);
    setCopied(false);
    
    if (setShowCreateAgentModal) {
      setShowCreateAgentModal(false);
    }
    if (shouldRefresh && typeof onClose === 'function') {
      setTimeout(() => onClose(true), 200);
    } else if (typeof onClose === 'function') {
      onClose(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/companies'), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento aziende');
      }

      const data = await response.json();
      setCompanies(data);
    } catch (err) {
      console.error('Errore caricamento aziende:', err);
      setError('Errore caricamento aziende');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNetworkRangeChange = (index, value) => {
    const newRanges = [...formData.network_ranges];
    newRanges[index] = value;
    setFormData(prev => ({
      ...prev,
      network_ranges: newRanges
    }));
  };

  const addNetworkRange = () => {
    setFormData(prev => ({
      ...prev,
      network_ranges: [...prev.network_ranges, '']
    }));
  };

  const removeNetworkRange = (index) => {
    if (formData.network_ranges.length > 1) {
      const newRanges = formData.network_ranges.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        network_ranges: newRanges
      }));
    }
  };

  const validateStep1 = () => {
    if (!formData.agent_name.trim()) {
      setError('Nome agent richiesto');
      return false;
    }
    if (!formData.azienda_id) {
      setError('Seleziona un\'azienda');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const validRanges = formData.network_ranges.filter(r => r.trim() && r.match(/^\d+\.\d+\.\d+\.\d+\/\d+$/));
    if (validRanges.length === 0) {
      setError('Inserisci almeno un range IP valido (es: 192.168.1.0/24)');
      return false;
    }
    if (formData.scan_interval_minutes < 1 || formData.scan_interval_minutes > 1440) {
      setError('Intervallo scansione deve essere tra 1 e 1440 minuti');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      createAgent();
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const createAgent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Valida range IP (rimuovi vuoti e invalidi)
      const validRanges = formData.network_ranges.filter(r => r.trim() && r.match(/^\d+\.\d+\.\d+\.\d+\/\d+$/));

      const response = await fetch(buildApiUrl('/api/network-monitoring/agent/register'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_name: formData.agent_name.trim(),
          azienda_id: parseInt(formData.azienda_id),
          network_ranges: validRanges,
          scan_interval_minutes: parseInt(formData.scan_interval_minutes)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore creazione agent');
      }

      const data = await response.json();
      setCreatedAgent(data.agent);

      // Genera config.json
      // Usa l'URL corrente come base (funziona sia per localhost che per produzione)
      const serverUrl = window.location.origin;
      const config = {
        server_url: serverUrl,
        api_key: data.agent.api_key,
        agent_name: data.agent.agent_name,
        version: "1.0.0",
        network_ranges: validRanges,
        scan_interval_minutes: parseInt(formData.scan_interval_minutes)
      };

      setConfigJson(config);
      setStep(3);
      
      // Notifica il componente padre che l'agent è stato creato (senza chiudere il modal)
      if (onAgentCreated) {
        onAgentCreated(data.agent);
      }
    } catch (err) {
      console.error('Errore creazione agent:', err);
      setError(err.message || 'Errore creazione agent');
    } finally {
      setLoading(false);
    }
  };

  const downloadConfig = () => {
    if (!configJson) return;

    const blob = new Blob([JSON.stringify(configJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyConfigToClipboard = () => {
    if (!configJson) return;

    navigator.clipboard.writeText(JSON.stringify(configJson, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyApiKey = () => {
    if (!createdAgent) return;
    navigator.clipboard.writeText(createdAgent.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Wifi size={28} />
                Crea Nuovo Agent
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {step === 1 && 'Passo 1/3: Informazioni agent'}
                {step === 2 && 'Passo 2/3: Configurazione rete'}
                {step === 3 && 'Passo 3/3: Download configurazione'}
              </p>
            </div>
            <button
              onClick={() => {
                // Chiama handleCloseModal che gestisce il reset
                handleCloseModal(step === 3 && createdAgent);
              }}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="p-4 border-b bg-gray-50 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                {step > s ? <CheckCircle size={20} /> : s}
              </div>
              {s < 3 && (
                <div className={`h-1 w-12 ${step > s ? 'bg-blue-600' : 'bg-gray-300'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Step 1: Informazioni */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Agent *
                </label>
                <input
                  type="text"
                  value={formData.agent_name}
                  onChange={(e) => handleInputChange('agent_name', e.target.value)}
                  placeholder="Es: Agent PC Casa, Agent Server Ufficio"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Azienda *
                </label>
                <select
                  value={formData.azienda_id}
                  onChange={(e) => handleInputChange('azienda_id', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleziona un'azienda</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.azienda} {company.agents_count > 0 && `(${company.agents_count} agent)`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Configurazione Rete */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Range di Rete da Monitorare *
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Inserisci i range IP da scansionare (es: 192.168.1.0/24)
                </p>
                {formData.network_ranges.map((range, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={range}
                      onChange={(e) => handleNetworkRangeChange(index, e.target.value)}
                      placeholder="192.168.1.0/24"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.network_ranges.length > 1 && (
                      <button
                        onClick={() => removeNetworkRange(index)}
                        className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addNetworkRange}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Aggiungi altro range
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervallo Scansione (minuti) *
                </label>
                <input
                  type="number"
                  value={formData.scan_interval_minutes}
                  onChange={(e) => handleInputChange('scan_interval_minutes', parseInt(e.target.value) || 15)}
                  min="1"
                  max="1440"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Quanto spesso scansionare la rete (default: 15 minuti)
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Download */}
          {step === 3 && createdAgent && configJson && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <CheckCircle size={20} />
                  <span className="font-semibold">Agent creato con successo!</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Nome:</strong> {createdAgent.agent_name}</p>
                  <p><strong>ID Agent:</strong> {createdAgent.id}</p>
                  <p><strong>Data creazione:</strong> {new Date(createdAgent.created_at).toLocaleString('it-IT')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key (salvala in un posto sicuro!)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createdAgent.api_key}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={copyApiKey}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiato!' : 'Copia'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File config.json
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Scarica questo file e copialo nella cartella dell'agent PowerShell come <code className="bg-gray-100 px-1 rounded">config.json</code>
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2">
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(configJson, null, 2)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadConfig}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Scarica config.json
                  </button>
                  <button
                    onClick={copyConfigToClipboard}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiato!' : 'Copia'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ⚠️ <strong>Nota:</strong> Scarica anche <code className="bg-gray-100 px-1 rounded">NetworkMonitor.ps1</code> e <code className="bg-gray-100 px-1 rounded">NetworkMonitorInstaller.ps1</code> dalla cartella <code className="bg-gray-100 px-1 rounded">agent/</code> del progetto
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">📦 Pacchetto di installazione:</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Per installare l'agent sul PC Windows, hai bisogno di 3 file:
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside mb-3">
                  <li><code className="bg-blue-100 px-1 rounded">config.json</code> (scaricato sopra ✅)</li>
                  <li><code className="bg-blue-100 px-1 rounded">NetworkMonitor.ps1</code> (dalla cartella <code className="bg-blue-100 px-1 rounded">agent/</code> del progetto)</li>
                  <li><code className="bg-blue-100 px-1 rounded">NetworkMonitorInstaller.ps1</code> (dalla cartella <code className="bg-blue-100 px-1 rounded">agent/</code> del progetto)</li>
                </ul>
                
                <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">🚀 Installazione automatica:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Copia tutti e 3 i file nella stessa cartella sul PC Windows</li>
                    <li>
                      <strong>Esegui l'installer come amministratore:</strong>
                      <div className="bg-gray-100 px-3 py-2 rounded mt-1 font-mono text-xs border border-gray-300">
                        .\NetworkMonitorInstaller.ps1
                      </div>
                      Oppure usa il file <code className="bg-blue-100 px-1 rounded">Installa-Agent.bat</code> (doppio click)
                    </li>
                    <li>L'installer configurerà tutto automaticamente, incluso il Scheduled Task</li>
                  </ol>
                </div>

                <div className="mt-3 p-3 bg-white border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">🔧 Installazione manuale:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Testa l'agent: <code className="bg-gray-100 px-1 rounded">.\NetworkMonitor.ps1 -TestMode</code></li>
                    <li>Se funziona, configura il Scheduled Task manualmente seguendo il README.md</li>
                  </ol>
                </div>

                <p className="text-xs text-blue-600 mt-3">
                  💡 <strong>Suggerimento:</strong> Il file <code className="bg-blue-100 px-1 rounded">Installa-Agent.bat</code> può essere convertito in .exe usando strumenti come "Bat To Exe Converter" per creare un installer Windows standard.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex gap-2">
            {step > 1 && step < 3 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Indietro
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 && (
              <button
                onClick={handleNext}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Creazione...
                  </>
                ) : (
                  <>
                    {step === 2 ? 'Crea Agent' : 'Avanti'}
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => handleCloseModal(true)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Chiudi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAgentModal;
