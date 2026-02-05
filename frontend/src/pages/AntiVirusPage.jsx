import React, { useState, useEffect } from 'react';
import { Shield, Search, X, Check, Calendar, Monitor, Server, Layers, GripVertical, Plus, Laptop, Smartphone, Tablet, RefreshCw } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const AntiVirusPage = ({ onClose, getAuthHeader }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [devices, setDevices] = useState([]);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null); // ID of the row with open icon dropdown
    const [sidebarWidth, setSidebarWidth] = useState(450); // Default width in px

    const startResizing = (mouseDownEvent) => {
        mouseDownEvent.preventDefault();
        const startX = mouseDownEvent.clientX;
        const startWidth = sidebarWidth;

        const doDrag = (mouseMoveEvent) => {
            requestAnimationFrame(() => {
                setSidebarWidth(startWidth + mouseMoveEvent.clientX - startX);
            });
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mouseup', stopDrag);
        document.body.style.cursor = 'col-resize';
    };

    const handleSyncKeepass = async () => {
        if (!confirm('Vuoi forzare la sincronizzazione completa con KeePass? Potrebbe richiedere alcuni secondi.')) return;
        setLoading(true);
        try {
            const res = await fetch(buildApiUrl('/api/network-monitoring/sync-keepass'), {
                method: 'POST',
                headers: getAuthHeader()
            });
            if (res.ok) {
                // Refresh list
                fetchDevices(false);
            } else {
                alert('Errore sincronizzazione');
            }
        } catch (e) {
            console.error(e);
            alert('Errore connessione');
        } finally {
            setLoading(false);
        }
    };

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

        const fetchDevices = async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/antivirus-devices`), {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    setDevices(data);

                    // Initialize selected devices ONLY on initial load (not silent update)
                    if (!silent) {
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
                } else {
                    const errText = await res.text();
                    console.error('Server error fetching devices:', res.status, errText);
                }
            } catch (e) {
                console.error('Error fetching devices:', e);
            } finally {
                if (!silent) setLoading(false);
            }
        };

        fetchDevices(false);

        // Auto-refresh every 10 seconds
        const intervalId = setInterval(() => {
            fetchDevices(true);
        }, 10000);

        return () => clearInterval(intervalId);
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

        // Is this a NEW temporary device?
        if (typeof deviceId === 'number' && deviceId < 0) {
            // Validation: IP is now optional

            try {
                // 1. Create Device
                const createRes = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/manual-device`), {
                    method: 'POST',
                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ip_address: draft.ip_address,
                        hostname: draft.hostname,
                        device_type: draft.device_type || 'pc'
                    })
                });

                if (createRes.ok) {
                    const createData = await createRes.json();
                    const newId = createData.device_id;

                    // 2. Save Antivirus Info with new ID
                    // We call the same logic but with REAL ID
                    const realRes = await fetch(buildApiUrl(`/api/network-monitoring/antivirus/${newId}`), {
                        method: 'PUT',
                        headers: {
                            ...getAuthHeader(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(draft)
                    });

                    if (realRes.ok) {
                        // 3. Update State: Replace Temp ID with Real ID
                        setDevices(prev => {
                            // Replace the temp device with the real one (we construct it roughly)
                            return prev.map(d =>
                                d.device_id === deviceId
                                    ? {
                                        ...d,
                                        device_id: newId,
                                        ip_address: draft.ip_address,
                                        hostname: draft.hostname,
                                        ...draft
                                    }
                                    : d
                            );
                        });

                        setSelectedDeviceIds(prev => prev.map(id => id === deviceId ? newId : id));
                        setDrafts(prev => {
                            const newDrafts = { ...prev };
                            newDrafts[newId] = { ...draft }; // Copy draft to new ID
                            delete newDrafts[deviceId];
                            return newDrafts;
                        });
                    }
                } else {
                    const err = await createRes.json();
                    alert("Errore creazione: " + err.error);
                }
            } catch (e) {
                console.error("Creation error:", e);
                alert("Errore di creazione");
            }
            return;
        }

        // Standard Update
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

    const handleAddManualDevice = () => {
        if (!selectedCompanyId) {
            alert("Seleziona prima un cliente");
            return;
        }

        const tempId = -Date.now(); // Negative ID to mark as temp
        const maxOrder = Math.max(...devices.map(d => d.sort_order || 0), 0);

        const newDevice = {
            device_id: tempId,
            ip_address: '',
            hostname: '',
            is_active: true,
            sort_order: maxOrder + 1,
            device_type: 'pc'
        };

        setDevices(prev => [...prev, newDevice]);
        setSelectedDeviceIds(prev => [...prev, tempId]);
        setDrafts(prev => ({
            ...prev,
            [tempId]: {
                is_active: true,
                product_name: '',
                expiration_date: '',
                device_type: 'pc',
                sort_order: maxOrder + 1,
                ip_address: '', // Specific for inputs
                hostname: ''    // Specific for inputs
            }
        }));

        // Do NOT auto-save row yet, as we need inputs.
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
                <div style={{ width: sidebarWidth }} className="bg-white border-r flex flex-col flex-shrink-0 relative">
                    <div className="p-4 border-b space-y-3">
                        <button
                            onClick={handleAddManualDevice}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            Aggiungi Dispositivo
                        </button>

                        <button
                            onClick={handleSyncKeepass}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <RefreshCw size={16} className={loading && !devices.length ? "animate-spin" : ""} />
                            Sync KeePass
                        </button>
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
                                    // Hide IP if it is a manual placeholder "no-ip-"
                                    const showIp = !dev.ip_address.startsWith('no-ip-');

                                    return (
                                        <div
                                            key={dev.device_id}
                                            onClick={() => handleSelectDevice(dev)}
                                            className={`py-2 px-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${isAdded ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden w-full text-sm">
                                                {showIp && (
                                                    <>
                                                        <span className="font-mono font-medium text-gray-800 whitespace-nowrap">{dev.ip_address}</span>
                                                        <span className="text-gray-300">-</span>
                                                    </>
                                                )}
                                                <span className="font-medium text-gray-700 truncate" title={dev.hostname}>{dev.hostname || 'N/A'}</span>
                                                {dev.keepass_path && (
                                                    <>
                                                        <span className="text-gray-300">-</span>
                                                        <span className="text-gray-500 truncate italic" title={dev.keepass_path}>{dev.keepass_path}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Resizer Handle */}
                <div
                    className="w-1 cursor-col-resize hover:bg-indigo-300 bg-gray-100 transition-colors z-10"
                    onMouseDown={startResizing}
                />

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
                                                <td className="px-4 py-3 relative">
                                                    <button
                                                        onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                                                        className="p-1.5 rounded bg-white border hover:bg-gray-50 flex items-center gap-1 text-gray-600 shadow-sm"
                                                        title="Cambia Tipo"
                                                    >
                                                        {(() => {
                                                            const types = {
                                                                pc: Monitor,
                                                                server: Server,
                                                                virtual: Layers,
                                                                laptop: Laptop,
                                                                smartphone: Smartphone,
                                                                tablet: Tablet
                                                            };
                                                            const Icon = types[draft.device_type] || Monitor;
                                                            return <Icon size={16} />;
                                                        })()}
                                                    </button>

                                                    {activeDropdown === id && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-10"
                                                                onClick={() => setActiveDropdown(null)}
                                                            />
                                                            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl z-20 w-48 p-2 grid grid-cols-3 gap-2">
                                                                {[
                                                                    { type: 'pc', icon: Monitor, label: 'PC' },
                                                                    { type: 'server', icon: Server, label: 'Server' },
                                                                    { type: 'virtual', icon: Layers, label: 'Virtual' },
                                                                    { type: 'laptop', icon: Laptop, label: 'Portatile' },
                                                                    { type: 'smartphone', icon: Smartphone, label: 'Cellulare' },
                                                                    { type: 'tablet', icon: Tablet, label: 'Tablet' }
                                                                ].map(t => (
                                                                    <button
                                                                        key={t.type}
                                                                        onClick={() => {
                                                                            updateDraft(id, 'device_type', t.type);
                                                                            handleSaveRow(id, { ...draft, device_type: t.type });
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className={`p-2 rounded flex flex-col items-center gap-1 text-xs ${draft.device_type === t.type ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                                                        title={t.label}
                                                                    >
                                                                        <t.icon size={20} />
                                                                        <span>{t.label}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {id < 0 ? (
                                                        <div className="space-y-1">
                                                            <input
                                                                type="text"
                                                                placeholder="IP Address (Opzionale)"
                                                                className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                                value={draft.ip_address || ''}
                                                                onChange={(e) => updateDraft(id, 'ip_address', e.target.value)}
                                                                onBlur={() => handleBlurSave(id)}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Nome host / Etichetta"
                                                                className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                value={draft.hostname || ''}
                                                                onChange={(e) => updateDraft(id, 'hostname', e.target.value)}
                                                                onBlur={() => handleBlurSave(id)}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {!device.ip_address?.startsWith('no-ip-') && (
                                                                <div className="font-medium text-gray-900">{device.ip_address}</div>
                                                            )}
                                                            <div className="text-xs text-gray-500">{device.hostname || '-'}</div>
                                                        </>
                                                    )}
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
