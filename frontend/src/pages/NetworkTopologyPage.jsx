import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft, Search, Filter, ZoomIn, ZoomOut, Loader,
    Server, Server as ServerIcon, Monitor, Printer, Wifi, Maximize, Router,
    AlertTriangle, CheckCircle, WifiOff, X, Move, RotateCw, Link,
    Cable, Plus, Trash2, RefreshCw
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import * as d3 from 'd3-force';
import { select } from 'd3-selection';
import { drag } from 'd3-drag';

const formatIpWithPort = (ip, port) => !ip ? 'N/A' : (port != null && port !== '' && String(port).trim() !== '' ? `${ip} #${port}` : ip);

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
    const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
    const [associateIp, setAssociateIp] = useState('');
    const svgRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const [dragDropAssociate, setDragDropAssociate] = useState(null); // { childNode, parentNode } quando si rilascia un nodo su un altro
    const offsetRef = useRef(offset);
    const scaleRef = useRef(scale);
    // Dispositivi gestiti (switch SNMP) per topologia
    const [showManagedPanel, setShowManagedPanel] = useState(false);
    const [managedSwitches, setManagedSwitches] = useState([]);
    const [managedAdd, setManagedAdd] = useState({ ip: '', snmp_community: 'public', name: '' });
    const [syncLoadingId, setSyncLoadingId] = useState(null);
    const [refreshDevicesKey, setRefreshDevicesKey] = useState(0);

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
                }
            } catch (err) {
                console.error("Errore caricamento dispositivi:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDevices();
    }, [selectedCompanyId, refreshDevicesKey]);

    // Carica dispositivi gestiti (switch SNMP) per l'azienda
    useEffect(() => {
        if (!selectedCompanyId) { setManagedSwitches([]); return; }
        const fn = async () => {
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches`), { headers: getAuthHeader() });
                if (res.ok) setManagedSwitches(await res.json());
                else setManagedSwitches([]);
            } catch { setManagedSwitches([]); }
        };
        fn();
    }, [selectedCompanyId]);

    // Inizializza il layout Force-Directed (dispositivi + switch SNMP gestiti)
    const initForceLayout = (deviceList, managedSwitchesList = []) => {
        if (simulationRef.current) simulationRef.current.stop();

        const safeDevices = Array.isArray(deviceList) ? deviceList : [];
        const safeManaged = Array.isArray(managedSwitchesList) ? managedSwitchesList : [];
        const normIp = (s) => (String(s || '').replace(/[{}"]/g, '').trim().toLowerCase());
        const managedSwitchIps = new Set(safeManaged.map(m => normIp(m.ip)));
        const ipToManagedId = new Map(safeManaged.map(m => [normIp(m.ip), `managed_switch_${m.id}`]));

        // 1. Identifica se c'è un Gateway salvato
        const savedGateway = safeDevices.find(d => d.is_gateway);
        const gatewayId = savedGateway?.id;

        // Filtra dispositivi: con IP, escludi il network_device che ha lo stesso IP di uno switch gestito (mostriamo solo il nodo viola)
        const validDevices = safeDevices.filter(d => {
            if (!d.ip_address) return false;
            if (d.id === gatewayId) return true;
            return !managedSwitchIps.has(normIp(d.ip_address));
        });

        let initialNodes = [];
        let initialLinks = [];

        if (savedGateway) {
            // SCENARIO 1: Abbiamo un Gateway reale salvato

            // Il gateway diventa il centro (ID='router' per convenzione nostra interna o manteniamo ID originale?)
            // Manteniamo ID originale per consistenza con DB, ma lo trattiamo come centro.
            // O per semplicità visiva, assegniamo ID='router' al gateway salvato?
            // Seguiamo la logica: il nodo centrale ha sempre ID='router' per semplificare i link di default.

            const routerNode = {
                ...savedGateway,
                id: 'router', // ID fittizio per il frontend
                _realId: savedGateway.id, // ID reale per le chiamate API
                type: 'router',
                label: `${savedGateway.hostname || savedGateway.ip_address} (GW)`,
                status: savedGateway.status,
                x: 0,
                y: 0,
                fx: 0, fy: 0, // Fisso al centro
                details: savedGateway
            };

            const otherNodes = validDevices.filter(d => d.id !== savedGateway.id).map(d => ({
                id: d.id,
                type: mapDeviceType(d),
                label: d.hostname || formatIpWithPort(d.ip_address, d.port),
                ip: d.ip_address,
                status: d.status,
                details: d,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100
            }));

            // Nodi per switch SNMP gestiti (es. Netgear) — compaiono nella mappa
            const managedSwitchNodes = safeManaged.map(m => ({
                id: `managed_switch_${m.id}`,
                _realId: m.id,
                _isManagedSwitch: true,
                type: 'managed_switch',
                label: m.name || m.ip,
                ip: m.ip,
                status: 'online',
                details: m,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100
            }));

            initialNodes = [routerNode, ...otherNodes, ...managedSwitchNodes];

            // Collega tutti al gateway di default, ma rispetta parent_device_id. Se il parent è il
            // network_device dello switch (stesso IP di uno switch gestito, nodo escluso), collega al nodo viola.
            initialLinks = otherNodes.map(node => {
                if (node.details && node.details.parent_device_id) {
                    const parentExists = otherNodes.find(n => n.id === node.details.parent_device_id);
                    if (parentExists) {
                        return { source: parentExists.id, target: node.id };
                    }
                    if (node.details.parent_device_id === savedGateway.id) {
                        return { source: 'router', target: node.id };
                    }
                    const parent = safeDevices.find(d => d.id === node.details.parent_device_id);
                    if (parent && managedSwitchIps.has(normIp(parent.ip_address))) {
                        const mid = ipToManagedId.get(normIp(parent.ip_address));
                        if (mid) return { source: mid, target: node.id };
                    }
                }
                return { source: 'router', target: node.id };
            });
            // Collegamenti switch SNMP gestiti al gateway
            initialLinks = initialLinks.concat(managedSwitchNodes.map(m => ({ source: 'router', target: m.id })));

        } else {
            // SCENARIO 2: Nessun Gateway salvato, usa Placeholder
            const routerNode = {
                id: 'router',
                type: 'router',
                label: 'Gateway (Fittizio)',
                status: 'online',
                x: 0,
                y: 0,
                fx: 0, fy: 0,
                details: { role: 'Gateway Placeholder' }
            };

            const deviceNodes = validDevices.map(d => ({
                id: d.id,
                type: mapDeviceType(d),
                label: d.hostname || formatIpWithPort(d.ip_address, d.port),
                ip: d.ip_address,
                status: d.status,
                details: d,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100
            }));

            // Nodi per switch SNMP gestiti (es. Netgear) — compaiono nella mappa
            const managedSwitchNodes = safeManaged.map(m => ({
                id: `managed_switch_${m.id}`,
                _realId: m.id,
                _isManagedSwitch: true,
                type: 'managed_switch',
                label: m.name || m.ip,
                ip: m.ip,
                status: 'online',
                details: m,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100
            }));

            initialNodes = [routerNode, ...deviceNodes, ...managedSwitchNodes];
            initialLinks = deviceNodes.map(node => {
                if (node.details && node.details.parent_device_id) {
                    const parentExists = deviceNodes.find(n => n.id === node.details.parent_device_id);
                    if (parentExists) {
                        return { source: parentExists.id, target: node.id };
                    }
                    if (routerNode._realId && node.details.parent_device_id === routerNode._realId) {
                        return { source: 'router', target: node.id };
                    }
                    const parent = safeDevices.find(d => d.id === node.details.parent_device_id);
                    if (parent && managedSwitchIps.has(normIp(parent.ip_address))) {
                        const mid = ipToManagedId.get(normIp(parent.ip_address));
                        if (mid) return { source: mid, target: node.id };
                    }
                }
                return { source: 'router', target: node.id };
            });
            // Collegamenti switch SNMP gestiti al router
            initialLinks = initialLinks.concat(managedSwitchNodes.map(m => ({ source: 'router', target: m.id })));
        }

        setNodes(initialNodes);
        setLinks(initialLinks);

        // 3. Configura la simulazione D3
        const simulation = d3.forceSimulation(initialNodes)
            .force("link", d3.forceLink(initialLinks).id(d => d.id).distance(150)) // Distanza ideale dei link
            .force("charge", d3.forceManyBody().strength(-500)) // Repulsione tra nodi (negativo = respinge)
            .force("collide", d3.forceCollide().radius(60)) // Evita sovrapposizioni
            .on("tick", () => {
                setNodes([...simulation.nodes()]);
            });

        simulationRef.current = simulation;
    };

    // Costruisci/aggiorna il layout quando cambiano dispositivi o switch SNMP gestiti
    useEffect(() => {
        if (!selectedCompanyId) return;
        initForceLayout(devices, managedSwitches);
    }, [selectedCompanyId, devices, managedSwitches]);

    // Pulisci simulazione all'unmount
    useEffect(() => {
        return () => {
            if (simulationRef.current) simulationRef.current.stop();
        };
    }, []);

    // Blocca scroll della pagina: niente scrollbar né spazio bianco; solo pan/zoom nell'area mappa
    useEffect(() => {
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevBody;
            document.documentElement.style.overflow = prevHtml;
        };
    }, []);

    // Rotella solo per zoom: passive:false necessario per preventDefault (blocca scroll pagina)
    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el) return;
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setScale(s => Math.min(Math.max(0.1, s - e.deltaY * 0.001), 4));
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    useEffect(() => { offsetRef.current = offset; }, [offset]);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

    // Gestione Drag & Drop dei nodi (D3 integration)
    const handleNodeMouseDown = (e, node) => {
        e.stopPropagation();
        if (!simulationRef.current) return;

        const simulation = simulationRef.current;

        // Blocca il nodo durante il trascinamento — coordinate corrette: viewport → scena (canvas + pan + zoom)
        const handleDrag = (event) => {
            const rect = canvasContainerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const o = offsetRef.current || { x: 0, y: 0 };
            const s = scaleRef.current ?? 1;
            const sceneX = (event.clientX - rect.left - o.x) / s;
            const sceneY = (event.clientY - rect.top - o.y) / s;

            node.fx = sceneX;
            node.fy = sceneY;
            node.x = sceneX;
            node.y = sceneY;
            simulation.alpha(0.3).restart();
        };

        const handleDragEnd = (ev) => {
            node.fx = null;
            node.fy = null;
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);

            // Rilasciato sopra un altro nodo? Chiedi se associare (impostare come genitore)
            if (node.id === 'router') return;
            const rect = canvasContainerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const o = offsetRef.current || { x: 0, y: 0 };
            const s = scaleRef.current ?? 1;
            const sceneX = (ev.clientX - rect.left - o.x) / s;
            const sceneY = (ev.clientY - rect.top - o.y) / s;
            const simNodes = simulationRef.current?.nodes() || [];
            const R = 55; // raggio “sopra il pallino” in coordinate scena (nodo ≈ 24–30)
            const targetNode = simNodes.find(n => n.id !== node.id && Math.hypot(sceneX - n.x, sceneY - n.y) < R);
            if (targetNode) {
                setDragDropAssociate({ childNode: node, parentNode: targetNode });
            }
        };

        window.addEventListener('mousemove', handleDrag);
        window.addEventListener('mouseup', handleDragEnd);
    };


    const mapDeviceType = (device) => {
        const type = (device.device_type || '').toLowerCase();
        if (type.includes('printer') || type.includes('stampante')) return 'printer';
        if (type.includes('server') || type.includes('nas')) return 'server';
        if (type.includes('wifi') || type.includes('access point') || type.includes('ap')) return 'wifi';
        if (type.includes('switch')) return 'unmanaged_switch';
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
        simulationRef.current.alpha(0.5).restart();
    };

    // Refresh Layout (Ricalcola posizioni e centra)
    const handleRefreshLayout = () => {
        if (!simulationRef.current) return;

        // Risveglia la simulazione con "energia" alta in modo che i nodi si riposizionino
        simulationRef.current.alpha(1).restart();

        // Opzionale: Resetta anche zoom/pan se l'utente vuole un "reset totale"
        // setScale(1);
        // setOffset({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
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

    // Promuovi un nodo a Gateway (Eliminando il vecchio placeholder)
    const handlePromoteToGateway = async (nodeToPromote) => {
        if (!nodeToPromote || nodeToPromote.id === 'router') return;

        // 1. Ferma la simulazione attuale per evitare errori durante l'aggiornamento
        simulationRef.current.stop();

        // 2. Crea NUOVI array per nodi e link per garantire immutabilità e pulizia
        const newNodes = nodes
            .filter(n => n.id !== nodeToPromote.id && n.id !== 'router')
            .map(n => ({ ...n })); // Deep copy parziale (shallow copy dell'oggetto nodo)

        // 3. Crea il nuovo nodo router
        const promotedNode = {
            ...nodeToPromote,
            id: 'router',
            type: 'router',
            label: `${nodeToPromote.label} (GW)`,
            fx: 0, fy: 0,
            x: 0, y: 0,
            vx: 0, vy: 0 // Reset velocità
        };

        newNodes.push(promotedNode);

        // 4. Ricostruisci i link DA ZERO usando gli ID stringa originali
        // D3 trasforma source/target in oggetti, quindi dobbiamo estrarre gli ID o usare i dati originali se disponibili.
        // Qui rigeneriamo i link puliti.
        const newLinks = links.map(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;

            let newSource = sourceId;
            let newTarget = targetId;

            // Riemappa gli ID
            if (sourceId === nodeToPromote.id) newSource = 'router';
            if (targetId === nodeToPromote.id) newTarget = 'router';

            // Se puntava al vecchio router (che ora è eliminato), puntiamo al nuovo router?
            // O eliminiamo il link? Se il vecchio router è sparito, i suoi link devono sparire o essere rediretti.
            // Dato che il vecchio router era il centro stella, tutti i suoi link (verso i device)
            // devono ora partire dal NUOVO router.
            if (sourceId === 'router') newSource = 'router';
            if (targetId === 'router') newTarget = 'router';

            return { source: newSource, target: newTarget };
        }).filter(link => link.source !== link.target); // Rimuovi self-loops

        // 5. Aggiorna stato e simulazione
        setNodes(newNodes);
        setLinks(newLinks);

        // Re-inizializza la simulazione con i nuovi dati
        // Nota: D3 vuole oggetti freschi se gli ID sono cambiati in modo strutturale
        simulationRef.current.nodes(newNodes);
        simulationRef.current.force("link").links(newLinks);
        simulationRef.current.alpha(1).restart();

        setSelectedNode(null);

        // 6. Salva la modifica sul server
        try {
            // Usa l'ID originale del nodo (prima che diventasse 'router')
            // Ma attenzione: 'nodeToPromote' ha ancora l'ID originale!
            const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/set-gateway/${nodeToPromote.id}`), {
                method: 'PUT',
                headers: getAuthHeader()
            });

            if (!response.ok) {
                console.error("Errore salvataggio gateway:", response.status);
                // TODO: Revert UI changes? Per ora mostriamo solo errore in console
            } else {
                console.log("Gateway salvato con successo sul server");
            }
        } catch (error) {
            console.error("Errore connessione API set-gateway:", error);
        }
    };


    // Gestisci submit manuale associa genitore
    const handleAssociateParent = async () => {
        if (!selectedNode || !associateIp) return;

        try {
            const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/set-parent/${selectedNode.id}`), {
                method: 'PUT',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ parentIp: (associateIp || '').trim() })
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Parent aggiornato:", data);

                // Aggiorna la mappa: il pallino (selectedNode) si collega all'IP inserito (parent).
                // Il parent mantiene tutti i suoi link esistenti; si modifica solo il link del child.
                if (data.parent_id != null) {
                    const parentNode = nodes.find(n => n.id === data.parent_id || n._realId === data.parent_id);
                    if (parentNode) {
                        const parentNodeId = parentNode.id; // 'router' o id numerico
                        // Rimuovi solo il vecchio link del child (target = selectedNode)
                        const newLinks = links.filter(l => {
                            const tid = typeof l.target === 'object' ? l.target.id : l.target;
                            return tid != selectedNode.id;
                        });
                        newLinks.push({ source: parentNodeId, target: selectedNode.id });
                        setLinks(newLinks);
                        if (simulationRef.current) {
                            simulationRef.current.force("link").links(newLinks);
                            simulationRef.current.alpha(0.3).restart();
                        }
                    } else {
                        alert("Genitore impostato sul server. Ricarica la pagina per aggiornare la mappa.");
                    }
                }

                setIsAssociateModalOpen(false);
                setAssociateIp('');
            } else {
                const errData = await response.json();
                alert(`Errore: ${errData.error || 'Impossibile associare'}`);
            }
        } catch (error) {
            console.error("Errore API set-parent:", error);
            alert("Errore di connessione al server.");
        }
    };

    // Conferma associazione da trascinamento: nodo rilasciato su un altro
    const handleConfirmDragDropAssociate = async () => {
        const { childNode, parentNode } = dragDropAssociate || {};
        if (!childNode || !parentNode) {
            setDragDropAssociate(null);
            return;
        }

        // Aggiorna i link: rimuovi il vecchio link del child, aggiungi parent -> child
        setLinks(prev => {
            const next = prev.filter(l => {
                const tid = typeof l.target === 'object' ? l.target.id : l.target;
                return tid !== childNode.id;
            });
            next.push({ source: parentNode.id, target: childNode.id });
            if (simulationRef.current) {
                simulationRef.current.force("link").links(next);
                simulationRef.current.alpha(0.3).restart();
            }
            return next;
        });

        const parentIp = (parentNode.ip || parentNode.details?.ip_address || '').toString().trim();
        const canCallApi = parentIp && childNode.id !== 'router' && !String(childNode.id).startsWith('virtual-');
        if (canCallApi) {
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/set-parent/${childNode.id}`), {
                    method: 'PUT',
                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentIp })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert(`Errore: ${err.error || 'Impossibile associare'}`);
                }
            } catch (e) {
                console.error("Errore API set-parent:", e);
                alert("Errore di connessione al server.");
            }
        }

        setDragDropAssociate(null);
    };

    // Canvas panning

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

    // Dispositivi gestiti: aggiungi switch SNMP
    const handleManagedAdd = async () => {
        const ip = (managedAdd.ip || '').trim();
        if (!ip) { alert('Inserisci l\'IP dello switch'); return; }
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches`), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, snmp_community: managedAdd.snmp_community || 'public', name: managedAdd.name || null })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data.error || 'Errore durante l\'aggiunta';
                alert(msg);
                // Ricarica lista anche in caso di errore (es. IP già presente) per mostrare lo switch esistente
                try {
                    const resList = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches`), { headers: getAuthHeader() });
                    if (resList.ok) setManagedSwitches(await resList.json());
                } catch { }
                return;
            }
            // Reset form
            setManagedAdd({ ip: '', snmp_community: 'public', name: '' });
            // Ricarica lista completa da server (evita problemi di sincronizzazione)
            try {
                const resList = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches`), { headers: getAuthHeader() });
                if (resList.ok) setManagedSwitches(await resList.json());
            } catch { /* mantieni lista corrente se ricarica fallisce */ }
        } catch (e) {
            alert('Errore di connessione');
        }
    };

    // Dispositivi gestiti: rimuovi
    const handleManagedDelete = async (id) => {
        if (!confirm('Rimuovere questo dispositivo gestito?')) return;
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches/${id}`), { method: 'DELETE', headers: getAuthHeader() });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                alert(d.error || 'Errore');
                return;
            }
            // Ricarica lista completa da server
            try {
                const resList = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches`), { headers: getAuthHeader() });
                if (resList.ok) setManagedSwitches(await resList.json());
            } catch { /* mantieni lista corrente se ricarica fallisce */ }
        } catch (e) { alert('Errore di connessione'); }
    };

    // Dispositivi gestiti: sincronizza (SNMP eseguito dall'agent in locale → parent+port)
    const handleManagedSync = async (id) => {
        setSyncLoadingId(id);
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/managed-switches/${id}/sync`), { method: 'POST', headers: getAuthHeader() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { alert(data.error || 'Errore durante la sincronizzazione'); return; }
            setRefreshDevicesKey(k => k + 1);
            if (data.message) {
                alert(data.message);
            } else {
                alert(`Sincronizzazione OK: ${data.macs_matched} dispositivi associati allo switch (${data.macs_found} MAC letti).`);
            }
        } catch (e) { alert('Errore di connessione'); }
        finally { setSyncLoadingId(null); }
    };

    const drawIcon = (type) => {
        switch (type) {
            case 'router': return <Router size={24} className="text-white" />;
            case 'printer': return <Printer size={20} className="text-white" />;
            case 'server': return <Server size={20} className="text-white" />;
            case 'wifi': return <Wifi size={20} className="text-white" />;
            case 'unmanaged_switch': return <ServerIcon size={20} className="text-white bg-gray-600 rounded-sm p-0.5" />;
            case 'managed_switch': return <Cable size={20} className="text-white" />; // Switch SNMP gestito (es. Netgear)
            default: return <Monitor size={20} className="text-white" />;
        }
    };

    const getNodeColor = (node) => {
        if (node.type === 'managed_switch') return 'bg-indigo-500 border-indigo-700';
        const isParent = links.some(l => (typeof l.source === 'object' ? l.source.id : l.source) === node.id);
        if (isParent) return 'bg-blue-500 border-blue-700';
        if (node.status === 'offline') return 'bg-red-500 border-red-700';
        if (node.status === 'warning') return 'bg-orange-500 border-orange-700';
        return 'bg-green-500 border-green-700';
    };

    return (
        <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
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
                    <button
                        className="bg-white p-2 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
                        title="Aggiorna Layout (Riposiziona nodi)"
                        onClick={handleRefreshLayout}
                    >
                        <RotateCw size={20} className="text-gray-600" />
                    </button>
                    <button
                        className={`relative p-2 rounded-lg shadow-md border flex items-center justify-center ${showManagedPanel ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                        title={`Dispositivi gestiti (Switch SNMP)${managedSwitches.length ? ` — ${managedSwitches.length} in mappa` : ''}`}
                        onClick={() => setShowManagedPanel(v => !v)}
                    >
                        <Cable size={20} className="text-indigo-600" />
                        {managedSwitches.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center" title="Switch SNMP in mappa">{managedSwitches.length}</span>
                        )}
                    </button>

                    {/* Panel Dispositivi gestiti: switch SNMP per leggere MAC e associare parent+porta */}
                    {showManagedPanel && (
                        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 max-h-[70vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-gray-800 text-sm">Dispositivi gestiti (SNMP)</h4>
                                <button onClick={() => setShowManagedPanel(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">Aggiungi switch (es. Netgear GS728TP). Sincronizza per leggere la tabella MAC e collegare i dispositivi.</p>

                            <div className="space-y-2 mb-4">
                                <input placeholder="IP (es. 192.168.1.1)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={managedAdd.ip} onChange={e => setManagedAdd(a => ({ ...a, ip: e.target.value }))} />
                                <input placeholder="Community SNMP" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={managedAdd.snmp_community} onChange={e => setManagedAdd(a => ({ ...a, snmp_community: e.target.value }))} />
                                <input placeholder="Nome (opzionale)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={managedAdd.name} onChange={e => setManagedAdd(a => ({ ...a, name: e.target.value }))} />
                                <button onClick={handleManagedAdd} className="w-full py-1.5 bg-indigo-600 text-white rounded text-sm font-medium flex items-center justify-center gap-1"><Plus size={16} /> Aggiungi</button>
                            </div>

                            <div className="border-t border-gray-200 pt-2 space-y-2">
                                {managedSwitches.length === 0 && <p className="text-xs text-gray-400">Nessuno switch. Aggiungine uno sopra.</p>}
                                {managedSwitches.map(m => (
                                    <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
                                        <span className="text-sm truncate font-mono" title={m.ip}>{m.name || m.ip}</span>
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => handleManagedSync(m.id)} disabled={syncLoadingId === m.id} className="p-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50" title="Sincronizza (SNMP → parent+porta)">{syncLoadingId === m.id ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
                                            <button onClick={() => handleManagedDelete(m.id)} className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100" title="Rimuovi"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Canvas Area Infinito: niente scroll pagina, solo pan e zoom qui dentro */}
            <div
                ref={canvasContainerRef}
                className="flex-1 min-h-0 bg-gray-100 relative overflow-hidden cursor-move touch-none"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
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
                            <div className={`w-full h-full rounded-full flex items-center justify-center shadow-lg border-2 ${getNodeColor(node)} ${selectedNode?.id === node.id ? 'ring-4 ring-blue-300' : ''} bg-white z-10 hover:scale-110 transition-transform`}>
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
                            <span className="font-mono font-medium">{formatIpWithPort(selectedNode.ip, selectedNode.details?.port)}</span>
                        </div>
                        {selectedNode.id !== 'router' && selectedNode.type !== 'managed_switch' && (
                            <div className="flex justify-between items-center border-b pb-2 gap-2">
                                <span className="text-gray-500">Port:</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={65535}
                                    placeholder="vuoto"
                                    className="border border-gray-300 rounded px-2 py-1 w-24 text-right font-mono text-sm"
                                    value={selectedNode.details?.port ?? ''}
                                    onBlur={async (e) => {
                                        const raw = e.target.value.trim();
                                        const v = raw === '' ? null : parseInt(raw, 10);
                                        if (v !== null && (isNaN(v) || v < 1 || v > 65535)) return;
                                        try {
                                            const res = await fetch(buildApiUrl(`/api/network-monitoring/devices/${selectedNode.id}/port`), {
                                                method: 'PATCH',
                                                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ port: v })
                                            });
                                            if (!res.ok) return;
                                            const updated = await res.json();
                                            const newPort = updated.port;
                                            setSelectedNode(prev => prev ? { ...prev, details: { ...prev.details, port: newPort } } : null);
                                            const simNodes = simulationRef.current?.nodes() || [];
                                            const n = simNodes.find(x => x.id === selectedNode.id);
                                            if (n) {
                                                n.details = { ...n.details, port: newPort };
                                                n.label = (n.details?.hostname || formatIpWithPort(n.ip, newPort)) || n.label;
                                                setNodes([...simNodes]);
                                            }
                                        } catch (_) {}
                                    }}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setSelectedNode(prev => prev ? { ...prev, details: { ...prev.details, port: v === '' ? null : parseInt(v, 10) || null } } : null);
                                    }}
                                />
                            </div>
                        )}
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
                            {selectedNode.type === 'managed_switch' ? (
                                <>
                                    <button
                                        onClick={() => handleManagedSync(selectedNode.details.id)}
                                        disabled={syncLoadingId === selectedNode.details.id}
                                        className="w-full py-2 rounded-md font-medium text-xs flex items-center justify-center gap-2 mb-2 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                                    >
                                        {syncLoadingId === selectedNode.details.id ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Sincronizza SNMP
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await handleManagedDelete(selectedNode.details.id);
                                            setSelectedNode(null);
                                        }}
                                        className="w-full py-2 bg-red-50 text-red-600 rounded-md font-medium text-xs hover:bg-red-100 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={14} /> Rimuovi
                                    </button>
                                </>
                            ) : (
                                <>
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

                                    {selectedNode.id !== 'router' && (
                                        <button
                                            onClick={() => setIsAssociateModalOpen(true)}
                                            className="w-full py-2 mt-2 bg-indigo-50 text-indigo-700 rounded-md font-medium text-xs hover:bg-indigo-100 flex items-center justify-center gap-2"
                                            title="Inserisci manualmente l'IP del dispositivo padre"
                                        >
                                            <Link size={14} /> Associa a: (Inserisci IP)
                                        </button>
                                    )}

                                    {selectedNode.id !== 'router' && (
                                        <button
                                            onClick={() => handlePromoteToGateway(selectedNode)}
                                            className="w-full py-2 mt-2 bg-green-50 text-green-700 rounded-md font-medium text-xs hover:bg-green-100 flex items-center justify-center gap-2"
                                            title="Imposta questo dispositivo come Gateway principale"
                                        >
                                            <Router size={14} /> Imposta come Gateway Principale
                                        </button>
                                    )}
                                </>
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
            {/* Modal Associa Manualmente */}
            {isAssociateModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-80 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Associa Nodo a Genitore</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Inserisci l'indirizzo IP del dispositivo a cui vuoi collegare <strong>{selectedNode?.label}</strong>.
                        </p>
                        <input
                            type="text"
                            placeholder="Es: 192.168.1.1"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={associateIp}
                            onChange={(e) => setAssociateIp(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setIsAssociateModalOpen(false); setAssociateIp(''); }}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleAssociateParent}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-medium"
                            >
                                Conferma
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: trascina e rilascia un nodo su un altro — "Vuoi associare IP con IP?" */}
            {dragDropAssociate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Associare come genitore?</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Vuoi associare <strong className="font-mono">{formatIpWithPort(dragDropAssociate.childNode.ip, dragDropAssociate.childNode.details?.port)}</strong> con <strong className="font-mono">{formatIpWithPort(dragDropAssociate.parentNode.ip || dragDropAssociate.parentNode.details?.ip_address, dragDropAssociate.parentNode.details?.port)}</strong>?<br />
                            <span className="text-gray-500">Il nodo <strong>{dragDropAssociate.parentNode.label}</strong> diventerà il genitore di <strong>{dragDropAssociate.childNode.label}</strong>.</span>
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDragDropAssociate(null)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleConfirmDragDropAssociate}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded font-medium"
                            >
                                Sì, associare
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkTopologyPage;
