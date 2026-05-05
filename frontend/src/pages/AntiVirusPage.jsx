import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  X,
  Monitor,
  Server,
  Layers,
  GripVertical,
  Plus,
  Laptop,
  Smartphone,
  Tablet,
  MessageCircle,
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import AntiVirusIntroCard from '../components/AntiVirusIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';
import {
  hexToRgba,
  normalizeHex,
  readableOnAccent,
  getStoredTechHubAccent,
  hubEmbeddedRootInlineStyle,
  hubEmbeddedBackBtnInlineStyle
} from '../utils/techHubAccent';

const AntiVirusPage = ({
  onClose,
  getAuthHeader,
  selectedCompanyId: initialCompanyId,
  onCompanyChange,
  readOnly = false,
  currentUser,
  onOpenTicket,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateDispositiviAziendali,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateSpeedTest,
  onNavigateVpn,
  onNavigateHome,
  onNavigateLSight,
  embedded = false,
  closeEmbedded,
  accentHex: accentHexProp,
  hubSurfaceMode: hubSurfaceModeProp = 'dark'
}) => {
    const showAssistenzaButton = readOnly && typeof onOpenTicket === 'function';
    const accent = useMemo(() => normalizeHex(accentHexProp) || getStoredTechHubAccent(), [accentHexProp]);
    const primaryBtnStyle = useMemo(
      () => ({ backgroundColor: accent, color: readableOnAccent(accent) }),
      [accent]
    );
    const onEmbeddedBack = () => {
      if (typeof closeEmbedded === 'function') closeEmbedded();
      else if (typeof onClose === 'function') onClose();
    };
    const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);
    const rootEmbeddedStyle = useMemo(
      () => (embedded ? hubEmbeddedRootInlineStyle(accent) : undefined),
      [embedded, accent]
    );
    const companySelectCls = embedded
      ? 'min-w-[200px] rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none [color-scheme:light] focus:ring-2 focus:ring-[color:var(--hub-accent)]'
      : 'min-w-[200px] rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500';

    /** Su sfondo Hub: color-scheme + bg opachi; altrimenti Chrome/OS rendono gli input quasi bianchi. */
    const embedHubFieldCls =
      'appearance-none rounded border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1 text-sm text-[color:var(--hub-chrome-text)] shadow-none outline-none ring-0 placeholder:text-[color:var(--hub-chrome-placeholder)] focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-[color:var(--hub-accent)]';
    const embedHubSearchCls =
      'appearance-none w-full rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] py-2 pl-10 pr-4 text-sm text-[color:var(--hub-chrome-text)] outline-none shadow-none ring-0 placeholder:text-[color:var(--hub-chrome-placeholder)] focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)]';

    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId || '');
    const [devices, setDevices] = useState([]);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null); // ID of the row with open icon dropdown
    const [sidebarWidth, setSidebarWidth] = useState(320); // Default width in px (più compatta)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Sincronizza lo stato locale con initialCompanyId se cambia esternamente
    useEffect(() => {
        if (initialCompanyId && String(initialCompanyId) !== String(selectedCompanyId)) {
            setSelectedCompanyId(initialCompanyId);
        }
    }, [initialCompanyId]);

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

    // Se l'azienda selezionata non esiste nella lista, resetta (evita select "vuoto" e fetch inutili)
    useEffect(() => {
        if (!selectedCompanyId) return;
        if (!Array.isArray(companies) || companies.length === 0) return;
        const exists = companies.some(c => String(c?.id) === String(selectedCompanyId));
        if (!exists) {
            setSelectedCompanyId('');
            setDevices([]);
            setSelectedDeviceIds([]);
            setDrafts({});
            if (typeof onCompanyChange === 'function') onCompanyChange('');
        }
    }, [companies, selectedCompanyId, onCompanyChange]);

    // Fetch devices when company selected
    useEffect(() => {
        // Se l'id non è nella lista aziende, non fare fetch (evita carichi "fantasma")
        if (selectedCompanyId && Array.isArray(companies) && companies.length > 0) {
            const exists = companies.some(c => String(c?.id) === String(selectedCompanyId));
            if (!exists) {
                setDevices([]);
                setSelectedDeviceIds([]);
                setDrafts({});
                return;
            }
        }
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
                        // Silent refresh: aggiorna draft esistenti e aggiunge a destra i dispositivi con antivirus rilevato da CommAgent
                        // UNICA LOGICA che riposta un dispositivo a destra: se l'API restituisce is_active OR product_name OR expiration_date
                        // e il device_id non è già in selectedDeviceIds, viene aggiunto. La causa di un IP che "ricompare" è quindi
                        // che GET antivirus-devices sta restituendo quel dispositivo con quei campi valorizzati (es. da comm_device_info
                        // se il device non è in antivirus_sync_ignored, o da antivirus_info se la sync CommAgent ha riscritto).
                        const withConfig = (d) => d.is_active || d.product_name || d.expiration_date;
                        setSelectedDeviceIds(prevIds => {
                            const toAdd = data.filter(d => withConfig(d) && !prevIds.includes(d.device_id));
                            if (toAdd.length === 0) return prevIds;
                            if (process.env.NODE_ENV !== 'production') {
                                toAdd.forEach(d => {
                                    console.log('[AntiVirus] Dispositivo riposto a destra automaticamente:', {
                                        device_id: d.device_id,
                                        ip_address: d.ip_address,
                                        hostname: d.hostname,
                                        motivo: {
                                            is_active: d.is_active,
                                            product_name: d.product_name || '(vuoto)',
                                            expiration_date: d.expiration_date || '(vuoto)'
                                        }
                                    });
                                });
                            }
                            return [...prevIds, ...toAdd.map(d => d.device_id)];
                        });
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
                                } else if (withConfig(d)) {
                                    next[d.device_id] = {
                                        is_active: d.is_active || false,
                                        product_name: d.product_name || '',
                                        expiration_date: d.expiration_date ? d.expiration_date.split('T')[0] : '',
                                        device_type: normalizeDeviceType(d.device_type),
                                        sort_order: d.sort_order || 0
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

    const rootClassName = embedded
        ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)] font-sans'
        : 'fixed inset-0 z-50 flex flex-col bg-gray-100 font-sans';

    return (
        <div className={rootClassName} style={rootEmbeddedStyle}>
            {/* Header */}
            <div
                className={
                    embedded
                        ? 'flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3'
                        : 'flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm'
                }
                style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
            >
                <div className="flex min-w-0 items-center gap-3">
                    {embedded ? (
                        <button type="button" onClick={onEmbeddedBack} style={embeddedBackBtnStyle}>
                            <ArrowLeft size={18} aria-hidden />
                            Panoramica Hub
                        </button>
                    ) : (
                        <SectionNavMenu
                            currentPage="antivirus"
                            onNavigateHome={onNavigateHome || onClose}
                            onNavigateOffice={onNavigateOffice}
                            onNavigateEmail={onNavigateEmail}
                            onNavigateAntiVirus={null}
                            onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
                            onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
                            onNavigateMappatura={onNavigateMappatura}
                            onNavigateSpeedTest={onNavigateSpeedTest}
                            onNavigateVpn={onNavigateVpn}
                            onNavigateLSight={onNavigateLSight}
                            currentUser={currentUser}
                            selectedCompanyId={selectedCompanyId}
                        />
                    )}
                    <div
                        className={embedded ? 'rounded-lg p-2' : 'rounded-lg bg-indigo-100 p-2 text-indigo-600'}
                        style={embedded ? { backgroundColor: hexToRgba(accent, 0.18) } : undefined}
                    >
                        <Shield size={24} style={embedded ? { color: accent } : undefined} />
                    </div>
                    <div className="min-w-0">
                        <h1 className={`font-bold ${embedded ? 'truncate text-lg text-[color:var(--hub-chrome-text)]' : 'text-xl text-gray-800'}`}>
                            Gestione Anti-Virus
                        </h1>
                        {readOnly && (
                            <p className={`mt-0.5 text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>Sola consultazione</p>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-4">
                    <select
                        className={companySelectCls}
                        value={selectedCompanyId}
                        onChange={(e) => {
                            const newId = e.target.value;
                            setSelectedCompanyId(newId);
                            if (onCompanyChange) onCompanyChange(newId);
                        }}
                    >
                        <option value="">{readOnly ? 'Seleziona Azienda...' : 'Seleziona Cliente...'}</option>
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.azienda || c.nome + ' ' + c.cognome}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="flex h-full flex-1 min-h-0 overflow-hidden">
                {!selectedCompanyId ? (
                    <div
                        className={`flex-1 overflow-auto ${embedded ? 'bg-[transparent] px-4 py-4 md:px-5' : 'p-6'}`}
                        style={embedded ? { backgroundColor: 'var(--hub-chrome-page)' } : undefined}
                    >
                        <div className="mx-auto w-full max-w-4xl">
                            <AntiVirusIntroCard
                                embedded={embedded}
                                accentHex={accent}
                                hubSurfaceMode={hubSurfaceModeProp}
                                companies={companies}
                                value={selectedCompanyId}
                                onChange={(id) => {
                                    const newId = id || '';
                                    setSelectedCompanyId(newId);
                                    if (onCompanyChange) onCompanyChange(newId);
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Left Sidebar - Solo per tecnico: lista dispositivi da cui aggiungere alla tabella */}
                        {!readOnly && (
                            <>
                                <div
                                    style={{
                                        width: sidebarCollapsed ? 0 : Math.max(280, Math.min(420, sidebarWidth)),
                                        ...(embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : {})
                                    }}
                                    className={`relative flex shrink-0 flex-col border-r ${embedded ? 'border-[color:var(--hub-chrome-border-soft)]' : 'bg-white'} ${sidebarCollapsed ? 'overflow-hidden' : ''} min-h-0`}
                                >
                                    <div className={`space-y-3 border-b p-4 ${embedded ? 'border-[color:var(--hub-chrome-border-soft)]' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAddManualDevice}
                                                className={
                                                    embedded
                                                        ? 'flex w-full items-center justify-center gap-2 rounded-lg py-2 pl-4 pr-4 text-sm font-medium shadow-sm transition hover:brightness-110'
                                                        : 'flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 pl-4 pr-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700'
                                                }
                                                style={embedded ? primaryBtnStyle : undefined}
                                            >
                                                <Plus size={16} />
                                                Aggiungi Dispositivo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSidebarCollapsed(true)}
                                                className={`shrink-0 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                                                    embedded
                                                        ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]'
                                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                                                }`}
                                                title="Nascondi lista IP"
                                            >
                                                <ChevronsLeft size={16} />
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Search
                                                className={`absolute left-3 top-1/2 -translate-y-1/2 ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
                                                size={18}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Cerca IP o Hostname..."
                                                autoComplete="off"
                                                className={
                                                    embedded
                                                        ? embedHubSearchCls
                                                        : 'w-full rounded-lg border py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500'
                                                }
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto">
                                        {!selectedCompanyId ? (
                                            <div className={`p-8 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>
                                                Seleziona un cliente per visualizzare i dispositivi
                                            </div>
                                        ) : loading ? (
                                            <div className={`flex flex-col items-center p-8 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>
                                                <span className="mb-2 animate-spin text-2xl">⌛</span>
                                                Caricamento...
                                            </div>
                                        ) : filteredDevices.length === 0 ? (
                                            <div className={`p-8 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>Nessun dispositivo trovato</div>
                                        ) : (
                                            <div className={embedded ? 'divide-y divide-[color:var(--hub-chrome-border-soft)]' : 'divide-y'}>
                                                {filteredDevices.map(dev => {
                                                    const isAdded = selectedDeviceIds.includes(dev.device_id);
                                                    const showIp = !dev.ip_address.startsWith('no-ip-');
                                                    return (
                                                        <div
                                                            key={dev.device_id}
                                                            onClick={() => handleSelectDevice(dev)}
                                                            className={`flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 transition-colors ${
                                                                embedded ? 'border-l-4 hover:bg-[color:var(--hub-chrome-hover)]' : 'cursor-pointer hover:bg-gray-50'
                                                            } ${isAdded && !embedded ? 'border-l-4 border-indigo-600 bg-indigo-50' : embedded ? '' : 'border-transparent'}`}
                                                            style={
                                                                isAdded && embedded
                                                                    ? {
                                                                          borderLeftWidth: 4,
                                                                          borderLeftStyle: 'solid',
                                                                          borderLeftColor: accent,
                                                                          backgroundColor: hexToRgba(accent, 0.1)
                                                                      }
                                                                    : embedded
                                                                      ? { borderLeftWidth: 4 }
                                                                      : undefined
                                                            }
                                                        >
                                                            <div className={`flex w-full items-center gap-1.5 overflow-hidden text-xs ${embedded ? 'text-[color:var(--hub-chrome-text)]' : ''}`}>
                                                                {showIp && (
                                                                    <>
                                                                        <span className={`whitespace-nowrap font-mono font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-800'}`}>{dev.ip_address}</span>
                                                                        <span className={embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-300'}>-</span>
                                                                    </>
                                                                )}
                                                                <span className={`truncate font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}`} title={dev.hostname}>{dev.hostname || 'N/A'}</span>
                                                                {dev.keepass_path && (
                                                                    <>
                                                                        <span className={embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-300'}>-</span>
                                                                        <span className={`truncate italic ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`} title={dev.keepass_path}>{dev.keepass_path}</span>
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
                                {!sidebarCollapsed && (
                                    <div
                                        className={`z-10 w-1 cursor-col-resize transition-colors ${embedded ? 'bg-[color:var(--hub-chrome-muted-fill)] hover:bg-[color:var(--hub-accent)]' : 'bg-gray-100 hover:bg-indigo-300'}`}
                                        onMouseDown={startResizing}
                                    />
                                )}
                            </>
                        )}

                        {/* Pannello destro: tabella compilata dal tecnico (le aziende vedono solo questa, in sola lettura) */}
                        <div
                            className={`relative flex-1 min-h-0 overflow-hidden p-6 md:p-8 ${embedded ? '' : 'bg-gray-50'}`}
                            style={embedded ? { backgroundColor: 'var(--hub-chrome-page)' } : undefined}
                        >
                            <div className="h-full min-h-0 overflow-y-auto">
                            {/* Bottone per riaprire sidebar quando è nascosta */}
                            {!readOnly && sidebarCollapsed && (
                                <button
                                    type="button"
                                    onClick={() => setSidebarCollapsed(false)}
                                    className={`absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                                        embedded
                                            ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                    title="Mostra lista IP"
                                >
                                    <ChevronsRight size={16} />
                                    IP
                                </button>
                            )}

                            {selectedDeviceIds.length > 0 ? (
                                <div
                                    className={`relative overflow-visible rounded-xl border shadow-sm ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)]' : 'border bg-white'}`}
                                >
                                    <table className="w-full text-left text-sm">
                                        <thead
                                            className={
                                                embedded ? 'border-b border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)]' : 'border-b bg-gray-50'
                                            }
                                        >
                                            <tr>
                                                <th className="w-8 px-2 py-3"></th>
                                                <th
                                                    className={`px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                >
                                                    Attivo
                                                </th>
                                                <th
                                                    className={`px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                >
                                                    Tipo
                                                </th>
                                                <th
                                                    className={`px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                >
                                                    Dispositivo
                                                </th>
                                                <th
                                                    className={`px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                >
                                                    Utente
                                                </th>
                                                <th
                                                    className={`px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                >
                                                    Prodotto
                                                </th>
                                                <th
                                                    className={`px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                >
                                                    Scadenza
                                                </th>
                                                {showAssistenzaButton && (
                                                    <th
                                                        className={`w-32 px-4 py-3 font-medium ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
                                                    >
                                                        Assistenza
                                                    </th>
                                                )}
                                                <th className={`px-4 py-3 text-right font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}></th>
                                            </tr>
                                        </thead>
                                        <tbody className={embedded ? 'divide-y divide-[color:var(--hub-chrome-border-soft)]' : 'divide-y'}>
                                            {selectedDeviceIds.map((id, index) => {
                                                const device = devices.find(d => d.device_id === id);
                                                const draft = drafts[id] || {};
                                                if (!device) return null;

                                                const isExpired = draft.expiration_date && new Date(draft.expiration_date) < new Date(new Date().setHours(0, 0, 0, 0));

                                                return (
                                                    <tr
                                                        key={id}
                                                        className={`group ${
                                                            isExpired
                                                                ? embedded
                                                                    ? 'bg-red-500/12 hover:bg-red-500/18'
                                                                    : 'bg-red-50 hover:bg-red-100'
                                                                : embedded
                                                                  ? 'hover:bg-[color:var(--hub-chrome-hover)]'
                                                                  : 'hover:bg-gray-50'
                                                        }`}
                                                        draggable={!readOnly}
                                                        onDragStart={(e) => !readOnly && handleDragStart(e, index)}
                                                        onDragOver={(e) => !readOnly && handleDragOver(e, index)}
                                                        onDrop={(e) => handleDrop(e, index)}
                                                    >
                                                        <td className={`w-8 px-2 py-3 ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}>
                                                            {readOnly ? <span className="block w-4" /> : <GripVertical size={16} className="cursor-grab active:cursor-grabbing" />}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="checkbox"
                                                                className={`h-4 w-4 rounded border-gray-300 ${embedded ? 'text-[color:var(--hub-accent)] focus:ring-[color:var(--hub-accent)]' : 'text-indigo-600 focus:ring-indigo-500'}`}
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
                                                                <div
                                                                    className={`flex items-center gap-1 rounded p-1.5 ${embedded ? 'bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-secondary)]' : 'bg-gray-50 text-gray-600'}`}
                                                                >
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
                                                                        type="button"
                                                                        onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                                                                        className={
                                                                            embedded
                                                                                ? 'flex items-center gap-1 rounded border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] p-1.5 text-[color:var(--hub-chrome-text-secondary)] shadow-none hover:bg-[color:var(--hub-chrome-hover)]'
                                                                                : 'flex items-center gap-1 rounded border bg-white p-1.5 text-gray-600 shadow-sm hover:bg-gray-50'
                                                                        }
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
                                                                            <div
                                                                                className={`absolute left-0 top-full z-[110] mt-1 grid w-48 grid-cols-3 gap-2 rounded-lg border p-2 shadow-xl ${
                                                                                    embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)]' : 'border bg-white'
                                                                                }`}
                                                                            >
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
                                                                                        className={`flex flex-col items-center gap-1 rounded p-2 text-xs ${
                                                                                            draft.device_type === t.type
                                                                                                ? embedded
                                                                                                    ? 'text-[color:var(--hub-accent)]'
                                                                                                    : 'bg-indigo-50 text-indigo-600'
                                                                                                : embedded
                                                                                                  ? 'text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]'
                                                                                                  : 'text-gray-600 hover:bg-gray-50'
                                                                                        }`}
                                                                                        style={
                                                                                            draft.device_type === t.type && embedded
                                                                                                ? { backgroundColor: hexToRgba(accent, 0.14) }
                                                                                                : undefined
                                                                                        }
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
                                                                        autoComplete="off"
                                                                        className={`font-mono text-xs ${embedded ? `${embedHubFieldCls} w-full` : 'w-full rounded border px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500'}`}
                                                                        value={draft.ip_address || ''}
                                                                        onChange={(e) => updateDraft(id, 'ip_address', e.target.value)}
                                                                        onBlur={() => handleBlurSave(id)}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Nome host / Etichetta"
                                                                        autoComplete="off"
                                                                        className={`text-xs ${embedded ? `${embedHubFieldCls} w-full` : 'w-full rounded border px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500'}`}
                                                                        value={draft.hostname || ''}
                                                                        onChange={(e) => updateDraft(id, 'hostname', e.target.value)}
                                                                        onBlur={() => handleBlurSave(id)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {!device.ip_address?.startsWith('no-ip-') && (
                                                                        <div className={`font-mono font-medium ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>
                                                                            {device.ip_address}
                                                                        </div>
                                                                    )}
                                                                    {device.mac_address && (
                                                                        <div className={`font-mono text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-400'}`}>{device.mac_address}</div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {device.hostname && device.hostname !== '-' && device.hostname !== '' ? (
                                                                <div className={`text-sm font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-800'}`}>{device.hostname}</div>
                                                            ) : null}
                                                            {device.device_username && device.device_username !== '-' && device.device_username !== '' ? (
                                                                <div className={`text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>{device.device_username}</div>
                                                            ) : (
                                                                !device.hostname || device.hostname === '-' ? (
                                                                    <span className={embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-300'}>-</span>
                                                                ) : null
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {readOnly ? (
                                                                <span className={embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}>{draft.product_name || '-'}</span>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    autoComplete="off"
                                                                    className={
                                                                        embedded ? `${embedHubFieldCls} w-full` : 'w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500'
                                                                    }
                                                                    placeholder="Nome prodotto"
                                                                    value={draft.product_name || ''}
                                                                    onChange={(e) => updateDraft(id, 'product_name', e.target.value)}
                                                                    onBlur={() => handleBlurSave(id)}
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {readOnly ? (
                                                                <span className={embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}>
                                                                    {draft.expiration_date ? new Date(draft.expiration_date).toLocaleDateString('it-IT') : '-'}
                                                                </span>
                                                            ) : (
                                                                <input
                                                                    type="date"
                                                                    className={
                                                                        embedded ? `${embedHubFieldCls} w-full min-h-[2.25rem]` : 'w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500'
                                                                    }
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
                                                                    className={
                                                                        embedded
                                                                            ? 'inline-flex items-center gap-1 whitespace-nowrap rounded border border-[color:var(--hub-accent-border)] bg-[color:var(--hub-chrome-muted-fill)] px-2 py-1 text-xs font-medium text-[color:var(--hub-accent)] transition-colors hover:bg-[color:var(--hub-chrome-hover)]'
                                                                            : 'inline-flex items-center gap-1 whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100'
                                                                    }
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
                                                                    type="button"
                                                                    onClick={() => handleRemoveDevice(id)}
                                                                    className={`rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100 ${
                                                                        embedded ? 'text-red-400 hover:bg-red-500/15' : 'text-red-600 hover:bg-red-50'
                                                                    }`}
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
                                <div
                                    className={`flex h-full flex-col items-center justify-center ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-400'}`}
                                >
                                    <div
                                        className={`mb-4 rounded-full p-6 ${embedded ? 'bg-[color:var(--hub-chrome-muted-fill)]' : 'bg-gray-100'}`}
                                    >
                                        <Shield size={48} className={embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-300'} />
                                    </div>
                                    <p className={`text-lg font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : ''}`}>
                                        {readOnly ? 'Nessun dispositivo con Anti-Virus configurato' : 'Nessun dispositivo selezionato'}
                                    </p>
                                    <p className="text-sm">
                                        {readOnly
                                            ? 'Il tecnico non ha ancora configurato dispositivi per questa azienda.'
                                            : 'Seleziona i dispositivi dalla lista a sinistra per modificarli'}
                                    </p>
                                </div>
                            )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AntiVirusPage;
