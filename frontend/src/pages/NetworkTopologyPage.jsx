import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Search, Filter, ZoomIn, ZoomOut, Loader,
    Server, Monitor, Printer, Wifi, Maximize, Router,
    AlertTriangle, CheckCircle, WifiOff, X
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const NetworkTopologyPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId || '');
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState([]);
    const canvasRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState(null);

    // Carica le aziende al mount
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await fetch(buildApiUrl('/api/network-monitoring/clients'), {
                    headers: getAuthHeader()
                });
                if (response.ok) {
                    const data = await response.json();
                    setCompanies(data);
                    // Se non c'è azienda selezionata, seleziona la prima
                    if (!selectedCompanyId && data.length > 0) {
                        setSelectedCompanyId(data[0].id);
                    }
                } else {
                    console.error("Errore fetch aziende:", response.status);
                }
            } catch (err) {
                console.error("Errore caricamento aziende:", err);
            }
        };
        fetchCompanies();
    }, []);

    // Carica i dispositivi quando cambia l'azienda selezionata
    useEffect(() => {
        if (!selectedCompanyId) return;

        const fetchDevices = async () => {
            setLoading(true);
            try {
                const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/devices`), {
                    headers: getAuthHeader()
                });

                if (response.ok) {
                    const data = await response.json();
                    setDevices(data);
                    generateTopology(data);
                }
            } catch (err) {
                console.error("Errore caricamento dispositivi:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDevices();
    }, [selectedCompanyId]);

    // Genera la topologia a "stella" (Router al centro, dispositivi attorno)
    const generateTopology = (deviceList) => {
        const centerX = 600;
        const centerY = 400;
        const radius = 300; // Raggio del cerchio

        // Nodo centrale (Router/Gateway)
        const routerNode = {
            id: 'router',
            type: 'router',
            x: centerX,
            y: centerY,
            label: 'Gateway / Agent',
            status: 'online',
            details: {
                ip: 'Gateway',
                role: 'Concentratore'
            }
        };

        // Filtra dispositivi validi (ignora quelli senza IP o status)
        const validDevices = deviceList.filter(d => d.ip_address);
        const count = validDevices.length;

        // Posiziona i dispositivi in cerchio
        const deviceNodes = validDevices.map((device, index) => {
            const angle = (index / count) * 2 * Math.PI; // Angolo in radianti

            // Calcola posizione X, Y sulla circonferenza
            // Aggiungiamo un po' di "jitter" (variazione casuale) al raggio per rendere il grafo meno artificiale
            const randomRadius = radius + (Math.random() * 100 - 50);

            return {
                id: device.id,
                type: mapDeviceType(device),
                x: centerX + randomRadius * Math.cos(angle),
                y: centerY + randomRadius * Math.sin(angle),
                label: device.hostname || device.ip_address,
                ip: device.ip_address,
                status: device.status,
                details: device
            };
        });

        setNodes([routerNode, ...deviceNodes]);
    };

    const mapDeviceType = (device) => {
        // Logica semplice per icona
        const type = (device.device_type || '').toLowerCase();
        if (type.includes('printer') || type.includes('stampante')) return 'printer';
        if (type.includes('server') || type.includes('nas')) return 'server';
        if (type.includes('wifi') || type.includes('access point') || type.includes('ap')) return 'wifi';
        return 'pc'; // Default
    };

    // Gestione Zoom e Pan
    const handleWheel = (e) => {
        e.preventDefault();
        const newScale = Math.min(Math.max(0.1, scale - e.deltaY * 0.001), 3);
        setScale(newScale);
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const drawIcon = (type) => {
        switch (type) {
            case 'router': return <Router size={24} className="text-white" />;
            case 'printer': return <Printer size={20} className="text-white" />;
            case 'server': return <Server size={20} className="text-white" />;
            case 'wifi': return <Wifi size={20} className="text-white" />;
            default: return <Monitor size={20} className="text-white" />;
        }
    };

    const getNodeColor = (status) => {
        if (status === 'offline') return 'bg-red-500 border-red-700';
        if (status === 'warning') return 'bg-orange-500 border-orange-700';
        return 'bg-green-500 border-green-700';
    };

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="Chiudi Mappa"
                    >
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <AlertTriangle size={24} className="text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Mappa Topologica</h1>
                            <p className="text-sm text-gray-600">Visualizzazione grafica della rete</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">Seleziona Azienda...</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.azienda}</option>
                        ))}
                    </select>

                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            className="p-1.5 hover:bg-white rounded transition shadow-sm"
                            onClick={() => setScale(s => Math.min(s + 0.1, 3))}
                        >
                            <ZoomIn size={18} className="text-gray-600" />
                        </button>
                        <button
                            className="p-1.5 hover:bg-white rounded transition shadow-sm ml-1"
                            onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}
                        >
                            <ZoomOut size={18} className="text-gray-600" />
                        </button>
                        <button
                            className="p-1.5 hover:bg-white rounded transition shadow-sm ml-1"
                            onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
                            title="Reset Zoom"
                        >
                            <Maximize size={18} className="text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                className="flex-1 bg-gray-100 relative overflow-hidden cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm">
                        <Loader className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 font-medium text-gray-700">Generazione mappa in corso...</span>
                    </div>
                )}

                {/* Empty State: Nessuna azienda selezionata */}
                {!selectedCompanyId && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white p-6 rounded-lg shadow-lg text-center border border-gray-200 backdrop-blur-sm bg-opacity-90">
                            <Server size={48} className="mx-auto text-gray-300 mb-2" />
                            <h3 className="text-lg font-bold text-gray-700">Seleziona un'azienda</h3>
                            <p className="text-gray-500 text-sm">Scegli un'azienda dal menu in alto per visualizzare la mappa.</p>
                        </div>
                    </div>
                )}

                {/* Empty State: Nessun dispositivo trovato */}
                {selectedCompanyId && !loading && nodes.length <= 1 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white p-6 rounded-lg shadow-lg text-center border border-gray-200 backdrop-blur-sm bg-opacity-90">
                            <WifiOff size={48} className="mx-auto text-gray-300 mb-2" />
                            <h3 className="text-lg font-bold text-gray-700">Nessun dispositivo rilevato</h3>
                            <p className="text-gray-500 text-sm">Non ci sono dati di monitoraggio recenti per questa azienda.</p>
                        </div>
                    </div>
                )}

                {/* Layer del Grafo */}
                <div
                    className="absolute origin-top-left transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        width: '2000px', // Area virtuale grande
                        height: '2000px'
                    }}
                >
                    {/* Connessioni (Linee SVG) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {nodes.map(node => {
                            if (node.id === 'router') return null;
                            // Disegna linea dal Router centrale (nodes[0]) al nodo corrente
                            const center = nodes[0];
                            if (!center) return null;

                            return (
                                <line
                                    key={`line-${node.id}`}
                                    x1={center.x + 24} // +24 per centrare (metà 48px)
                                    y1={center.y + 24}
                                    x2={node.x + 20}   // +20 per centrare (metà 40px)
                                    y2={node.y + 20}
                                    stroke={node.status === 'offline' ? '#fee2e2' : '#e5e7eb'}
                                    strokeWidth="2"
                                />
                            );
                        })}
                    </svg>

                    {/* Nodi */}
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            className={`absolute flex flex-col items-center justify-center cursor-pointer group transition-all duration-300 ${selectedNode?.id === node.id ? 'scale-125 z-50' : 'hover:scale-110 z-10'}`}
                            style={{
                                left: node.x,
                                top: node.y,
                                width: node.type === 'router' ? '48px' : '40px',
                                height: node.type === 'router' ? '48px' : '40px'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNode(node);
                            }}
                        >
                            {/* Cerchio Icona */}
                            <div className={`w-full h-full rounded-full flex items-center justify-center shadow-md border-2 ${getNodeColor(node.status)}`}>
                                {drawIcon(node.type)}
                            </div>

                            {/* Etichetta */}
                            <div className="absolute top-full mt-2 bg-white/90 px-2 py-1 rounded text-[10px] font-medium shadow whitespace-nowrap border border-gray-200">
                                {node.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sidebar Dettagli (a comparsa) */}
            {selectedNode && (
                <div className="absolute top-20 right-4 w-80 bg-white shadow-xl rounded-lg border border-gray-200 p-4 animate-slideInRight z-50">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-gray-800 break-all">{selectedNode.label}</h3>
                        <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500">IP:</span>
                            <span className="font-mono font-medium">{selectedNode.ip || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500">Status:</span>
                            <span className={`font-bold ${selectedNode.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                                {selectedNode.status.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500">Tipo:</span>
                            <span className="capitalize">{selectedNode.type}</span>
                        </div>
                        {selectedNode.details?.vendor && (
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Vendor:</span>
                                <span>{selectedNode.details.vendor}</span>
                            </div>
                        )}
                        {selectedNode.details?.last_seen && (
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Ultimo contatto:</span>
                                <span className="text-xs">{new Date(selectedNode.details.last_seen).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkTopologyPage;
