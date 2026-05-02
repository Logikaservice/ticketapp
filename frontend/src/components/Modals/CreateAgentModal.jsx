// src/components/Modals/CreateAgentModal.jsx
// Modal wizard per creazione guidata agent Network Monitoring

import React, { useState, useEffect, useRef } from 'react';
import { Download, Copy, CheckCircle, AlertCircle, Wifi, ChevronRight, Loader } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalScaffold,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton
} from './HubModalChrome';
import { HUB_MODAL_LABEL_CLS, HUB_MODAL_FIELD_CLS } from '../../utils/techHubAccent';

const CreateAgentModal = ({ isOpen, onClose, getAuthHeader, onAgentCreated, setShowCreateAgentModal }) => {
  const [step, setStep] = useState(1); // 1: Informazioni, 2: Configurazione, 3: Download
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    agent_name: '',
    azienda_id: '',
    network_ranges_config: [{ range: '192.168.1.0/24', name: '' }], // Array di oggetti {range, name}
    scan_interval_minutes: 15
  });
  const [createdAgent, setCreatedAgent] = useState(null);
  const [configJson, setConfigJson] = useState(null);
  const [copied, setCopied] = useState(false);

  // Carica lista aziende al mount - solo se non già caricate
  const companiesLoadedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !companiesLoadedRef.current) {
      loadCompanies();
      companiesLoadedRef.current = true;
    } else if (!isOpen) {
      companiesLoadedRef.current = false;
    }
  }, [isOpen]);

  // Usa localStorage per persistere lo stato durante i refresh
  const STORAGE_KEY = 'createAgentModal_state';

  // Salva lo stato SEMPRE quando cambia (non solo step 3) per prevenire perdita durante refresh
  useEffect(() => {
    if (isOpen) {
      const stateToSave = {
        step,
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
  }, [isOpen, step, createdAgent, configJson, formData]);

  // Ripristina SEMPRE lo stato da localStorage quando il modal si apre
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    // Quando il modal si apre (da false a true) O quando si riapre dopo un refresh
    if (isOpen) {
      try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          // Ripristina solo se salvato meno di 1 ora fa (evita stati vecchi)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
            // Se siamo nello step 3 e abbiamo un agent salvato, ripristina SEMPRE
            // (anche se lo stato attuale è vuoto a causa di un refresh)
            if (parsed.step === 3 && parsed.createdAgent && (!createdAgent || step !== 3)) {
              console.log('🔄 Ripristino stato step 3 da localStorage dopo refresh');
              setStep(3);
              setCreatedAgent(parsed.createdAgent);
              setConfigJson(parsed.configJson);
              if (parsed.formData) {
                setFormData(parsed.formData);
              }
            }
            // Se siamo in uno step precedente e lo stato salvato è più avanzato, ripristinalo
            else if (parsed.step > step && parsed.step === 3 && parsed.createdAgent) {
              console.log('🔄 Ripristino stato avanzato da localStorage');
              setStep(parsed.step);
              setCreatedAgent(parsed.createdAgent);
              setConfigJson(parsed.configJson);
              if (parsed.formData) {
                setFormData(parsed.formData);
              }
            }
            // Se lo stato salvato corrisponde allo step corrente ma i dati sono vuoti, ripristinali
            else if (parsed.step === step && step === 3 && !createdAgent && parsed.createdAgent) {
              console.log('🔄 Ripristino dati mancanti da localStorage');
              setCreatedAgent(parsed.createdAgent);
              setConfigJson(parsed.configJson);
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
    }
    // Quando il modal si chiude (da true a false), pulisci localStorage solo se non siamo allo step 3
    else if (prevIsOpenRef.current && !isOpen && step !== 3) {
      localStorage.removeItem(STORAGE_KEY);
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen]); // Solo quando isOpen cambia - NON dipendere da step/createdAgent per evitare loop

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
      network_ranges_config: [{ range: '192.168.1.0/24', name: '' }],
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
      // all=true: tutte le aziende (per poter creare agent anche per aziende senza agent esistenti)
      const response = await fetch(buildApiUrl('/api/network-monitoring/companies?all=true'), {
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

  const handleNetworkRangeChange = (index, field, value) => {
    const newRanges = [...formData.network_ranges_config];
    newRanges[index] = {
      ...newRanges[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      network_ranges_config: newRanges
    }));
  };

  const addNetworkRange = () => {
    setFormData(prev => ({
      ...prev,
      network_ranges_config: [...prev.network_ranges_config, { range: '', name: '' }]
    }));
  };

  const removeNetworkRange = (index) => {
    if (formData.network_ranges_config.length > 1) {
      const newRanges = formData.network_ranges_config.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        network_ranges_config: newRanges
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
    const validRanges = formData.network_ranges_config.filter(r => r.range && r.range.trim() && r.range.match(/^\d+\.\d+\.\d+\.\d+\/\d+$/));
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
      const validRangesConfig = formData.network_ranges_config.filter(r => r.range && r.range.trim() && r.range.match(/^\d+\.\d+\.\d+\.\d+\/\d+$/));

      const response = await fetch(buildApiUrl('/api/network-monitoring/agent/register'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent_name: formData.agent_name.trim(),
          azienda_id: parseInt(formData.azienda_id),
          network_ranges_config: validRangesConfig,
          scan_interval_minutes: parseInt(formData.scan_interval_minutes)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore creazione agent');
      }

      const data = await response.json();

      // Salva immediatamente in localStorage per evitare perdita durante eventuali refresh
      const serverUrl = window.location.origin;
      // Per il config.json dell'agent, usiamo solo i range (l'agent PowerShell non usa i nomi)
      const rangesOnly = validRangesConfig.map(r => r.range);
      const config = {
        server_url: serverUrl,
        api_key: data.agent.api_key,
        agent_name: data.agent.agent_name,
        version: "1.0.0",
        network_ranges: rangesOnly,
        scan_interval_minutes: parseInt(formData.scan_interval_minutes)
      };

      // Aggiorna stato in batch per evitare re-render multipli
      setCreatedAgent(data.agent);
      setConfigJson(config);
      setStep(3);

      // Salva immediatamente in localStorage
      const stateToSave = {
        step: 3,
        createdAgent: data.agent,
        configJson: config,
        formData,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.error('Errore salvataggio stato:', e);
      }

      // Notifica il parent: così può aggiornare subito la lista agent senza richiedere refresh pagina
      try {
        if (typeof onAgentCreated === 'function') {
          onAgentCreated(data.agent);
        }
      } catch (e) {
        console.error('Errore callback onAgentCreated:', e);
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

  // Scarica pacchetto completo agent (ZIP con tutti i file)
  const downloadAgentPackage = async () => {
    if (!createdAgent) return;

    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${createdAgent.id}/download`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore download pacchetto' }));
        throw new Error(errorData.error || 'Errore download pacchetto');
      }

      // Download ZIP
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NetworkMonitor-Agent-${createdAgent.agent_name.replace(/\s+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Errore download pacchetto:', err);
      setError('Errore scaricamento pacchetto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <HubModalScaffold onBackdropClick={() => handleCloseModal(step === 3 && createdAgent)} maxWidthClass="max-w-2xl" zClass="z-[118]">
        <HubModalChromeHeader
          icon={Wifi}
          title="Crea Nuovo Agent"
          subtitle={
            step === 1 ? 'Passo 1/3: Informazioni agent' :
            step === 2 ? 'Passo 2/3: Configurazione rete' :
            'Passo 3/3: Download configurazione'
          }
          onClose={() => handleCloseModal(step === 3 && createdAgent)}
        />

        {/* Progress indicator */}
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-white/10 bg-black/20 p-4">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= s ? 'bg-[color:var(--hub-accent)] text-[#121212]' : 'bg-white/15 text-white/55'
                }`}>
                {step > s ? <CheckCircle size={20} aria-hidden /> : s}
              </div>
              {s < 3 && (
                <div className={`h-1 w-12 rounded ${step > s ? 'bg-[color:var(--hub-accent)]' : 'bg-white/15'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <HubModalBody className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 p-4 text-sm text-red-50">
              <AlertCircle size={20} aria-hidden />
              {error}
            </div>
          )}

          {/* Step 1: Informazioni */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Nome Agent *
                </label>
                <input
                  type="text"
                  value={formData.agent_name}
                  onChange={(e) => handleInputChange('agent_name', e.target.value)}
                  placeholder="Es: Agent PC Casa, Agent Server Ufficio"
                  className={HUB_MODAL_FIELD_CLS}
                />
              </div>

              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Azienda *
                </label>
                <select
                  value={formData.azienda_id}
                  onChange={(e) => handleInputChange('azienda_id', e.target.value)}
                  className={HUB_MODAL_FIELD_CLS}
                >
                  <option value="">Seleziona un&apos;azienda</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.azienda}
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
                <label className={HUB_MODAL_LABEL_CLS}>
                  Range di Rete da Monitorare *
                </label>
                <p className="mb-3 text-sm text-white/55">
                  Inserisci i range IP da scansionare e assegna un nome descrittivo a ciascuna rete
                </p>
                {formData.network_ranges_config.map((rangeConfig, index) => (
                  <div key={index} className="mb-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="mb-2 flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-white/65">
                          Range IP *
                        </label>
                        <input
                          type="text"
                          value={rangeConfig.range}
                          onChange={(e) => handleNetworkRangeChange(index, 'range', e.target.value)}
                          placeholder="192.168.1.0/24"
                          className={`${HUB_MODAL_FIELD_CLS} text-sm`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-white/65">
                          Nome Rete (opzionale)
                        </label>
                        <input
                          type="text"
                          value={rangeConfig.name || ''}
                          onChange={(e) => handleNetworkRangeChange(index, 'name', e.target.value)}
                          placeholder="es: LAN Principale, Telefonia, Videosorveglianza"
                          className={`${HUB_MODAL_FIELD_CLS} text-sm`}
                        />
                      </div>
                      {formData.network_ranges_config.length > 1 && (
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeNetworkRange(index)}
                            className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100 ring-1 ring-red-500/35 hover:bg-red-500/30"
                          >
                            Rimuovi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addNetworkRange}
                  className="text-sm font-medium text-[color:var(--hub-accent)] hover:brightness-110"
                >
                  + Aggiungi altro range
                </button>
              </div>

              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Intervallo Scansione (minuti) *
                </label>
                <input
                  type="number"
                  value={formData.scan_interval_minutes}
                  onChange={(e) => handleInputChange('scan_interval_minutes', parseInt(e.target.value) || 15)}
                  min="1"
                  max="1440"
                  className={HUB_MODAL_FIELD_CLS}
                />
                <p className="mt-1 text-sm text-white/55">
                  Quanto spesso scansionare la rete (default: 15 minuti)
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Download */}
          {step === 3 && createdAgent && configJson && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 p-4">
                <div className="mb-2 flex items-center gap-2 text-emerald-50">
                  <CheckCircle size={20} aria-hidden />
                  <span className="font-semibold">Agent creato con successo!</span>
                </div>
                <div className="space-y-1 text-sm text-emerald-100/90">
                  <p><strong>Nome:</strong> {createdAgent.agent_name}</p>
                  <p><strong>ID Agent:</strong> {createdAgent.id}</p>
                  <p><strong>Data creazione:</strong> {new Date(createdAgent.created_at).toLocaleString('it-IT')}</p>
                </div>
              </div>

              <div>
                <label className={HUB_MODAL_LABEL_CLS}>API Key (salvala in un posto sicuro!)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createdAgent.api_key}
                    readOnly
                    className={`flex-1 font-mono text-sm opacity-95 ${HUB_MODAL_FIELD_CLS}`}
                  />
                  <HubModalSecondaryButton type="button" onClick={copyApiKey} className="flex shrink-0 items-center gap-2">
                    {copied ? <CheckCircle size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                    {copied ? 'Copiato!' : 'Copia'}
                  </HubModalSecondaryButton>
                </div>
              </div>

              <div>
                <label className={HUB_MODAL_LABEL_CLS}>File config.json</label>
                <p className="mb-2 text-sm text-white/55">
                  Scarica questo file e copialo nella cartella dell&apos;agent PowerShell come{' '}
                  <code className="rounded bg-black/30 px-1 text-white/85">config.json</code>
                </p>
                <div className="mb-2 rounded-lg border border-white/10 bg-black/25 p-4">
                  <pre className="overflow-x-auto text-xs text-white/78">
                    {JSON.stringify(configJson, null, 2)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <HubModalPrimaryButton type="button" onClick={downloadConfig} className="flex flex-1 items-center justify-center gap-2">
                    <Download size={18} aria-hidden />
                    Scarica config.json
                  </HubModalPrimaryButton>
                  <HubModalSecondaryButton type="button" onClick={copyConfigToClipboard} className="flex items-center gap-2">
                    {copied ? <CheckCircle size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                    {copied ? 'Copiato!' : 'Copia'}
                  </HubModalSecondaryButton>
                </div>
                <p className="mt-2 text-xs text-white/45">
                  Suggerimento: per un&apos;installazione più semplice usa il pulsante &quot;Scarica Pacchetto ZIP Completo&quot; qui sotto.
                </p>
              </div>

              <div className="rounded-lg border border-[color:var(--hub-accent-border)] bg-black/22 p-4 ring-1 ring-white/10">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <Download size={20} aria-hidden />
                  Scarica pacchetto completo (consigliato)
                </h3>
                <p className="mb-3 text-sm text-white/75">
                  <strong className="text-white">Il modo più semplice:</strong> scarica il pacchetto ZIP con tutti i file già configurati.
                </p>
                <HubModalPrimaryButton
                  type="button"
                  onClick={downloadAgentPackage}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 px-6 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader size={18} className="animate-spin" aria-hidden />
                      Download in corso...
                    </>
                  ) : (
                    <>
                      <Download size={20} aria-hidden />
                      Scarica Pacchetto ZIP Completo
                    </>
                  )}
                </HubModalPrimaryButton>
                <p className="mt-2 text-xs text-white/55">
                  Il ZIP contiene: config.json, NetworkMonitor.ps1, NetworkMonitorService.ps1, InstallerCompleto.ps1 e altri file necessari.
                </p>
              </div>

              <div className="rounded-lg border border-sky-500/35 bg-sky-500/10 p-4">
                <h3 className="mb-2 font-semibold text-sky-50">Installazione manuale (alternativa)</h3>
                <p className="mb-3 text-sm text-sky-100/85">
                  Se preferisci scaricare i file manualmente:
                </p>
                <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-sky-100/85">
                  <li><code className="rounded bg-black/30 px-1 text-white/85">config.json</code> (scaricato sopra)</li>
                  <li><code className="rounded bg-black/30 px-1 text-white/85">NetworkMonitor.ps1</code> (cartella <code className="rounded bg-black/30 px-1">agent/</code>)</li>
                  <li><code className="rounded bg-black/30 px-1 text-white/85">NetworkMonitorService.ps1</code> (cartella <code className="rounded bg-black/30 px-1">agent/</code>)</li>
                </ul>

                <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3">
                  <h4 className="mb-2 font-semibold text-white">Installazione automatica (con pacchetto ZIP)</h4>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-white/78">
                    <li>Scarica il pacchetto ZIP completo con il pulsante sopra</li>
                    <li>Estrai in una cartella permanente (es. <code className="rounded bg-black/35 px-1">C:\ProgramData\NetworkMonitorAgent\</code>)</li>
                    <li>
                      <strong className="text-white">Esegui l&apos;installer come amministratore:</strong>
                      <div className="mt-1 rounded border border-white/10 bg-black/35 px-3 py-2 font-mono text-xs text-white/85">
                        .\InstallerCompleto.ps1
                      </div>
                      Oppure usa <code className="rounded bg-black/35 px-1">Installa.bat</code>
                    </li>
                    <li>L&apos;installer configura il servizio Windows</li>
                  </ol>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                  <h4 className="mb-2 font-semibold text-white">Installazione manuale</h4>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-white/78">
                    <li>Test: <code className="rounded bg-black/35 px-1">.\NetworkMonitor.ps1 -TestMode</code></li>
                    <li>Poi Scheduled Task come da README.md</li>
                  </ol>
                </div>

                <p className="mt-3 text-xs text-white/50">
                  Il file <code className="rounded bg-black/35 px-1">Installa-Agent.bat</code> può essere convertito in .exe con strumenti dedicati.
                </p>
              </div>
            </div>
          )}
        </HubModalBody>

        {/* Footer */}
        <HubModalChromeFooter className="items-center justify-between">
          <div className="flex gap-2">
            {step > 1 && step < 3 && (
              <HubModalSecondaryButton type="button" onClick={handleBack}>
                Indietro
              </HubModalSecondaryButton>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 && (
              <HubModalPrimaryButton
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" aria-hidden />
                    Creazione...
                  </>
                ) : (
                  <>
                    {step === 2 ? 'Crea Agent' : 'Avanti'}
                    <ChevronRight size={18} aria-hidden />
                  </>
                )}
              </HubModalPrimaryButton>
            )}
            {step === 3 && (
              <HubModalPrimaryButton type="button" onClick={() => handleCloseModal(true)}>
                Chiudi
              </HubModalPrimaryButton>
            )}
          </div>
        </HubModalChromeFooter>
    </HubModalScaffold>
  );
};

export default CreateAgentModal;
