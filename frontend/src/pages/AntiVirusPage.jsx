import React, { useState, useEffect } from 'react';
import { Shield, Search, X, Check, Calendar, Monitor, Server, Layers, GripVertical, Plus, Laptop, Smartphone, Tablet, MessageCircle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import AntiVirusIntroCard from '../components/AntiVirusIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';

const AntiVirusPage = ({ onClose, getAuthHeader, readOnly = false, currentUser, onOpenTicket, onNavigateOffice, onNavigateEmail, onNavigateDispositiviAziendali, onNavigateNetworkMonitoring, onNavigateMappatura }) => {
    const showAssistenzaButton = readOnly && typeof onOpenTicket === 'function';
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [devices, setDevices] = useState([]);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null); // ID of the row with open icon dropdown
    const [sidebarWidth, setSidebarWidth] = useState(450); // Default width in px

    const companyName = (companies.find(c => String(c.id) === String(selectedCompanyId))?.azienda || companies.find(c => String(c.id) === String(selectedCompanyId))?.nome) || '—';

    const normalizeDeviceType = (v) => {
        const s = (v && typeof v === 'string' ? v.trim() : String(v || 'pc')).toLowerCase();
        return ['pc', 'server', 'virtual', 'laptop', 'smartphone', 'tablet'].includes(s) ? s : 'pc';
    };

    // Mappa il device_type originale dal DB ai 6 tipi icona disponibili in Anti-Virus
    const mapToAntivirusIcon = (originalType) => {
        const s = (originalType && typeof originalType === 'string' ? originalType.trim() : '').toLowerCase();
        if (['server', 'domain', 'dc', 'domain controller', 'nvr', 'nas', 'storage'].includes(s)) return 'server';
        if (['virtual', 'virtualization', 'virtualizzazione', 'vm', 'vmware', 'hyperv', 'esxi', 'esx', 'exsi'].includes(s) || s.includes('virtual')) return 'virtual';
        if (['laptop', 'notebook', 'portatile'].includes(s)) return 'laptop';
        if (['smartphone', 'phone', 'cellulare'].includes(s)) return 'smartphone';
        if (['tablet'].includes(s)) return 'tablet';
        if (['pc'].includes(s)) return 'pc';
        return 'pc';
    };

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
    };

    // Fetch companies: stesso endpoint di Monitoraggio rete (aziende con agent), così l'id coincide con na.azienda_id
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch(buildApiUrl('/api/network-monitoring/companies'), { headers: getAuthHeader() });
                if (res.ok) {
                    const data = await res.json();
                    setCompanies(data || []);
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
                            // Initialize drafts (device_type from API così l'icona salvata nel DB viene rispettata)
                            const initialDrafts = {};
                            existingConfigured.forEach(d => {
                                initialDrafts[d.device_id] = {
                                    is_active: d.is_active || false,
                                    product_name: d.product_name || '',
                                    expiration_date: d.expiration_date ? d.expiration_date.split('T')[0] : '',
                                    device_type: normalizeDeviceType(d.device_type),
                                    sort_order: d.sort_order || 0
                                };
                            });
                            setDrafts(initialDrafts);
                        }
                    } else {
                        // Silent refresh: aggiorna i draft con device_type dall'API così l'icona salvata si vede
                        setDrafts(prev => {
                            const next = { ...prev };
                            data.forEach(d => {
                                if (prev[d.device_id]) {
                                    next[d.device_id] = {
                                        ...prev[d.device_id],
                                        device_type: normalizeDeviceType(d.device_type),
                                        is_active: d.is_active ?? prev[d.device_id].is_active,
                                        product_name: d.product_name ?? prev[d.device_id].product_name,
                                        expiration_date: d.expiration_date ? d.expiration_date.split('T')[0] : prev[d.device_id].expiration_date,
                                        sort_order: d.sort_order ?? prev[d.device_id].sort_order
                                    };
                                }
                            });
                            return next;
                        });
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

        // Refresh automatico ogni 5 secondi (sync antivirus da CommAgent si riflette senza azione utente)
        const intervalId = setInterval(() => {
            fetchDevices(true);
        }, 5000);

        return () => clearInterval(intervalId);
    }, [selectedCompanyId, getAuthHeader]);

    const handleSelectDevice = (device) => {
        if (readOnly) return;
        if (selectedDeviceIds.includes(device.device_id)) return;

        setSelectedDeviceIds(prev => [...prev, device.device_id]);

        // When adding new, put it at end of list order
        // device_type: usa original_device_type dal DB per mappare all'icona corretta
        const maxOrder = Math.max(...devices.map(d => d.sort_order || 0), 0);
        const dt = mapToAntivirusIcon(device.original_device_type || device.device_type);

        setDrafts(prev => ({
            ...prev,
            [device.device_id]: {
                is_active: true, // Default to true when adding
                product_name: device.product_name || '',
                expiration_date: device.expiration_date ? device.expiration_date.split('T')[0] : '',
                device_type: dt,
                sort_order: maxOrder + 1
            }
        }));

        // Auto-save initial state to persist inclusion in list
        handleSaveRow(device.device_id, {
            is_active: true,
            product_name: device.product_name || '',
            expiration_date: device.expiration_date ? device.expiration_date.split('T')[0] : '',
            device_type: dt,
            sort_order: maxOrder + 1
        });
    };

    const handleRemoveDevice = (deviceId) => {
        if (readOnly) return;
        const device = devices.find(d => d.device_id === deviceId);
        if (window.confirm(`Rimuovere ${device?.ip_address} dalla lista?`)) {
            setSelectedDeviceIds(prev => prev.filter(id => id !== deviceId));
            setDrafts(prev => {
                const newDrafts = { ...prev };
                delete newDrafts[deviceId];
                return newDrafts;
            });

            // Update backend: is_active=false e svuota prodotto, ma PRESERVA device_type così se riaggiungi mantiene l'icona
            const currentType = drafts[deviceId]?.device_type || device?.device_type || 'pc';
            handleSaveRow(deviceId, {
                is_active: false,
                product_name: '',
                expiration_date: null,
                device_type: currentType,
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
        if (readOnly) return;
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
        if (readOnly) return;
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
        if (readOnly) return;
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
                    <SectionNavMenu
                        currentPage="antivirus"
                        onNavigateHome={onClose}
                        onNavigateOffice={onNavigateOffice}
                        onNavigateEmail={onNavigateEmail}
                        onNavigateAntiVirus={null}
                        onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
                        onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
                        onNavigateMappatura={onNavigateMappatura}
                        currentUser={currentUser}
                    />
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Gestione Anti-Virus</h1>
                        {readOnly && <p className="text-sm text-gray-500 mt-0.5">Sola consultazione</p>}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        className="border rounded-lg px-3 py-2 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">{readOnly ? 'Seleziona Azienda...' : 'Seleziona Cliente...'}</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.azienda || c.nome + ' ' + c.cognome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {!selectedCompanyId ? (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="max-w-4xl mx-auto w-full">
                            <AntiVirusIntroCard
                                companies={companies}
                                value={selectedCompanyId}
                                onChange={(id) => setSelectedCompanyId(id || '')}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Left Sidebar - Solo per tecnico: lista dispositivi da cui aggiungere alla tabella */}
                        {!readOnly && (
                            <>
                                <div style={{ width: sidebarWidth }} className="bg-white border-r flex flex-col flex-shrink-0 relative">
                                    <div className="p-4 border-b space-y-3">
                                        <button
                                            onClick={handleAddManualDevice}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                                        >
                                            <Plus size={16} />
                                            Aggiungi Dispositivo
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
                                <div
                                    className="w-1 cursor-col-resize hover:bg-indigo-300 bg-gray-100 transition-colors z-10"
                                    onMouseDown={startResizing}
                                />
                            </>
                        )}

                        {/* Pannello destro: tabella compilata dal tecnico (le aziende vedono solo questa, in sola lettura) */}
                        <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
                            {selectedDeviceIds.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-sm border overflow-visible relative">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-2 py-3 w-8"></th>
                                                <th className="px-4 py-3 font-medium text-gray-600">Attivo</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">Dispositivo</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">Prodotto</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">Scadenza</th>
                                                {showAssistenzaButton && <th className="px-4 py-3 font-medium text-gray-600 w-32">Assistenza</th>}
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
                                                        draggable={!readOnly}
                                                        onDragStart={(e) => !readOnly && handleDragStart(e, index)}
                                                        onDragOver={(e) => !readOnly && handleDragOver(e, index)}
                                                        onDrop={(e) => handleDrop(e, index)}
                                                    >
                                                        <td className="px-2 py-3 w-8 text-gray-400">
                                                            {readOnly ? <span className="w-4 block" /> : <GripVertical size={16} className="cursor-grab active:cursor-grabbing" />}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                checked={draft.is_active || false}
                                                                readOnly={readOnly}
                                                                disabled={readOnly}
                                                                onChange={(e) => {
                                                                    const val = e.target.checked;
                                                                    updateDraft(id, 'is_active', val);
                                                                    handleSaveRow(id, { ...draft, is_active: val });
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 relative">
                                                            {readOnly ? (
                                                                <div className="p-1.5 rounded bg-gray-50 flex items-center gap-1 text-gray-600">
                                                                    {(() => {
                                                                        const types = { pc: Monitor, server: Server, virtual: Layers, laptop: Laptop, smartphone: Smartphone, tablet: Tablet };
                                                                        const displayType = (draft.device_type || device?.device_type || 'pc').toString().toLowerCase();
                                                                        const Icon = types[displayType] || Monitor;
                                                                        return <Icon size={16} />;
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <>
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
                                                                            const displayType = (draft.device_type || device?.device_type || 'pc').toString().toLowerCase();
                                                                            const Icon = types[displayType] || Monitor;
                                                                            return <Icon size={16} />;
                                                                        })()}
                                                                    </button>
                                                                    {activeDropdown === id && (
                                                                        <>
                                                                            <div
                                                                                className="fixed inset-0 z-[100]"
                                                                                onClick={() => setActiveDropdown(null)}
                                                                            />
                                                                            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl z-[110] w-48 p-2 grid grid-cols-3 gap-2">
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
                                                                    <div className="text-xs text-gray-500">{device.device_username || '-'}</div>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {readOnly ? (
                                                                <span className="text-gray-900">{draft.product_name || '-'}</span>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                    placeholder="Nome prodotto"
                                                                    value={draft.product_name || ''}
                                                                    onChange={(e) => updateDraft(id, 'product_name', e.target.value)}
                                                                    onBlur={() => handleBlurSave(id)}
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {readOnly ? (
                                                                <span className="text-gray-900">{draft.expiration_date ? new Date(draft.expiration_date).toLocaleDateString('it-IT') : '-'}</span>
                                                            ) : (
                                                                <input
                                                                    type="date"
                                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                    value={draft.expiration_date || ''}
                                                                    onChange={(e) => updateDraft(id, 'expiration_date', e.target.value)}
                                                                    onBlur={() => handleBlurSave(id)}
                                                                />
                                                            )}
                                                        </td>
                                                        {showAssistenzaButton && (
                                                            <td className="px-4 py-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenTicket({
                                                                        titolo: `Assistenza Anti-Virus - ${(draft.hostname || device?.hostname || draft.ip_address || device?.ip_address || 'Dispositivo').toString().trim()}`,
                                                                        descrizione: `Richiesta assistenza relativa al dispositivo Anti-Virus:\n\nDispositivo: ${draft.hostname || device?.hostname || '—'}\nIP: ${draft.ip_address || device?.ip_address || '—'}\nProdotto: ${draft.product_name || '—'}\nScadenza: ${draft.expiration_date ? new Date(draft.expiration_date).toLocaleDateString('it-IT') : '—'}\nAzienda: ${companyName}`
                                                                    })}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                                                                    title="Apri un ticket di assistenza"
                                                                >
                                                                    <MessageCircle size={14} />
                                                                    Apri ticket
                                                                </button>
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3 text-right">
                                                            {!readOnly && (
                                                                <button
                                                                    onClick={() => handleRemoveDevice(id)}
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Rimuovi dalla lista"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            )}
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
                                    <p className="text-lg font-medium">
                                        {readOnly ? 'Nessun dispositivo con Anti-Virus configurato' : 'Nessun dispositivo selezionato'}
                                    </p>
                                    <p className="text-sm">
                                        {readOnly ? 'Il tecnico non ha ancora configurato dispositivi per questa azienda.' : 'Seleziona i dispositivi dalla lista a sinistra per modificarli'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AntiVirusPage;
