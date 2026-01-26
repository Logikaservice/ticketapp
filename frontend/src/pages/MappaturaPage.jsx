import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, ZoomIn, ZoomOut, Maximize, Loader, Server, RotateCw,
    Monitor, Printer, Wifi, Router, X
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import * as d3 from 'd3-force';

const MappaturaPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId || '');
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [refreshDevicesKey, setRefreshDevicesKey] = useState(0);
    const simulationRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const offsetRef = useRef(offset);
    const scaleRef = useRef(scale);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch(buildApiUrl('/api/network-monitoring/clients'), { headers: getAuthHeader() });
                if (res.ok) {
                    const data = await res.json();
                    setCompanies(data);
                    if (!selectedCompanyId && data.length > 0) setSelectedCompanyId(data[0].id);
                }
            } catch (e) { console.error('Errore fetch aziende:', e); }
        };
        fetchCompanies();
    }, []);

    useEffect(() => {
        if (!selectedCompanyId) return;
        setLoading(true);
        const fetchDevices = async () => {
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/devices`), { headers: getAuthHeader() });
                if (res.ok) setDevices(await res.json());
            } catch (e) { console.error('Errore fetch dispositivi:', e); }
            finally { setLoading(false); }
        };
        fetchDevices();
    }, [selectedCompanyId, refreshDevicesKey]);

    const mapDeviceType = (d) => {
        const t = (d.device_type || '').toLowerCase();
        if (t.includes('printer') || t.includes('stampante')) return 'printer';
        if (t.includes('server') || t.includes('nas')) return 'server';
        if (t.includes('wifi') || t.includes('access point') || t.includes('ap')) return 'wifi';
        if (t.includes('switch')) return 'unmanaged_switch';
        return 'pc';
    };

    const initForceLayout = () => {
        if (simulationRef.current) simulationRef.current.stop();
        const valid = (devices || []).filter(d => d.ip_address);
        const routerNode = { id: 'router', type: 'router', label: 'Gateway (Fittizio)', status: 'online', x: 0, y: 0, fx: 0, fy: 0, details: { role: 'Gateway Placeholder' } };
        const deviceNodes = valid.map(d => ({
            id: d.id,
            type: mapDeviceType(d),
            label: (d.notes || d.hostname || '').trim() || d.ip_address,
            ip: d.ip_address,
            status: d.status,
            details: d,
            x: Math.random() * 200 - 100,
            y: Math.random() * 200 - 100
        }));
        const initialNodes = [routerNode, ...deviceNodes];
        const initialLinks = deviceNodes.map(n => {
            const pid = n.details?.parent_device_id;
            if (pid) {
                const par = deviceNodes.find(x => x.id === pid);
                if (par) return { source: par.id, target: n.id };
            }
            return { source: 'router', target: n.id };
        });

        setNodes(initialNodes);
        setLinks(initialLinks);

        const sim = d3.forceSimulation(initialNodes)
            .force('link', d3.forceLink(initialLinks).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('collide', d3.forceCollide().radius(60))
            .on('tick', () => setNodes([...sim.nodes()]));
        simulationRef.current = sim;
    };

    useEffect(() => {
        if (!selectedCompanyId) return;
        initForceLayout();
    }, [selectedCompanyId, devices]);

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
        if (!selectedCompanyId) { alert('Seleziona prima un\'azienda'); return; }
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/manual-device`), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Switch Virtuale', device_type: 'unmanaged_switch', parent_id: selectedNode ? (selectedNode._realId || selectedNode.id) : null })
            });
            if (res.ok) setRefreshDevicesKey(k => k + 1);
            else { const err = await res.json(); alert(err.error || 'Errore'); }
        } catch (e) { alert('Errore: ' + e.message); }
    };

    const handleRefreshLayout = () => {
        if (simulationRef.current) simulationRef.current.alpha(1).restart();
    };

    const handleNodeMouseDown = (e, node) => {
        e.stopPropagation();
        if (!simulationRef.current) return;
        const sim = simulationRef.current;
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

    const ipList = (devices || []).filter(d => d.ip_address).sort((a, b) => (a.ip_address || '').localeCompare(b.ip_address || ''));

    const drawIcon = (type) => {
        switch (type) {
            case 'router': return <Router size={24} className="text-white" />;
            case 'printer': return <Printer size={20} className="text-white" />;
            case 'server': return <Server size={20} className="text-white" />;
            case 'wifi': return <Wifi size={20} className="text-white" />;
            case 'unmanaged_switch': return <Server size={20} className="text-white bg-gray-600 rounded-sm p-0.5" />;
            default: return <Monitor size={20} className="text-white" />;
        }
    };

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
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" title="Chiudi Mappatura">
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
                        {companies.map(c => <option key={c.id} value={c.id}>{c.azienda}</option>)}
                    </select>
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
                            <h4 className="px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b border-gray-100 shrink-0">IP presenti e individuati</h4>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loading && <div className="flex items-center gap-2 text-gray-500 text-sm py-2"><Loader size={14} className="animate-spin" /> Caricamento…</div>}
                                {!loading && ipList.length === 0 && <p className="text-sm text-gray-400 py-2">Nessun IP.</p>}
                                {!loading && ipList.map(d => {
                                    const node = nodes.find(n => n.id === d.id);
                                    const name = (d.notes || d.hostname || '').trim() || d.ip_address;
                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => node && setSelectedNode(node)}
                                            disabled={!node}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-mono truncate border transition ${selectedNode?.id === d.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                            title={name}
                                        >
                                            {d.ip_address}
                                        </button>
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
                    onClick={() => setSelectedNode(null)}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
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
                    <div
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
                    >
                        <svg className="overflow-visible absolute top-0 left-0">
                            {links.map((link, i) => {
                                const src = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
                                const tgt = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
                                if (!src || !tgt) return null;
                                return <line key={`l-${i}`} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="#cbd5e1" strokeWidth="2" />;
                            })}
                        </svg>
                        {nodes.map(node => (
                            <div
                                key={node.id}
                                className="absolute flex flex-col items-center justify-center pointer-events-auto"
                                style={{
                                    left: node.x, top: node.y, transform: 'translate(-50%, -50%)',
                                    width: node.type === 'router' ? 60 : 48, height: node.type === 'router' ? 60 : 48,
                                    cursor: 'pointer', zIndex: selectedNode?.id === node.id ? 50 : 10
                                }}
                                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                                onClick={(e) => { e.stopPropagation(); if (node.id !== 'router') setSelectedNode(node); }}
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
                {selectedNode && selectedNode.id !== 'router' && (
                    <div className="w-80 shrink-0 bg-white shadow-xl border-l border-gray-200 p-4 flex flex-col animate-slideInRight z-50">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-800 break-all">{selectedNode.label || selectedNode.ip}</h3>
                            <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex flex-col gap-1 border-b pb-2">
                                <label className="text-gray-500 text-xs font-medium">Nome (al posto dell'IP in mappa)</label>
                                <input
                                    type="text"
                                    placeholder="Es. Router ufficio, PC reception…"
                                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedNode.details?.notes ?? selectedNode.details?.hostname ?? ''}
                                    onChange={(e) => setSelectedNode(prev => prev ? { ...prev, details: { ...prev.details, notes: e.target.value } } : null)}
                                    onBlur={async (e) => {
                                        const v = (e.target.value || '').trim();
                                        const nodeId = selectedNode?.id;
                                        if (!nodeId) return;
                                        try {
                                            const res = await fetch(buildApiUrl(`/api/network-monitoring/devices/${nodeId}/notes`), {
                                                method: 'PATCH',
                                                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ notes: v })
                                            });
                                            if (res.ok && simulationRef.current) {
                                                const simNodes = simulationRef.current.nodes();
                                                const n = simNodes.find(x => x.id === nodeId);
                                                if (n) n.label = v || n.ip;
                                                setNodes([...simNodes]);
                                            }
                                        } catch (_) {}
                                    }}
                                />
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">IP</span>
                                <span className="font-mono font-medium">{selectedNode.ip}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Status</span>
                                <span className={`font-bold ${selectedNode.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>{selectedNode.status?.toUpperCase() || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MappaturaPage;
