// src/components/Modals/EditAgentModal.jsx
// Modal per modifica agent Network Monitoring esistente

import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Wifi, CheckCircle, Clock } from 'lucide-react';
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

const EditAgentModal = ({ isOpen, onClose, getAuthHeader, agent, onAgentUpdated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [unifiTestStatus, setUnifiTestStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
    const [unifiTestMessage, setUnifiTestMessage] = useState('');
    const [formData, setFormData] = useState({
        agent_name: '',
        network_ranges_config: [{ range: '', name: '' }],
        scan_interval_minutes: 15,
        unifi_enabled: false,
        unifi_config: { url: '', username: '', password: '' }
    });

    // Inizializza il form con i dati dell'agent quando il modal si apre
    useEffect(() => {
        if (isOpen && agent) {
            let rangesConfig = [];
            if (agent.network_ranges_config && Array.isArray(agent.network_ranges_config)) {
                rangesConfig = agent.network_ranges_config;
            } else if (agent.network_ranges && Array.isArray(agent.network_ranges)) {
                rangesConfig = agent.network_ranges.map(range => ({ range, name: '' }));
            }
            const uc = agent.unifi_config;
            const hasUnifi = uc && typeof uc === 'object' && (uc.url || uc.username || uc.password);

            setFormData({
                agent_name: agent.agent_name || '',
                network_ranges_config: rangesConfig.length > 0 ? rangesConfig : [{ range: '', name: '' }],
                scan_interval_minutes: agent.scan_interval_minutes || 15,
                unifi_enabled: !!hasUnifi,
                unifi_config: (hasUnifi && uc) ? { url: uc.url || '', username: uc.username || '', password: uc.password || '' } : { url: '', username: '', password: '' }
            });
            setError(null);
            setUnifiTestStatus(null);
            setUnifiTestMessage('');
        }
    }, [isOpen, agent]);

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

    const handleTestUnifi = async () => {
        const url = (formData.unifi_config?.url || '').trim();
        const username = (formData.unifi_config?.username || '').trim();
        const password = formData.unifi_config?.password || '';
        if (!url || !username || !password) {
            setUnifiTestStatus('error');
            setUnifiTestMessage('Inserisci URL, username e password prima di provare.');
            return;
        }

        // Reset stato
        setUnifiTestStatus('loading');
        setUnifiTestMessage('Invio richiesta test all\'agent...');

        try {
            const res = await fetch(buildApiUrl('/api/network-monitoring/test-unifi'), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agent?.id, url, username, password })
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                if (data.success) {
                    setUnifiTestStatus('ok');
                    setUnifiTestMessage('Connessione OK (Verificato direttamente dal server)');
                } else if (data.deferred) {
                    // Test delegato all'agent (rete locale): polling risultato per ~6 minuti
                    const testId = data.test_id;
                    setUnifiTestStatus('pending');
                    setUnifiTestMessage('Richiesta inviata all\'agent. Attendo esito...');
                    if (!testId) return;

                    const start = Date.now();
                    const timeoutMs = 6 * 60 * 1000; // heartbeat agent ~5 min + margine
                    const pollEveryMs = 5000;

                    while ((Date.now() - start) < timeoutMs) {
                        await new Promise(resolve => setTimeout(resolve, pollEveryMs));
                        const pollRes = await fetch(buildApiUrl(`/api/network-monitoring/unifi-test-result/${encodeURIComponent(testId)}`), {
                            headers: { ...getAuthHeader() }
                        });
                        const pollData = await pollRes.json().catch(() => ({}));
                        const pollStatus = pollData?.status;

                        if (pollStatus === 'ok') {
                            setUnifiTestStatus('ok');
                            setUnifiTestMessage(pollData?.message || 'Connessione OK (verificata dall\'agent)');
                            return;
                        }
                        if (pollStatus === 'error') {
                            setUnifiTestStatus('error');
                            setUnifiTestMessage(pollData?.message || 'Connessione fallita (verificata dall\'agent)');
                            return;
                        }
                    }

                    setUnifiTestStatus('error');
                    setUnifiTestMessage('Nessun esito dal test entro 6 minuti. Verifica che l\'agent sia online e riprova.');
                } else {
                    setUnifiTestStatus('error');
                    setUnifiTestMessage(data.message || 'Errore sconosciuto');
                }
            } else {
                setUnifiTestStatus('error');
                setUnifiTestMessage(data.error || `Errore ${res.status}`);
            }
        } catch (e) {
            setUnifiTestStatus('error');
            setUnifiTestMessage(e.message || 'Errore di rete');
        }
    };

    const validateForm = () => {
        if (!formData.agent_name.trim()) {
            setError('Nome agent richiesto');
            return false;
        }

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

    const handleSave = async () => {
        if (!validateForm()) return;

        try {
            setLoading(true);
            setError(null);

            // Valida range IP (rimuovi vuoti e invalidi)
            const validRangesConfig = formData.network_ranges_config.filter(r => r.range && r.range.trim() && r.range.match(/^\d+\.\d+\.\d+\.\d+\/\d+$/));

            const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${agent.id}`), {
                method: 'PUT',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agent_name: formData.agent_name.trim(),
                    network_ranges_config: validRangesConfig,
                    scan_interval_minutes: parseInt(formData.scan_interval_minutes),
                    unifi_config: formData.unifi_enabled
                        ? {
                            url: (formData.unifi_config?.url || '').trim(),
                            username: (formData.unifi_config?.username || '').trim(),
                            password: formData.unifi_config?.password || ''
                        }
                        : null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore aggiornamento agent');
            }

            const data = await response.json();

            // Notifica il parent
            if (typeof onAgentUpdated === 'function') {
                onAgentUpdated(data.agent);
            }

            // Chiudi il modal
            onClose();
        } catch (err) {
            console.error('Errore aggiornamento agent:', err);
            setError(err.message || 'Errore aggiornamento agent');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <HubModalScaffold onBackdropClick={onClose} maxWidthClass="max-w-2xl" zClass="z-[118]">
            <HubModalChromeHeader
              icon={Wifi}
              title="Modifica Agent"
              subtitle={`Modifica configurazione agent "${agent?.agent_name}"`}
              onClose={onClose}
            />

                {/* Content */}
                <HubModalBody className="space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 p-4 text-sm text-red-50">
                            <AlertCircle size={20} aria-hidden />
                            {error}
                        </div>
                    )}

                    {/* Nome Agent */}
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

                    {/* Range di Rete */}
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

                    {/* Intervallo Scansione */}
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

                    {/* Integrazione Unifi Controller (opzionale) */}
                    <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 font-semibold text-white">
                                <Wifi size={20} className="text-[color:var(--hub-accent)]" aria-hidden />
                                Integrazione Unifi Controller
                            </h3>
                            <label className="flex cursor-pointer select-none items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={!!formData.unifi_enabled}
                                    onChange={(e) => handleInputChange('unifi_enabled', e.target.checked)}
                                    className="h-4 w-4 rounded border-white/25 bg-black/30 text-[color:var(--hub-accent)] focus:ring-[color:var(--hub-accent)]"
                                />
                                <span className="text-sm font-medium text-white/78">Abilita</span>
                            </label>
                        </div>
                        {formData.unifi_enabled && (
                            <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
                                {/* Stato dall'agent (esito dell'ultimo check Unifi durante la scansione) */}
                                <div>
                                    <span className="text-xs font-medium text-white/65">Stato dall&apos;agent: </span>
                                    {agent?.unifi_last_check_at ? (
                                        agent?.unifi_last_ok === true ? (
                                            <span className="inline-flex items-center gap-1.5 text-emerald-300">
                                                <CheckCircle size={16} aria-hidden />
                                                Si è collegato all&apos;UniFi con successo
                                                <span className="font-normal text-white/45">
                                                    ({new Date(agent.unifi_last_check_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })})
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-red-300">
                                                <AlertCircle size={16} aria-hidden />
                                                Non è riuscito a collegarsi
                                                <span className="font-normal text-white/45">
                                                    ({new Date(agent.unifi_last_check_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })})
                                                </span>
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-white/45">Non ha ancora eseguito un check (avviene durante la scansione con Unifi abilitato e salvato)</span>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-white/65">Controller URL</label>
                                    <input
                                        type="text"
                                        value={formData.unifi_config?.url || ''}
                                        onChange={(e) => { setUnifiTestStatus(null); setUnifiTestMessage(''); setFormData(prev => ({ ...prev, unifi_config: { ...prev.unifi_config, url: e.target.value } })); }}
                                        placeholder="https://192.168.1.5:8443"
                                        className={`${HUB_MODAL_FIELD_CLS} text-sm`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-white/65">Username</label>
                                        <input
                                            type="text"
                                            value={formData.unifi_config?.username || ''}
                                            onChange={(e) => { setUnifiTestStatus(null); setUnifiTestMessage(''); setFormData(prev => ({ ...prev, unifi_config: { ...prev.unifi_config, username: e.target.value } })); }}
                                            className={`${HUB_MODAL_FIELD_CLS} text-sm`}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-white/65">Password</label>
                                        <input
                                            type="password"
                                            value={formData.unifi_config?.password || ''}
                                            onChange={(e) => { setUnifiTestStatus(null); setUnifiTestMessage(''); setFormData(prev => ({ ...prev, unifi_config: { ...prev.unifi_config, password: e.target.value } })); }}
                                            className={`${HUB_MODAL_FIELD_CLS} text-sm`}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <HubModalSecondaryButton
                                        type="button"
                                        onClick={handleTestUnifi}
                                        disabled={unifiTestStatus === 'loading'}
                                        className="disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {unifiTestStatus === 'loading' ? 'Verifica in corso…' : 'Prova connessione'}
                                    </HubModalSecondaryButton>
                                    {unifiTestStatus === 'ok' && (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-50">
                                            <CheckCircle size={18} className="shrink-0" aria-hidden />
                                            Connessione OK
                                        </span>
                                    )}
                                    {unifiTestStatus === 'pending' && (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/12 px-3 py-1.5 text-sm text-sky-50">
                                            <Clock size={18} className="shrink-0" aria-hidden />
                                            {unifiTestMessage}
                                        </span>
                                    )}
                                    {unifiTestStatus === 'error' && unifiTestMessage && (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-sm text-red-50">
                                            <AlertCircle size={18} className="shrink-0" aria-hidden />
                                            {unifiTestMessage}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-white/45">
                                    L&apos;agent, locale alla rete, riceve queste credenziali solo dal server (HTTPS) e si connette direttamente al Cloud Key/Controller Unifi per rilevare gli aggiornamenti firmware. Le credenziali non vengono mai scritte su file.
                                </p>
                            </div>
                        )}
                        {!formData.unifi_enabled && (
                            <p className="text-sm italic text-white/45">Non tutte le aziende usano Ubiquiti/Unifi. Abilita solo se hai un Controller Unifi da integrare.</p>
                        )}
                    </div>
                </HubModalBody>

                {/* Footer */}
                <HubModalChromeFooter className="justify-end">
                    <HubModalSecondaryButton type="button" onClick={onClose}>
                        Annulla
                    </HubModalSecondaryButton>
                    <HubModalPrimaryButton
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                                Salvataggio...
                            </>
                        ) : (
                            <>
                                <Save size={18} aria-hidden />
                                Salva Modifiche
                            </>
                        )}
                    </HubModalPrimaryButton>
                </HubModalChromeFooter>
        </HubModalScaffold>
    );
};

export default EditAgentModal;
