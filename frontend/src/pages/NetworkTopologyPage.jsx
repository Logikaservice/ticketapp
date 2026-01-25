import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft, Search, Filter, ZoomIn, ZoomOut, Loader,
    Server, Monitor, Printer, Wifi, Maximize, Router,
    AlertTriangle, CheckCircle, WifiOff, X, Move
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import * as d3 from 'd3-force';
import { select } from 'd3-selection';
import { drag } from 'd3-drag';

const NetworkTopologyPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId || '');
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [virtualNodes, setVirtualNodes] = useState([]); // Nodi virtuali (Switch Unmanaged)
    const [isLinking, setIsLinking] = useState(false); // Modalità collegamento nodi
    const [linkingSource, setLinkingSource] = useState(null); // Nodo sorgente per il collegamento
    const canvasRef = useRef(null);
    const simulationRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState(null);
    const svgRef = useRef(null);

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
                    initForceLayout(data);
                }
            } catch (err) {
                console.error("Errore caricamento dispositivi:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDevices();
    }, [selectedCompanyId]);

    // Inizializza il layout Force-Directed
    const initForceLayout = (deviceList) => {
        if (simulationRef.current) simulationRef.current.stop();

        // 1. Crea i nodi
        // Nodo Router (Centro)
        const routerNode = {
            id: 'router',
            type: 'router',
            label: 'Gateway',
            status: 'online',
            x: 0,
            y: 0,
            fx: 0, // Fissa il router al centro inizialmente
            fy: 0,
            details: { role: 'Gateway' }
        };

        const validDevices = deviceList.filter(d => d.ip_address);
        const deviceNodes = validDevices.map(d => ({
            id: d.id,
            type: mapDeviceType(d),
            label: d.hostname || d.ip_address,
            ip: d.ip_address,
            status: d.status,
            details: d,
            x: Math.random() * 200 - 100, // Posizione iniziale casuale attorno al centro
            y: Math.random() * 200 - 100
        }));

        const initialNodes = [routerNode, ...deviceNodes];

        // 2. Crea i link (Tutti collegati al Router per default)
        // TODO: In futuro caricare le relazioni padre-figlio dal DB
        const initialLinks = deviceNodes.map(node => ({
            source: 'router',
            target: node.id
        }));

        setNodes(initialNodes);
        setLinks(initialLinks);

        // 3. Configura la simulazione D3
        const simulation = d3.forceSimulation(initialNodes)
            .force("link", d3.forceLink(initialLinks).id(d => d.id).distance(150)) // Distanza ideale dei link
            .force("charge", d3.forceManyBody().strength(-500)) // Repulsione tra nodi (negativo = respinge)
            .force("collide", d3.forceCollide().radius(60)) // Evita sovrapposizioni
            // Rimuoviamo forceCenter per permettere il panning libero, usiamo offset per centrare la vista
            .on("tick", () => {
                // Forza un re-render React ad ogni tick (o usa useRef per performance se troppi nodi)
                setNodes([...initialNodes]);
            });

        simulationRef.current = simulation;
    };

    // Pulisci simulazione all'unmount
    useEffect(() => {
        return () => {
            if (simulationRef.current) simulationRef.current.stop();
        };
    }, []);

    // Gestione Drag & Drop dei nodi (D3 integration)
    const handleNodeMouseDown = (e, node) => {
        e.stopPropagation();
        if (!simulationRef.current) return;

        const simulation = simulationRef.current;

        // Blocca il nodo durante il trascinamento
        const handleDrag = (event) => {
            // Converti coordinate mouse -> coordinate canvas (tenendo conto di scale e offset)
            // Nota: event.clientX è relativo alla finestra
            const canvasX = (event.clientX - offset.x) / scale;
            const canvasY = (event.clientY - offset.y) / scale;

            node.fx = canvasX;
            node.fy = canvasY;
            simulation.alpha(0.3).restart(); // Risveglia la simulazione
        };

        const handleDragEnd = () => {
            if (!event.active) simulation.alphaTarget(0);
            node.fx = null; // Rilascia il nodo (torna alla fisica)
            node.fy = null;
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);
        };

        window.addEventListener('mousemove', handleDrag);
        window.addEventListener('mouseup', handleDragEnd);
    };


    const mapDeviceType = (device) => {
        const type = (device.device_type || '').toLowerCase();
        if (type.includes('printer') || type.includes('stampante')) return 'printer';
        if (type.includes('server') || type.includes('nas')) return 'server';
        if (type.includes('wifi') || type.includes('access point') || type.includes('ap')) return 'wifi';
        return 'pc';
    };


    // Aggiungi un nodo virtuale (Switch Unmanaged)
    const handleAddVirtualNode = () => {
        if (!simulationRef.current) return;

        const newNodeId = `virtual-${Date.now()}`;
        const newNode = {
            id: newNodeId,
            type: 'unmanaged_switch',
            label: 'Switch Unmanaged',
            status: 'online', // Virtuale, sempre online o dipendente dai figli (futuro)
            x: -offset.x / scale + (window.innerWidth / 2) / scale, // Centro schermo visibile
            y: -offset.y / scale + (window.innerHeight / 2) / scale,
            details: { role: 'Switch' }
        };

        const newNodes = [...nodes, newNode];
        // Collega al router di default
        const newLinks = [...links, { source: 'router', target: newNodeId }];

        setNodes(newNodes);
        setLinks(newLinks);

        // Riavvia simulazione con nuovi dati
        // Nota: in D3 V4+ bisogna ri-assegnare nodes e links alla simulazione
        simulationRef.current.nodes(newNodes);
        simulationRef.current.force("link").links(newLinks);
        simulationRef.current.alpha(0.5).restart();
    };

    // Gestione inizio collegamento (Set Parent)
    const handleStartLinking = (node) => {
        setIsLinking(true);
        setLinkingSource(node);
    };

    // Completa collegamento (Cliccando sul nuovo genitore)
    const handleCompleteLinking = (targetNode) => {
        if (!linkingSource || !targetNode || linkingSource.id === targetNode.id) {
            setIsLinking(false);
            setLinkingSource(null);
            return;
        }

        // Aggiorna i link: rimuovi il vecchio link del source e aggiungi quello nuovo verso target
        const newLinks = links.filter(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            return sourceId !== linkingSource.id;
        });

        newLinks.push({ source: linkingSource.id, target: targetNode.id });

        setLinks(newLinks);

        // Aggiorna simulazione
        simulationRef.current.force("link").links(newLinks);
        simulationRef.current.alpha(0.3).restart();

        setIsLinking(false);
        setLinkingSource(null);
        // TODO: Salva su Backend (POST /api/network-topology/update)
    };


    // Canvas panning
    const handleCanvasMouseDown = (e) => {
        setIsDraggingCanvas(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleCanvasMouseMove = (e) => {
        if (isDraggingCanvas) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleCanvasMouseUp = () => {
        setIsDraggingCanvas(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const newScale = Math.min(Math.max(0.1, scale - e.deltaY * 0.001), 4);
        setScale(newScale);
    };

    const drawIcon = (type) => {
        switch (type) {
            case 'router': return <Router size={24} className="text-white" />;
            case 'printer': return <Printer size={20} className="text-white" />;
            case 'server': return <Server size={20} className="text-white" />;
            case 'wifi': return <Wifi size={20} className="text-white" />;
            case 'unmanaged_switch': return <ServerIcon size={20} className="text-white bg-gray-600 rounded-sm p-0.5" />; // Icona diversa per switch
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
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 w-full">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Chiudi Mappa">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <AlertTriangle size={24} className="text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Mappa Topologica</h1>
                            <p className="text-sm text-gray-600">Visualizzazione fisica (Force-Directed)</p>
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
                        <button className="p-1.5 hover:bg-white rounded transition shadow-sm" onClick={() => setScale(s => Math.min(s + 0.1, 4))}>
                            <ZoomIn size={18} className="text-gray-600" />
                        </button>
                        <button className="p-1.5 hover:bg-white rounded transition shadow-sm ml-1" onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}>
                            <ZoomOut size={18} className="text-gray-600" />
                        </button>
                        <button className="p-1.5 hover:bg-white rounded transition shadow-sm ml-1" onClick={() => { setScale(1); setOffset({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); }} title="Reset Zoom">
                            <Maximize size={18} className="text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Toolbar Strumenti (Modifica Topologia) */}
            {selectedCompanyId && (
                <div className="absolute top-20 left-6 flex flex-col gap-2 z-20">
                    <button
                        className="bg-white p-2 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
                        title="Aggiungi Switch Unmanaged (Virtuale)"
                        onClick={handleAddVirtualNode}
                    >
                        <Server size={20} className="text-blue-600" />
                    </button>
                </div>
            )}

            {/* Canvas Area Infinito */}
            <div
                className="flex-1 bg-gray-100 relative overflow-hidden cursor-move"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onWheel={handleWheel}
                style={{ cursor: isDraggingCanvas ? 'grabbing' : 'grab' }}
            >
                {/* Background Grid Pattern - Truly Infinite Feel */}
                <div className="absolute -inset-[500%] pointer-events-none opacity-10" // Grid espansa enormemente
                    style={{
                        backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)',
                        backgroundSize: `${20 * scale}px ${20 * scale}px`,
                        backgroundPosition: `${offset.x}px ${offset.y}px`
                    }}
                />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm pointer-events-none">
                        <Loader className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 font-medium text-gray-700">Calcolo layout in corso...</span>
                    </div>
                )}

                {/* Empty State */}
                {!selectedCompanyId && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white p-6 rounded-lg shadow-lg text-center border border-gray-200 backdrop-blur-sm bg-opacity-90">
                            <Server size={48} className="mx-auto text-gray-300 mb-2" />
                            <h3 className="text-lg font-bold text-gray-700">Seleziona un'azienda</h3>
                            <p className="text-gray-500 text-sm">Usa il menu in alto per visualizzare la topologia.</p>
                        </div>
                    </div>
                )}

                {/* Container Trasformabile (Zoom/Pan) */}
                <div
                    className="absolute top-0 left-0 w-full h-full pointer-events-none" // pointer-events-none per lasciare il controllo al parent per il pan
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        transformOrigin: '0 0'
                    }}
                >
                    {/* SVG Connector Layer */}
                    <svg className="overflow-visible absolute top-0 left-0">
                        {links.map((link, i) => {
                            // D3 converte source/target in riferimenti agli oggetti nodo dopo init
                            const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
                            const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
                            if (!source || !target) return null;

                            return (
                                <line
                                    key={`link-${i}`}
                                    x1={source.x}
                                    y1={source.y}
                                    x2={target.x}
                                    y2={target.y}
                                    stroke="#cbd5e1"
                                    strokeWidth="2"
                                />
                            );
                        })}
                    </svg>

                    {/* HTML Node Layer */}
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            className={`absolute flex flex-col items-center justify-center pointer-events-auto transition-shadow duration-300`}
                            style={{
                                left: node.x,
                                top: node.y,
                                transform: 'translate(-50%, -50%)', // Centra il div sulle coordinate x,y
                                width: node.type === 'router' ? '60px' : '48px',
                                height: node.type === 'router' ? '60px' : '48px',
                                cursor: 'pointer',
                                zIndex: selectedNode?.id === node.id ? 50 : 10
                            }}
                            onMouseDown={(e) => handleNodeMouseDown(e, node)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isLinking) {
                                    handleCompleteLinking(node);
                                } else {
                                    setSelectedNode(node);
                                }
                            }}
                        >
                            {/* Cerchio Icona */}
                            <div className={`w-full h-full rounded-full flex items-center justify-center shadow-lg border-2 ${getNodeColor(node.status)} ${selectedNode?.id === node.id ? 'ring-4 ring-blue-300' : ''} bg-white z-10 hover:scale-110 transition-transform`}>
                                {drawIcon(node.type)}
                            </div>

                            {/* Etichetta */}
                            <div className="absolute top-full mt-2 bg-white/90 px-2 py-0.5 rounded text-[10px] font-medium shadow text-gray-700 whitespace-nowrap border border-gray-200 pointer-events-none">
                                {node.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sidebar Dettagli */}
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
                        {selectedNode.details?.vendor && (
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-500">Vendor:</span>
                                <span>{selectedNode.details.vendor}</span>
                            </div>
                        )}
                        <div className="mt-4 pt-2 border-t border-gray-100">
                            <h4 className="font-bold text-gray-700 mb-2 text-xs uppercase">Azioni Topologia</h4>
                            <button
                                onClick={() => handleStartLinking(selectedNode)}
                                className={`w-full py-2 rounded-md font-medium text-xs flex items-center justify-center gap-2 mb-2 ${isLinking ? 'bg-orange-100 text-orange-700 animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                            >
                                <Move size={14} /> {isLinking ? 'Seleziona il NUOVO genitore...' : 'Cambia Genitore (Sposta)'}
                            </button>
                            {selectedNode.type === 'unmanaged_switch' && (
                                <div className="text-xs text-gray-500 italic text-center">
                                    Switch Virtuale creabile manualmente
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Banner Modalità Linking */}
            {isLinking && (
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-6 py-2 rounded-full shadow-lg z-50 animate-bounce cursor-pointer" onClick={() => setIsLinking(false)}>
                    <span className="font-bold">Modalità Collegamento:</span> Clicca sul nodo che deve diventare il PADRE di {linkingSource?.label}
                </div>
            )}
        </div>
    );
};

export default NetworkTopologyPage;
