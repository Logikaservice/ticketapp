import React, { useState, useEffect } from 'react';
import { Shield, Search, X, Check, Calendar, Monitor, Server, Layers, GripVertical } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const AntiVirusPage = ({ onClose, getAuthHeader }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [devices, setDevices] = useState([]);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

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

                    // Initialize selected devices (those with data)
                    const existingConfigured = data
                        .filter(d => d.is_active || d.product_name || d.expiration_date)
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                    if (existingConfigured.length > 0) {
                        setSelectedDeviceIds(existingConfigured.map(d => d.device_id));
                        // Initialize drafts
                        const initialDrafts = {};
                        existingConfigured.forEach(d => {
                            initialDrafts[d.device_id] = {
                                is_active: d.is_active || false,
                                product_name: d.product_name || '',
                                expiration_date: d.expiration_date ? d.expiration_date.split('T')[0] : '',
                                device_type: d.device_type || 'pc',
                                sort_order: d.sort_order || 0
                            };
                        });
                        setDrafts(initialDrafts);
                    }
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

        // When adding new, put it at end of list order
        const maxOrder = Math.max(...devices.map(d => d.sort_order || 0), 0);

        setDrafts(prev => ({
            ...prev,
            [device.device_id]: {
                is_active: true, // Default to true when adding
                product_name: device.product_name || '',
                expiration_date: device.expiration_date ? device.expiration_date.split('T')[0] : '',
                device_type: device.device_type || 'pc',
                sort_order: maxOrder + 1
            }
        }));

        // Auto-save initial state to persist inclusion in list
        handleSaveRow(device.device_id, {
            is_active: true,
            product_name: device.product_name || '',
            expiration_date: device.expiration_date ? device.expiration_date.split('T')[0] : '',
            device_type: device.device_type || 'pc',
            sort_order: maxOrder + 1
        });
    };

    const handleRemoveDevice = (deviceId) => {
        const device = devices.find(d => d.device_id === deviceId);
        if (window.confirm(`Rimuovere ${device?.ip_address} dalla lista?`)) {
            setSelectedDeviceIds(prev => prev.filter(id => id !== deviceId));
            setDrafts(prev => {
                const newDrafts = { ...prev };
                delete newDrafts[deviceId];
                return newDrafts;
            });

            // Update backend to clear status (optional, depends on if user wants to delete data or just hide)
            // For now we just remove from view, but to persist "removal" we might need to set is_active=false or wipe data
            // Let's set is_active = false and product_name = '' to "clear" it effectively from auto-load
            handleSaveRow(deviceId, {
                is_active: false,
                product_name: '',
                expiration_date: null,
                device_type: 'pc',
                sort_order: 0
            });
        }
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

    const handleBlurSave = (deviceId) => {
        // Trigger save on blur
        handleSaveRow(deviceId);
    };

    const filteredDevices = devices.filter(d =>
        d.ip_address.includes(searchTerm) ||
        (d.hostname && d.hostname.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSaveRow = async (deviceId, explicitDraft = null) => {
        const draft = explicitDraft || drafts[deviceId];
        if (!draft) return;

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
                setDevices(prev => prev.map(d =>
                    d.device_id === deviceId
                        ? { ...d, ...draft }
                        : d
                ));
            }
        } catch (e) {
            console.error('Error saving antivirus info:', e);
        }
    };

    // Drag and Drop Handlers
    const [draggedItemId, setDraggedItemId] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedItemId(selectedDeviceIds[index]);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index);
        e.dataTransfer.setDragImage(e.target.parentNode, 20, 20);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e, index) => {
        e.preventDefault();
        const draggedIndex = Number(e.dataTransfer.getData("text/plain"));
        if (draggedIndex === index) return;

        const newItems = [...selectedDeviceIds];
        const [movedItem] = newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, movedItem);
        setSelectedDeviceIds(newItems);

        // Update sort orders in backend
        // We need to update all affected items. Simple loop for now.
        newItems.forEach((id, idx) => {
            const draft = drafts[id] || {};
            const newOrder = idx;
            if (draft.sort_order !== newOrder) {
                updateDraft(id, 'sort_order', newOrder);
                // Fire and forget save for order
                handleSaveRow(id, { ...draft, sort_order: newOrder });
            }
        });
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
                                {filteredDevices.map(dev => {
                                    const isAdded = selectedDeviceIds.includes(dev.device_id);
                                    return (
                                        <div
                                            key={dev.device_id}
                                            onClick={() => handleSelectDevice(dev)}
                                            className={`py-2 px-3 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center ${isAdded ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="font-mono text-sm font-medium text-gray-800">{dev.ip_address}</span>
                                                <span className="text-gray-400 text-xs mx-1">-</span>
                                                <span className="text-xs text-gray-500 truncate" title={dev.hostname}>{dev.hostname || 'N/A'}</span>
                                            </div>
                                            {isAdded && (
                                                <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                                                    <Check size={10} /> Aggiunto
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
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
                                        <th className="px-2 py-3 w-8"></th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Attivo</th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Dispositivo</th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Prodotto</th>
                                        <th className="px-4 py-3 font-medium text-gray-600">Scadenza</th>
                                        <th className="px-4 py-3 font-medium text-gray-600 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {selectedDeviceIds.map((id, index) => {
                                        const device = devices.find(d => d.device_id === id);
                                        const draft = drafts[id] || {};
                                        if (!device) return null;

                                        const isExpired = draft.expiration_date && new Date(draft.expiration_date) < new Date(new Date().setHours(0, 0, 0, 0));

                                        return (
                                            <tr
                                                key={id}
                                                className={`group ${isExpired ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDrop={(e) => handleDrop(e, index)}
                                            >
                                                <td className="px-2 py-3 w-8 text-gray-400 cursor-grab active:cursor-grabbing">
                                                    <GripVertical size={16} />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                        checked={draft.is_active || false}
                                                        onChange={(e) => {
                                                            const val = e.target.checked;
                                                            updateDraft(id, 'is_active', val);
                                                            handleSaveRow(id, { ...draft, is_active: val });
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2">
                                                        {[
                                                            { type: 'pc', icon: Monitor, label: 'PC' },
                                                            { type: 'server', icon: Server, label: 'Server' },
                                                            { type: 'virtual', icon: Layers, label: 'Virtual' }
                                                        ].map(t => (
                                                            <button
                                                                key={t.type}
                                                                onClick={() => {
                                                                    updateDraft(id, 'device_type', t.type);
                                                                    handleSaveRow(id, { ...draft, device_type: t.type });
                                                                }}
                                                                className={`p-1.5 rounded ${draft.device_type === t.type ? 'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-500' : 'text-gray-400 hover:bg-gray-100'}`}
                                                                title={t.label}
                                                            >
                                                                <t.icon size={16} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{device.ip_address}</div>
                                                    <div className="text-xs text-gray-500">{device.hostname || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                        placeholder="Nome prodotto"
                                                        value={draft.product_name || ''}
                                                        onChange={(e) => updateDraft(id, 'product_name', e.target.value)}
                                                        onBlur={() => handleBlurSave(id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="date"
                                                        className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                        value={draft.expiration_date || ''}
                                                        onChange={(e) => updateDraft(id, 'expiration_date', e.target.value)}
                                                        onBlur={() => handleBlurSave(id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleRemoveDevice(id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Rimuovi dalla lista"
                                                    >
                                                        <X size={18} />
                                                    </button>
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
