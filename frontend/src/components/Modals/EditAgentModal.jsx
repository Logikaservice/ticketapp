// src/components/Modals/EditAgentModal.jsx
// Modal per modifica agent Network Monitoring esistente

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Wifi } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const EditAgentModal = ({ isOpen, onClose, getAuthHeader, agent, onAgentUpdated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        agent_name: '',
        network_ranges_config: [{ range: '', name: '' }],
        scan_interval_minutes: 15
    });

    // Inizializza il form con i dati dell'agent quando il modal si apre
    useEffect(() => {
        if (isOpen && agent) {
            // Se l'agent ha network_ranges_config, usalo
            let rangesConfig = [];
            if (agent.network_ranges_config && Array.isArray(agent.network_ranges_config)) {
                rangesConfig = agent.network_ranges_config;
            } else if (agent.network_ranges && Array.isArray(agent.network_ranges)) {
                // Altrimenti converti da network_ranges (vecchio formato)
                rangesConfig = agent.network_ranges.map(range => ({ range, name: '' }));
            }

            setFormData({
                agent_name: agent.agent_name || '',
                network_ranges_config: rangesConfig.length > 0 ? rangesConfig : [{ range: '', name: '' }],
                scan_interval_minutes: agent.scan_interval_minutes || 15,
                unifi_config: agent.unifi_config || { url: '', username: '', password: '' }
            });
            setError(null);
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
                    unifi_config: formData.unifi_config
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Wifi size={28} />
                                Modifica Agent
                            </h2>
                            <p className="text-blue-100 text-sm mt-1">
                                Modifica configurazione agent "{agent?.agent_name}"
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    {/* Nome Agent */}
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

                    {/* Range di Rete */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Range di Rete da Monitorare *
                        </label>
                        <p className="text-sm text-gray-500 mb-3">
                            Inserisci i range IP da scansionare e assegna un nome descrittivo a ciascuna rete
                        </p>
                        {formData.network_ranges_config.map((rangeConfig, index) => (
                            <div key={index} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                <div className="flex gap-2 mb-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Range IP *
                                        </label>
                                        <input
                                            type="text"
                                            value={rangeConfig.range}
                                            onChange={(e) => handleNetworkRangeChange(index, 'range', e.target.value)}
                                            placeholder="192.168.1.0/24"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Nome Rete (opzionale)
                                        </label>
                                        <input
                                            type="text"
                                            value={rangeConfig.name || ''}
                                            onChange={(e) => handleNetworkRangeChange(index, 'name', e.target.value)}
                                            placeholder="es: LAN Principale, Telefonia, Videosorveglianza"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                    {formData.network_ranges_config.length > 1 && (
                                        <div className="flex items-end">
                                            <button
                                                onClick={() => removeNetworkRange(index)}
                                                className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm"
                                            >
                                                Rimuovi
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={addNetworkRange}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            + Aggiungi altro range
                        </button>
                    </div>

                    {/* Intervallo Scansione */}
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

                    {/* Integrazione Unifi Controller */}
                    <div className="pt-4 border-t border-gray-200 mt-4">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Wifi size={20} className="text-blue-600" />
                            Integrazione Unifi Controller
                        </h3>
                        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Controller URL</label>
                                <input
                                    type="text"
                                    value={formData.unifi_config?.url || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        unifi_config: { ...prev.unifi_config, url: e.target.value }
                                    }))}
                                    placeholder="https://192.168.1.5:8443"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={formData.unifi_config?.username || ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            unifi_config: { ...prev.unifi_config, username: e.target.value }
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={formData.unifi_config?.password || ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            unifi_config: { ...prev.unifi_config, password: e.target.value }
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">
                                Inserisci le credenziali per connetterti al Controller Unifi e rilevare gli aggiornamenti firmware.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Salvataggio...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Salva Modifiche
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditAgentModal;
