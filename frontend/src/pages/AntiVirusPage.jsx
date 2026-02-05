import React, { useState, useEffect } from 'react';
import { Shield, Search, Save, X, Check, Calendar, AlertTriangle, Monitor } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const AntiVirusPage = ({ onClose, getAuthHeader }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [devices, setDevices] = useState([]);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [drafts, setDrafts] = useState({});

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch(buildApiUrl('/api/network-monitoring/clients'), { headers: getAuthHeader() });
                if (res.ok) {
                    const data = await res.json();
                    setCompanies(data);
                }
            } catch (e) {
                console.error('Error fetching companies:', e);
            }
        };
        fetchCompanies();
    }, [getAuthHeader]);

    // Fetch devices when company selected
    useEffect(() => {
        if (!selectedCompanyId) {
            setDevices([]);
            setSelectedDeviceIds([]);
            setDrafts({});
            return;
        }

        const fetchDevices = async () => {
            setLoading(true);
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/antivirus-devices`), {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    setDevices(data);
                }
            } catch (e) {
                console.error('Error fetching devices:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchDevices();
    }, [selectedCompanyId, getAuthHeader]);

    const handleSelectDevice = (device) => {
        if (selectedDeviceIds.includes(device.device_id)) return;

        setSelectedDeviceIds(prev => [...prev, device.device_id]);
        setDrafts(prev => ({
            ...prev,
            [device.device_id]: {
                is_active: device.is_active || false,
                product_name: device.product_name || '',
                expiration_date: device.expiration_date ? device.expiration_date.split('T')[0] : ''
            }
        }));
    };

    const handleRemoveDevice = (deviceId) => {
        setSelectedDeviceIds(prev => prev.filter(id => id !== deviceId));
        setDrafts(prev => {
            const newDrafts = { ...prev };
            delete newDrafts[deviceId];
            return newDrafts;
        });
    };

    const updateDraft = (deviceId, field, value) => {
        setDrafts(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [field]: value
            }
        }));
    };

    const filteredDevices = devices.filter(d =>
        d.ip_address.includes(searchTerm) ||
        (d.hostname && d.hostname.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSaveRow = async (deviceId) => {
        const draft = drafts[deviceId];
        if (!draft) return;

        // Optimistic UI update or loading state per row could be better, but simple isSaving for now
        // actually we should track saving state per row if we want to be fancy, but let's just use global isSaving for simplicity or ignore it
        // Let's use a local Set for saving Ids to show spinners individually

        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/antivirus/${deviceId}`), {
                method: 'PUT',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(draft)
            });

            if (res.ok) {
                // Update main list data
                setDevices(prev => prev.map(d =>
                    d.device_id === deviceId
                        ? { ...d, ...draft }
                        : d
                ));
                alert("Salvato correttamente");
            }
        } catch (e) {
            console.error('Error saving antivirus info:', e);
            alert("Errore durante il salvataggio");
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 mr-2" title="Chiudi">
                        <X size={24} />
                    </button>
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <Shield size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">Gestione Anti-Virus</h1>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        className="border rounded-lg px-3 py-2 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">Seleziona Cliente...</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.azienda || c.nome + ' ' + c.cognome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Device List */}
                <div className="w-1/3 bg-white border-r flex flex-col max-w-md">
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Cerca IP o Hostname..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {!selectedCompanyId ? (
                            <div className="p-8 text-center text-gray-500">Seleziona un cliente per visualizzare i dispositivi</div>
                        ) : loading ? (
                            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                                <span className="animate-spin text-2xl mb-2">⌛</span>
                                Caricamento...
                            </div>
                        ) : filteredDevices.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Nessun dispositivo trovato</div>
                        ) : (
                            <div className="divide-y">
                                {filteredDevices.map(dev => (
                                    <div
                                        key={dev.device_id}
                                        onClick={() => handleSelectDevice(dev)}
                                        className={`py-2 px-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedDeviceIds.includes(dev.device_id) ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="font-mono text-sm font-medium text-gray-800">{dev.ip_address}</span>
                                            {dev.is_active ? (
                                                <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Check size={10} /> Attivo
                                                </span>
                                            ) : (
                                                <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-full">Non Attivo</span>
                                            )}
                                        </div>
                                        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                                            <span className="truncate max-w-[120px]" title={dev.hostname}>{dev.hostname || 'N/A'}</span>
                                            <span className="font-mono">{dev.product_name || '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Details */}
                <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
                    {selectedDeviceIds.length > 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-gray-600">Dispositivo</th>
                                        <th className="px-4 py-3 font-medium text-gray-600 text-center">Attivo</th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Prodotto</th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Scadenza</th>
                                        <th className="px-4 py-3 font-medium text-gray-600 text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedDeviceIds.map(id => {
                                        const device = devices.find(d => d.device_id === id);
                                        const draft = drafts[id] || {};
                                        if (!device) return null;

                                        return (
                                            <tr key={id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900">{device.ip_address}</div>
                                                    <div className="text-xs text-gray-500">{device.hostname || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                        checked={draft.is_active || false}
                                                        onChange={(e) => updateDraft(id, 'is_active', e.target.checked)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                        placeholder="Nome prodotto"
                                                        value={draft.product_name || ''}
                                                        onChange={(e) => updateDraft(id, 'product_name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="date"
                                                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                        value={draft.expiration_date || ''}
                                                        onChange={(e) => updateDraft(id, 'expiration_date', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleSaveRow(id)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                            title="Salva"
                                                        >
                                                            <Save size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveDevice(id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                            title="Rimuovi dalla lista"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="bg-gray-100 p-6 rounded-full mb-4">
                                <Shield size={48} className="text-gray-300" />
                            </div>
                            <p className="text-lg font-medium">Nessun dispositivo selezionato</p>
                            <p className="text-sm">Seleziona i dispositivi dalla lista a sinistra per modificarli</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AntiVirusPage;
