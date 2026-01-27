import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, ZoomIn, ZoomOut, Maximize, Loader, Server, RotateCw,
    Monitor, Printer, Wifi, Router, X, Trash2, Link2,
    Smartphone, Tablet, Laptop, Camera, Tv, Watch, Phone, Database, Cloud, Globe, List,
    Layers, HardDrive, Shield, RadioTower, Speaker, Circle
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import * as d3 from 'd3-force';

const AVAILABLE_ICONS = [
    { type: 'pc', icon: Monitor, label: 'PC / Monitor' },
    { type: 'server', icon: Server, label: 'Server' },
    { type: 'virtualization', icon: Layers, label: 'Virtualizzazione' },
    { type: 'nas', icon: HardDrive, label: 'NAS / Storage' },
    { type: 'router', icon: Router, label: 'Router' },
    { type: 'firewall', icon: Shield, label: 'Firewall' },
    { type: 'switch', icon: Server, label: 'Switch' },
    { type: 'wifi', icon: Wifi, label: 'WiFi / AP' },
    { type: 'radio', icon: RadioTower, label: 'Ponte Radio' },
    { type: 'printer', icon: Printer, label: 'Stampante' },
    { type: 'smartphone', icon: Smartphone, label: 'Smartphone' },
    { type: 'tablet', icon: Tablet, label: 'Tablet' },
    { type: 'laptop', icon: Laptop, label: 'Laptop' },
    { type: 'wearable', icon: Watch, label: 'Wearable' },
    { type: 'camera', icon: Camera, label: 'Camera / CCTV' },
    { type: 'speaker', icon: Speaker, label: 'Speaker / Audio' },
    { type: 'tv', icon: Tv, label: 'TV / Screen' },
    { type: 'phone', icon: Phone, label: 'Telefono VoIP' },
    { type: 'database', icon: Database, label: 'Database' },
    { type: 'cloud', icon: Cloud, label: 'Cloud' },
    { type: 'internet', icon: Globe, label: 'Internet' },
    { type: 'generic', icon: Circle, label: 'Generico / Altro' }
];

const MappaturaPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId, onNavigateToMonitoring = null }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId ? String(initialCompanyId) : '');
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [hoveredDevice, setHoveredDevice] = useState(null);
    const [tooltipRect, setTooltipRect] = useState(null);
    const [reassociateChildNode, setReassociateChildNode] = useState(null);
    const hoveredRowRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [refreshDevicesKey, setRefreshDevicesKey] = useState(0);
    const simulationRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const offsetRef = useRef(offset);
    const scaleRef = useRef(scale);
    const justDroppedRef = useRef(false);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch(buildApiUrl('/api/network-monitoring/clients'), { headers: getAuthHeader() });
                if (res.ok) {
                    const data = await res.json();
                    setCompanies(data);
                }
            } catch (e) { console.error('Errore fetch aziende:', e); }
        };
        fetchCompanies();
    }, []);

    const prevCompanyIdRef = useRef(null);
    const selectedCompanyIdRef = useRef(selectedCompanyId);
    useEffect(() => { selectedCompanyIdRef.current = selectedCompanyId; }, [selectedCompanyId]);

    const parseAziendaId = (v) => {
        const n = parseInt(v, 10);
        return (typeof n === 'number' && !isNaN(n) && n > 0) ? n : null;
    };

    useEffect(() => {
        const aziendaId = parseAziendaId(selectedCompanyId);
        if (!aziendaId) return;
        const companyChanged = prevCompanyIdRef.current !== null && prevCompanyIdRef.current !== selectedCompanyId;
        prevCompanyIdRef.current = selectedCompanyId;
        if (companyChanged) {
            setNodes([]);
            setLinks([]);
        }
        setLoading(true);
        const fetchDevices = async () => {
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/devices`), { headers: getAuthHeader() });
                if (res.ok) setDevices(await res.json());
            } catch (e) { console.error('Errore fetch dispositivi:', e); }
            finally { setLoading(false); }
        };
        fetchDevices();
    }, [selectedCompanyId, refreshDevicesKey]);

    useEffect(() => {
        const aziendaId = parseAziendaId(selectedCompanyId);
        if (!aziendaId || loading || !devices.length) return;
        const ac = new AbortController();
        const loadMapFromDb = async () => {
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes`), {
                    headers: getAuthHeader(),
                    signal: ac.signal
                });
                if (ac.signal.aborted) return;
                if (res.ok) {
                    const rows = await res.json();
                    if (ac.signal.aborted) return;
                    const idToPos = new Map(rows.map(r => [Number(r.device_id), { x: r.x, y: r.y }]));
                    const deviceIds = new Set(rows.map(r => Number(r.device_id)));
                    const mapNodes = [];
                    for (const d of devices) {
                        const did = Number(d.id);
                        if (!deviceIds.has(did)) continue;
                        const pos = idToPos.get(did) || { x: 0, y: 0 };
                        mapNodes.push({
                            id: d.id,
                            type: mapDeviceType(d),
                            label: (d.notes || d.hostname || '').trim() || d.ip_address,
                            ip: d.ip_address,
                            status: d.status,
                            details: d,
                            x: pos.x ?? 0,
                            y: pos.y ?? 0
                        });
                    }
                    const mapLinks = [];
                    for (const n of mapNodes) {
                        const pid = n.details?.parent_device_id != null ? Number(n.details.parent_device_id) : null;
                        if (pid == null || !deviceIds.has(pid)) continue;
                        mapLinks.push({ source: pid, target: n.id });
                    }
                    if (ac.signal.aborted || parseAziendaId(selectedCompanyIdRef.current) !== aziendaId) return;
                    setNodes(mapNodes);
                    setLinks(mapLinks);
                    // Passa shouldAutoCenter=true per centrare automaticamente quando i nodi vengono caricati
                    ensureSimulation(mapNodes, mapLinks, true);
                    return;
                }
                const errBody = await res.text();
                console.error('❌ Mappatura GET mappatura-nodes fallito:', res.status, errBody);
            } catch (e) {
                if (e?.name === 'AbortError') return;
                console.error('Errore caricamento mappatura:', e);
            }
        };
        loadMapFromDb();
        return () => ac.abort();
    }, [selectedCompanyId, loading, devices]);

    // Centra automaticamente quando i nodi vengono caricati per la prima volta
    const hasCenteredRef = useRef(false);
    useEffect(() => {
        if (nodes.length > 0 && !hasCenteredRef.current) {
            // Aspetta che la simulazione si stabilizzi prima di centrare
            const timer = setTimeout(() => {
                centerAndZoomToNodes(nodes);
                hasCenteredRef.current = true;
            }, 1000);
            return () => clearTimeout(timer);
        }
        // Reset quando cambia l'azienda
        if (nodes.length === 0) {
            hasCenteredRef.current = false;
        }
    }, [nodes.length, selectedCompanyId]);

    const mapDeviceType = (d) => {
        const t = (d.device_type || '').toLowerCase();
        if (AVAILABLE_ICONS.some(icon => icon.type === t)) return t;

        // Specific mappings
        if (t.includes('nas') || t.includes('storage') || t.includes('synology') || t.includes('qnap')) return 'nas';
        if (t.includes('virt') || t.includes('vm') || t.includes('proxmox') || t.includes('esxi') || t.includes('hyper-v')) return 'virtualization';
        if (t.includes('firewall') || t.includes('gate') || t.includes('pfsense') || t.includes('opnsense') || t.includes('forti')) return 'firewall';
        if (t.includes('radio') || t.includes('antenna') || t.includes('bridge') || t.includes('nanostation') || t.includes('airmax')) return 'radio';
        if (t.includes('printer') || t.includes('stampante') || t.includes('mfp')) return 'printer';
        if (t.includes('server')) return 'server';
        if (t.includes('wifi') || t.includes('access point') || t.includes('ap') || t.includes('unifi')) return 'wifi';
        if (t.includes('switch')) return 'switch';
        if (t.includes('camera') || t.includes('cctv') || t.includes('cam') || t.includes('dahua') || t.includes('hikvision')) return 'camera';
        if (t.includes('speaker') || t.includes('audio') || t.includes('sonos') || t.includes('alexa') || t.includes('google home')) return 'speaker';
        if (t.includes('phone') || t.includes('voip') || t.includes('sip') || t.includes('yealink')) return 'phone';
        if (t.includes('tv') || t.includes('television') || t.includes('screen') || t.includes('chromecast')) return 'tv';
        if (t.includes('watch') || t.includes('wearable') || t.includes('apple watch')) return 'wearable';
        if (t.includes('tablet') || t.includes('ipad')) return 'tablet';
        if (t.includes('mobile') || t.includes('smartphone') || t.includes('iphone') || t.includes('android')) return 'smartphone';
        if (t.includes('laptop') || t.includes('notebook') || t.includes('macbook')) return 'laptop';
        if (t.includes('unmanaged_switch')) return 'unmanaged_switch';
        if (t === 'generic' || t.includes('altro') || t.includes('generic')) return 'generic';

        return 'pc';
    };

    const drawIcon = (type) => {
        const IconDef = AVAILABLE_ICONS.find(i => i.type === type);
        const Icon = IconDef ? IconDef.icon : Monitor;

        if (type === 'switch' || type === 'unmanaged_switch') {
            return <Server size={20} className="text-white bg-gray-600 rounded-sm p-0.5" />;
        }
        if (type === 'generic') {
            return <Circle size={16} className="text-white fill-current" />;
        }
        return <Icon size={20} className="text-white" strokeWidth={1.5} />;
    };

    // Funzione per centrare e zoomare automaticamente sui nodi
    const centerAndZoomToNodes = (nodeList) => {
        if (!nodeList || nodeList.length === 0) return;

        // Calcola i bounds (limiti) di tutti i nodi
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodeList.forEach(node => {
            const x = node.x || 0;
            const y = node.y || 0;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });

        // Se tutti i nodi sono nello stesso punto, usa un'area minima
        if (minX === maxX && minY === maxY) {
            minX -= 100;
            maxX += 100;
            minY -= 100;
            maxY += 100;
        }

        // Calcola il centro dei nodi
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Calcola le dimensioni del bounding box
        const width = maxX - minX;
        const height = maxY - minY;

        // Aggiungi padding (20% su ogni lato)
        const padding = Math.max(width, height) * 0.2;
        const paddedWidth = width + padding * 2;
        const paddedHeight = height + padding * 2;

        // Calcola lo zoom necessario per mostrare tutti i nodi
        const containerWidth = canvasContainerRef.current?.clientWidth || window.innerWidth;
        const containerHeight = canvasContainerRef.current?.clientHeight || window.innerHeight;

        const scaleX = containerWidth / paddedWidth;
        const scaleY = containerHeight / paddedHeight;
        const newScale = Math.min(scaleX, scaleY, 2); // Limita zoom max a 2x

        // Calcola l'offset per centrare
        const newOffsetX = containerWidth / 2 - centerX * newScale;
        const newOffsetY = containerHeight / 2 - centerY * newScale;

        // Applica la trasformazione
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const ensureSimulation = (nodeList, linkList = [], shouldAutoCenter = false) => {
        if (simulationRef.current) simulationRef.current.stop();
        if (!nodeList || nodeList.length === 0) {
            simulationRef.current = null;
            return;
        }
        const sim = d3.forceSimulation(nodeList)
            .velocityDecay(0.6) // Aumenta attrito per rendere nodi meno "molleggianti"
            .force('charge', d3.forceManyBody().strength(-400))
            .force('collide', d3.forceCollide().radius(50))
            .on('tick', () => setNodes([...sim.nodes()]));
        if (linkList && linkList.length > 0) {
            sim.force('link', d3.forceLink(linkList).id(d => d.id).distance(80));
        }

        // Se richiesto, centra automaticamente quando la simulazione si stabilizza
        if (shouldAutoCenter) {
            sim.on('end', () => {
                // Aspetta un frame per assicurarsi che i nodi siano aggiornati
                setTimeout(() => {
                    centerAndZoomToNodes(nodeList);
                }, 100);
            });
        }

        simulationRef.current = sim;
    };

    const addNodeFromDevice = async (d) => {
        const exists = nodes.some(n => n.id === d.id);
        if (exists) {
            setSelectedNode(nodes.find(n => n.id === d.id));
            return;
        }
        const aziendaId = parseAziendaId(selectedCompanyId);
        if (!aziendaId) return;
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes`), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: d.id, x: 0, y: 0 })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Errore aggiunta alla mappa');
                return;
            }
        } catch (e) {
            alert('Errore: ' + e.message);
            return;
        }
        const newNode = {
            id: d.id,
            type: mapDeviceType(d),
            label: (d.notes || d.hostname || '').trim() || d.ip_address,
            ip: d.ip_address,
            status: d.status,
            details: d,
            x: 0,
            y: 0
        };
        const next = [...nodes, newNode];
        setNodes(next);
        // Se è il primo nodo o ci sono pochi nodi, centra automaticamente
        ensureSimulation(next, links, next.length <= 3);
        setSelectedNode(newNode);
    };

    const associateChildToParent = async (parentNode, childDevice) => {
        if (parentNode.id === childDevice.id) return;
        const childExists = nodes.some(n => n.id === childDevice.id);
        let childNode = nodes.find(n => n.id === childDevice.id);
        if (!childNode) {
            const aziendaId = parseAziendaId(selectedCompanyId);
            if (aziendaId) {
                try {
                    const addRes = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes`), {
                        method: 'POST',
                        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ device_id: childDevice.id, x: (parentNode.x || 0) + 80, y: parentNode.y || 0 })
                    });
                    if (!addRes.ok) {
                        const err = await addRes.json().catch(() => ({}));
                        console.error('❌ POST mappatura-nodes (associa figlio):', addRes.status, err);
                        alert(err.error || 'Errore aggiunta alla mappa');
                        return;
                    }
                } catch (e) { console.error('Errore POST mappatura-nodes:', e); alert('Errore: ' + e.message); return; }
            }
            childNode = {
                id: childDevice.id,
                type: mapDeviceType(childDevice),
                label: (childDevice.notes || childDevice.hostname || '').trim() || childDevice.ip_address,
                ip: childDevice.ip_address,
                status: childDevice.status,
                details: childDevice,
                x: (parentNode.x || 0) + 80,
                y: parentNode.y || 0
            };
        }
        const newLink = { source: parentNode.id, target: childNode.id };
        const nextNodes = childExists ? nodes : [...nodes, childNode];
        const nextLinks = links
            .filter(l => (l.target?.id ?? l.target) !== childNode.id)
            .concat([newLink]);
        setNodes(nextNodes);
        setLinks(nextLinks);
        ensureSimulation(nextNodes, nextLinks);

        const parentIp = (parentNode.ip || parentNode.details?.ip_address || '').toString().trim();
        const aziendaIdSetParent = parseAziendaId(selectedCompanyId);
        if (parentIp && aziendaIdSetParent) {
            try {
                await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaIdSetParent}/set-parent/${childDevice.id}`), {
                    method: 'PUT',
                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentIp })
                });
            } catch (e) { console.error('Errore set-parent:', e); }
        }
    };

    useEffect(() => {
        if (!hoveredDevice) {
            setTooltipRect(null);
            return;
        }
        const el = hoveredRowRef.current;
        if (!el) return;
        const measure = () => setTooltipRect(el.getBoundingClientRect());
        measure();
        const scrollParent = el.closest('.overflow-y-auto');
        scrollParent?.addEventListener('scroll', measure);
        window.addEventListener('resize', measure);
        return () => {
            scrollParent?.removeEventListener('scroll', measure);
            window.removeEventListener('resize', measure);
        };
    }, [hoveredDevice]);

    useEffect(() => {
        if (!selectedCompanyId) {
            prevCompanyIdRef.current = null;
            setNodes([]);
            setLinks([]);
        }
    }, [selectedCompanyId]);

    const saveLayoutRef = useRef(null);
    useEffect(() => {
        saveLayoutRef.current = () => {
            const cid = parseAziendaId(selectedCompanyIdRef.current);
            if (!cid) return;
            const sim = simulationRef.current;
            const list = sim ? sim.nodes() : [];
            if (list.length === 0) return;
            try {
                const payload = list.map(n => ({ id: n.id, x: n.x, y: n.y }));
                fetch(buildApiUrl(`/api/network-monitoring/clients/${cid}/mappatura-nodes/layout`), {
                    method: 'PUT',
                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes: payload }),
                    keepalive: true
                }).then(r => { if (!r.ok) console.error('❌ Mappatura PUT layout fallito:', r.status); }).catch(e => console.error('❌ Mappatura PUT layout:', e));
            } catch (e) { console.error('❌ Mappatura PUT layout:', e); }
        };
    });

    useEffect(() => {
        const onUnload = () => { saveLayoutRef.current?.(); };
        window.addEventListener('beforeunload', onUnload);
        return () => window.removeEventListener('beforeunload', onUnload);
    }, []);

    useEffect(() => {
        return () => { if (simulationRef.current) simulationRef.current.stop(); };
    }, []);

    useEffect(() => {
        const prev = { body: document.body.style.overflow, html: document.documentElement.style.overflow };
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev.body;
            document.documentElement.style.overflow = prev.html;
        };
    }, []);

    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el) return;
        const h = (e) => { e.preventDefault(); e.stopPropagation(); setScale(s => Math.min(Math.max(0.1, s - e.deltaY * 0.001), 4)); };
        el.addEventListener('wheel', h, { passive: false });
        return () => el.removeEventListener('wheel', h);
    }, []);

    useEffect(() => { offsetRef.current = offset; }, [offset]);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

    const handleAddVirtualNode = async () => {
        const aziendaId = parseAziendaId(selectedCompanyId);
        if (!aziendaId) { alert('Seleziona prima un\'azienda'); return; }
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/manual-device`), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Switch Virtuale', device_type: 'unmanaged_switch', parent_id: selectedNode ? (selectedNode._realId || selectedNode.id) : null })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { alert(data.error || 'Errore'); return; }
            setRefreshDevicesKey(k => k + 1);
            if (data.device) await addNodeFromDevice(data.device);
        } catch (e) { alert('Errore: ' + e.message); }
    };

    const handleRefreshLayout = () => {
        if (nodes.length === 0) return;
        ensureSimulation(nodes, links, true);
        if (simulationRef.current) simulationRef.current.alpha(1).restart();
        saveLayoutRef.current?.();
    };

    const handleRemoveFromMap = async (node) => {
        if (!node) return;
        const id = node.id;
        const isVirtual = (node.details?.device_type || '').toLowerCase().includes('unmanaged');
        const aziendaId = parseAziendaId(selectedCompanyId);
        if (aziendaId) {
            try {
                if (isVirtual) {
                    const delRes = await fetch(buildApiUrl(`/api/network-monitoring/devices/${id}`), {
                        method: 'DELETE',
                        headers: getAuthHeader()
                    });
                    if (!delRes.ok) {
                        const err = await delRes.json().catch(() => ({}));
                        alert(err.error || 'Errore eliminazione switch virtuale');
                        return;
                    }
                    setRefreshDevicesKey(k => k + 1);
                } else {
                    const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes/${id}`), {
                        method: 'DELETE',
                        headers: getAuthHeader()
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error || 'Errore rimozione dalla mappa');
                        return;
                    }
                }
            } catch (e) {
                alert('Errore: ' + e.message);
                return;
            }
        }
        const nextNodes = nodes.filter(n => n.id !== id);
        const nextLinks = links.filter(l => (l.source?.id ?? l.source) !== id && (l.target?.id ?? l.target) !== id);
        setNodes(nextNodes);
        setLinks(nextLinks);
        setSelectedNode(null);
        ensureSimulation(nextNodes, nextLinks);
    };

    const handleNodeMouseDown = (e, node) => {
        e.stopPropagation();
        const sim = simulationRef.current;
        if (!sim) return;
        const onMove = (ev) => {
            const rect = canvasContainerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const o = offsetRef.current || { x: 0, y: 0 };
            const s = scaleRef.current ?? 1;
            const sx = (ev.clientX - rect.left - o.x) / s;
            const sy = (ev.clientY - rect.top - o.y) / s;
            node.fx = sx; node.fy = sy; node.x = sx; node.y = sy;
            sim.alpha(0.3).restart();
        };
        const onUp = () => {
            node.fx = null; node.fy = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            saveLayoutRef.current?.();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const handleCanvasMouseDown = (e) => { setIsDraggingCanvas(true); setLastMousePos({ x: e.clientX, y: e.clientY }); };
    const handleCanvasMouseMove = (e) => {
        if (isDraggingCanvas) {
            const dx = e.clientX - lastMousePos.x, dy = e.clientY - lastMousePos.y;
            setOffset(p => ({ x: p.x + dx, y: p.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };
    const handleCanvasMouseUp = () => setIsDraggingCanvas(false);

    const nodeIdsOnMap = new Set(nodes.map(n => n.id));
    const ipToSortKey = (ip) => {
        if (!ip || typeof ip !== 'string') return [999, 999, 999, 999];
        const s = ip.trim().replace(/[{}"]/g, '');
        const parts = s.split('.');
        if (parts.length !== 4) return [999, 999, 999, 999];
        return parts.map(p => {
            const n = parseInt(p, 10);
            return isNaN(n) ? 999 : Math.max(0, Math.min(255, n));
        });
    };
    const ipList = (devices || [])
        .filter(d => d.ip_address && !nodeIdsOnMap.has(d.id))
        .sort((a, b) => {
            const ka = ipToSortKey(a.ip_address);
            const kb = ipToSortKey(b.ip_address);
            for (let i = 0; i < 4; i++) {
                if (ka[i] !== kb[i]) return ka[i] - kb[i];
            }
            return (a.ip_address || '').localeCompare(b.ip_address || '');
        });

    const getNodeColor = (node) => {
        if (node.type === 'router') return 'bg-indigo-500 border-indigo-700';
        if (node.status === 'offline') return 'bg-red-500 border-red-700';
        if (node.status === 'warning') return 'bg-orange-500 border-orange-700';
        return 'bg-green-500 border-green-700';
    };

    return (
        <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => { saveLayoutRef.current?.(); onClose(); }} className="p-2 hover:bg-gray-100 rounded-full" title="Chiudi Mappatura">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Mappatura</h1>
                        <p className="text-sm text-gray-600">Mappa manuale senza SNMP · IP individuati</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">Seleziona Azienda...</option>
                        {companies.filter(c => c.id != null).map(c => <option key={c.id} value={String(c.id)}>{c.azienda}</option>)}
                    </select>

                    {/* Pulsante Monitoraggio */}
                    {onNavigateToMonitoring && (
                        <button
                            onClick={() => {
                                const companyId = selectedCompanyId ? parseInt(selectedCompanyId) : null;
                                onNavigateToMonitoring(companyId);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            title="Vai al Monitoraggio Rete"
                        >
                            <List size={18} />
                            Monitoraggio
                        </button>
                    )}

                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button className="p-1.5 hover:bg-white rounded transition" onClick={() => setScale(s => Math.min(s + 0.1, 4))}><ZoomIn size={18} className="text-gray-600" /></button>
                        <button className="p-1.5 hover:bg-white rounded transition ml-1" onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}><ZoomOut size={18} className="text-gray-600" /></button>
                        <button className="p-1.5 hover:bg-white rounded transition ml-1" onClick={() => { setScale(1); setOffset({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); }} title="Reset Zoom"><Maximize size={18} className="text-gray-600" /></button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* Left: toolbar + IP list */}
                {selectedCompanyId && (
                    <div className="w-64 shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
                        <div className="p-3 flex flex-col gap-2 border-b border-gray-100 shrink-0">
                            <button
                                className="bg-white p-2 rounded-lg shadow border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2"
                                title="Aggiungi Switch Unmanaged"
                                onClick={handleAddVirtualNode}
                            >
                                <Server size={20} className="text-blue-600" />
                                <span className="text-sm font-medium">Aggiungi Switch Unmanaged</span>
                            </button>
                            <button
                                className="bg-white p-2 rounded-lg shadow border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2"
                                title="Aggiorna Layout"
                                onClick={handleRefreshLayout}
                            >
                                <RotateCw size={20} className="text-gray-600" />
                                <span className="text-sm font-medium">Aggiorna Layout</span>
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            <h4 className="px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-100 shrink-0" title="Clicca per i dati a destra · Trascina in mappa per aggiungere · Trascina su un pallino per associare come figlio">IP presenti e individuati</h4>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loading && <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Loader size={14} className="animate-spin" /> Caricamento…</div>}
                                {!loading && ipList.length === 0 && (
                                    <p className="text-sm text-gray-400 py-2">
                                        {devices.some(d => d.ip_address) ? 'Tutti in mappa. Elimina un nodo per far riapparire l’IP.' : 'Nessun IP.'}
                                    </p>
                                )}
                                {!loading && ipList.map(d => {
                                    const sel = selectedNode?.id === d.id || selectedDevice?.id === d.id;
                                    return (
                                        <div
                                            key={d.id}
                                            ref={hoveredDevice?.id === d.id ? hoveredRowRef : undefined}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/json', JSON.stringify({ deviceId: d.id, device: d }));
                                                e.dataTransfer.effectAllowed = 'copy';
                                            }}
                                            onMouseEnter={() => setHoveredDevice(d)}
                                            onMouseLeave={() => setHoveredDevice(null)}
                                            onClick={() => {
                                                setSelectedDevice(d);
                                                setSelectedNode(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-mono truncate border transition cursor-grab active:cursor-grabbing ${sel ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                        >
                                            {d.ip_address}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas */}
                <div
                    ref={canvasContainerRef}
                    className="flex-1 min-h-0 bg-gray-100 relative overflow-hidden cursor-move touch-none"
                    onClick={() => {
                        if (justDroppedRef.current) {
                            justDroppedRef.current = false;
                            return;
                        }
                        setSelectedNode(null);
                        setSelectedDevice(null);
                        setReassociateChildNode(null);
                    }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                    onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        justDroppedRef.current = true;
                        try {
                            const raw = e.dataTransfer.getData('application/json');
                            if (!raw) return;
                            const { device } = JSON.parse(raw);
                            if (device) await addNodeFromDevice(device);
                            setSelectedDevice(null);
                        } catch (_) { }
                    }}
                    style={{ cursor: isDraggingCanvas ? 'grabbing' : 'grab' }}
                >
                    <div
                        className="absolute -inset-[500%] pointer-events-none opacity-10"
                        style={{ backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)', backgroundSize: `${20 * scale}px ${20 * scale}px`, backgroundPosition: `${offset.x}px ${offset.y}px` }}
                    />
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm pointer-events-none">
                            <Loader className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-3 font-medium text-gray-700">Caricamento…</span>
                        </div>
                    )}
                    {!selectedCompanyId && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white p-6 rounded-lg shadow-lg text-center border border-gray-200">
                                <Server size={48} className="mx-auto text-gray-300 mb-2" />
                                <h3 className="text-lg font-bold text-gray-700">Seleziona un'azienda</h3>
                                <p className="text-gray-500 text-sm">Usa il menu in alto per avviare la mappatura.</p>
                            </div>
                        </div>
                    )}
                    {selectedCompanyId && !loading && nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-xl border border-gray-200 shadow-lg text-center">
                                <p className="text-gray-600 font-medium">Mappa vuota</p>
                                <p className="text-gray-500 text-sm mt-1">Trascina un IP dalla lista qui per aggiungerlo. Trascina un IP su un pallino per associarlo come figlio. Clicca un IP per vedere i dati a destra.</p>
                            </div>
                        </div>
                    )}
                    <div
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
                    >
                        <svg className="overflow-visible absolute top-0 left-0 w-full h-full pointer-events-none">
                            {links.map((link, i) => {
                                const src = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
                                const tgt = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
                                if (!src || !tgt) return null;
                                return <line key={`link-${i}`} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="#94a3b8" strokeWidth="2" />;
                            })}
                        </svg>
                        {nodes.map(node => (
                            <div
                                key={node.id}
                                className="absolute flex flex-col items-center justify-center pointer-events-auto"
                                style={{
                                    left: node.x, top: node.y, transform: 'translate(-50%, -50%)',
                                    width: 48, height: 48,
                                    cursor: 'pointer', zIndex: selectedNode?.id === node.id ? 50 : 10
                                }}
                                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (reassociateChildNode) {
                                        if (node.id === reassociateChildNode.id) return;
                                        associateChildToParent(node, reassociateChildNode.details || reassociateChildNode);
                                        setReassociateChildNode(null);
                                        setSelectedNode(reassociateChildNode);
                                        setSelectedDevice(null);
                                        return;
                                    }
                                    setSelectedNode(node);
                                    setSelectedDevice(null);
                                }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                        const raw = e.dataTransfer.getData('application/json');
                                        if (!raw) return;
                                        const { device } = JSON.parse(raw);
                                        if (device) associateChildToParent(node, device);
                                    } catch (_) { }
                                }}
                            >
                                <div className={`w-full h-full rounded-full flex items-center justify-center shadow-lg border-2 ${getNodeColor(node)} ${selectedNode?.id === node.id ? 'ring-4 ring-blue-300' : ''} hover:scale-110 transition-transform`}>
                                    {drawIcon(node.type)}
                                </div>
                                <div className="absolute top-full mt-2 bg-white/90 px-2 py-0.5 rounded text-[10px] font-medium shadow text-gray-700 whitespace-nowrap border border-gray-200 pointer-events-none">
                                    {node.label || node.ip}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right panel */}
                {(selectedNode || selectedDevice) && (() => {
                    const isNode = !!selectedNode;
                    const display = isNode ? selectedNode : {
                        id: selectedDevice.id,
                        label: (selectedDevice.notes || selectedDevice.hostname || '').trim() || selectedDevice.ip_address,
                        ip: selectedDevice.ip_address,
                        status: selectedDevice.status,
                        details: selectedDevice
                    };
                    const onMap = nodes.some(n => n.id === display.id);
                    const nodeForPanel = isNode ? selectedNode : (onMap ? nodes.find(n => n.id === display.id) : null);
                    return (
                        <div className="w-80 shrink-0 bg-white shadow-xl border-l border-gray-200 p-4 flex flex-col animate-slideInRight z-50">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-800 break-all">{display.label || display.ip}</h3>
                                <button onClick={() => { setSelectedNode(null); setSelectedDevice(null); setReassociateChildNode(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>
                            {reassociateChildNode && (
                                <div className="mb-3 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                    Clicca il nuovo padre sulla mappa.
                                </div>
                            )}
                            <div className="space-y-3 text-sm">
                                <div className="flex flex-col gap-1 border-b pb-2">
                                    <label className="text-gray-500 text-xs font-medium">Nome (al posto dell'IP in mappa)</label>
                                    <input
                                        type="text"
                                        placeholder="Es. Router ufficio, PC reception…"
                                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={display.details?.notes ?? display.details?.hostname ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (isNode && selectedNode) setSelectedNode(prev => prev ? { ...prev, details: { ...prev.details, notes: v } } : null);
                                            else if (selectedDevice) setSelectedDevice(prev => prev ? { ...prev, notes: v } : null);
                                        }}
                                        onBlur={async (e) => {
                                            const v = (e.target.value || '').trim();
                                            const nodeId = display?.id;
                                            if (!nodeId) return;
                                            try {
                                                const res = await fetch(buildApiUrl(`/api/network-monitoring/devices/${nodeId}/notes`), {
                                                    method: 'PATCH',
                                                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ notes: v })
                                                });
                                                if (res.ok && simulationRef.current && isNode) {
                                                    const simNodes = simulationRef.current.nodes();
                                                    const n = simNodes.find(x => x.id === nodeId);
                                                    if (n) n.label = v || n.ip;
                                                    setNodes([...simNodes]);
                                                }
                                            } catch (_) { }
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">IP</span>
                                    <span className="font-mono font-medium">{display.ip}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Status</span>
                                    <span className={`font-bold ${display.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>{display.status?.toUpperCase() || 'N/A'}</span>
                                </div>

                                <div className="border-b pb-3">
                                    <label className="text-xs font-medium text-gray-500 mb-2 block">Icona da visualizzare</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {AVAILABLE_ICONS.map((iconItem) => {
                                            const IconComp = iconItem.icon;
                                            const isSelected = display.type === iconItem.type || (display.details?.device_type === iconItem.type);
                                            return (
                                                <button
                                                    key={iconItem.type}
                                                    onClick={async () => {
                                                        const newType = iconItem.type;
                                                        // Ottimistic update
                                                        if (isNode && selectedNode) setSelectedNode(prev => prev ? { ...prev, type: newType, details: { ...prev.details, device_type: newType } } : null);
                                                        else if (selectedDevice) setSelectedDevice(prev => prev ? { ...prev, device_type: newType } : null);

                                                        // Update simulation nodes immediately
                                                        if (simulationRef.current) {
                                                            const simNodes = simulationRef.current.nodes();
                                                            const n = simNodes.find(x => x.id === display.id);
                                                            if (n) {
                                                                n.type = newType;
                                                                // Force refresh
                                                                setNodes([...simNodes]);
                                                            }
                                                        }

                                                        // API call
                                                        try {
                                                            await fetch(buildApiUrl(`/api/network-monitoring/devices/${display.id}/type`), {
                                                                method: 'PATCH',
                                                                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ device_type: newType })
                                                            });
                                                        } catch (e) { console.error('Error updating type', e); }
                                                    }}
                                                    className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 text-blue-700' : 'bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                                                    title={iconItem.label}
                                                >
                                                    <IconComp size={18} strokeWidth={1.5} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {onMap && nodeForPanel && (
                                    <div className="pt-3 border-t border-gray-100 space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => setReassociateChildNode(reassociateChildNode?.id === nodeForPanel.id ? null : nodeForPanel)}
                                            className={`w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${reassociateChildNode?.id === nodeForPanel.id ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'}`}
                                        >
                                            <Link2 size={16} />
                                            {reassociateChildNode?.id === nodeForPanel.id ? 'Annulla · Clicca il nuovo padre' : '+ Associa'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFromMap(nodeForPanel)}
                                            className="w-full py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <Trash2 size={16} />
                                            Elimina dalla mappa
                                        </button>
                                        <p className="text-xs text-gray-400 mt-1.5 text-center">L'IP tornerà nella lista a sinistra.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {hoveredDevice && tooltipRect && createPortal(
                    <div
                        className="fixed z-[200] w-64 py-2 px-3 bg-white border border-gray-200 rounded-lg shadow-lg text-sm"
                        style={{ left: tooltipRect.right + 8, top: tooltipRect.top }}
                    >
                        <div className="font-semibold text-gray-700 mb-1">Titolo</div>
                        <div className="text-gray-800 mb-2">{hoveredDevice.device_type || '-'}</div>
                        <div className="font-semibold text-gray-700 mb-1">Utente</div>
                        <div className="text-gray-800 mb-2">{hoveredDevice.device_username || '-'}</div>
                        <div className="font-semibold text-gray-700 mb-1">Percorso</div>
                        <div className="text-gray-800">{hoveredDevice.device_path || '-'}</div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};

export default MappaturaPage;
