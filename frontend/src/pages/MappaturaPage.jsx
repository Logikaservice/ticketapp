import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, ZoomIn, ZoomOut, Maximize, Loader, Server, RotateCw,
    Monitor, Printer, Wifi, Router, X, Trash2, Link2, Network,
    Smartphone, Tablet, Laptop, Camera, Tv, Watch, Phone, Database, Cloud, Globe, List,
    Layers, HardDrive, Shield, RadioTower, Speaker, Circle, Lock, Unlock
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
    { type: 'switch', icon: Network, label: 'Switch' },
    { type: 'unmanaged_switch', icon: Network, label: 'Unmanaged Switch' },
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

const style = document.createElement('style');
style.innerHTML = `
  @keyframes pulseRedGlow {
    0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
    100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
  }
`;
document.head.appendChild(style);

const RefreshTimer = () => {
    const [seconds, setSeconds] = useState(30);
    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(prev => (prev > 0 ? prev - 1 : 30));
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    return <span>{seconds < 10 ? `0${seconds}` : seconds}s</span>;
};

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
    // Tracciamento stati precedenti per animazioni
    const prevNodeStatesRef = useRef(new Map()); // Map<nodeId, { status, isNew }>
    const [blinkingNodes, setBlinkingNodes] = useState(new Set()); // Set<nodeId> per nodi che stanno lampeggiando
    const [newDevicesInList, setNewDevicesInList] = useState(new Set()); // Set<deviceId> per nuovi dispositivi nella lista (gialli)
    const seenMacAddressesRef = useRef(new Set()); // Set<macAddress> per tracciare MAC già visti (normalizzati)
    const isInitialLoadRef = useRef(true); // Flag per il primo caricamento
    const [hoveredNode, setHoveredNode] = useState(null); // Nodo su cui è il mouse per tooltip

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

    // Reset del tracciamento quando cambia azienda
    useEffect(() => {
        if (prevCompanyIdRef.current !== null && prevCompanyIdRef.current !== selectedCompanyId) {
            // Cambio azienda: reset del tracciamento
            seenMacAddressesRef.current.clear();
            isInitialLoadRef.current = true;
            setNewDevicesInList(new Set());
        }
    }, [selectedCompanyId]);

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
                if (res.ok) {
                    const newDevices = await res.json();

                    // Funzione per normalizzare MAC address
                    const normalizeMac = (mac) => {
                        if (!mac) return null;
                        return mac.replace(/[\s:.-]/g, '').toUpperCase();
                    };

                    // Al primo caricamento, inizializza la lista dei MAC già visti
                    if (isInitialLoadRef.current) {
                        newDevices.forEach(device => {
                            const normalizedMac = normalizeMac(device.mac_address);
                            if (normalizedMac && normalizedMac.length >= 12) {
                                seenMacAddressesRef.current.add(normalizedMac);
                            }
                        });
                        isInitialLoadRef.current = false;
                        setDevices(newDevices);
                        setLoading(false);
                        return;
                    }

                    // Dopo il primo caricamento, rileva solo i MAC mai visti prima
                    const newlyDetected = new Set();

                    newDevices.forEach(device => {
                        const normalizedMac = normalizeMac(device.mac_address);
                        // Se ha un MAC valido e non l'abbiamo mai visto, è un nuovo dispositivo
                        if (normalizedMac && normalizedMac.length >= 12) {
                            if (!seenMacAddressesRef.current.has(normalizedMac)) {
                                // Nuovo MAC rilevato!
                                seenMacAddressesRef.current.add(normalizedMac);
                                newlyDetected.add(String(device.id));
                            }
                        }
                    });

                    // Aggiorna la lista dei nuovi dispositivi solo se ce ne sono di nuovi
                    if (newlyDetected.size > 0) {
                        setNewDevicesInList(prev => {
                            const combined = new Set(prev);
                            newlyDetected.forEach(id => combined.add(id));
                            return combined;
                        });

                        // Rimuovi dalla lista dei nuovi dopo 10 secondi
                        newlyDetected.forEach(deviceId => {
                            setTimeout(() => {
                                setNewDevicesInList(prev => {
                                    const next = new Set(prev);
                                    next.delete(deviceId);
                                    return next;
                                });
                            }, 10000);
                        });
                    }

                    setDevices(newDevices);
                }
            } catch (e) { console.error('Errore fetch dispositivi:', e); }
            finally { setLoading(false); }
        };
        fetchDevices();

        // Polling automatico per aggiornare i dispositivi ogni 30 secondi (sincronizzazione con agent)
        const intervalId = setInterval(() => {
            const currentAziendaId = parseAziendaId(selectedCompanyId);
            if (currentAziendaId) {
                fetch(buildApiUrl(`/api/network-monitoring/clients/${currentAziendaId}/devices`), { headers: getAuthHeader() })
                    .then(res => {
                        if (res.ok) return res.json();
                        throw new Error('Errore fetch dispositivi');
                    })
                    .then(newDevices => {
                        // Funzione per normalizzare MAC address
                        const normalizeMac = (mac) => {
                            if (!mac) return null;
                            return mac.replace(/[\s:.-]/g, '').toUpperCase();
                        };

                        // Rileva nuovi dispositivi
                        const newlyDetected = new Set();
                        newDevices.forEach(device => {
                            const normalizedMac = normalizeMac(device.mac_address);
                            if (normalizedMac && normalizedMac.length >= 12) {
                                if (!seenMacAddressesRef.current.has(normalizedMac)) {
                                    seenMacAddressesRef.current.add(normalizedMac);
                                    newlyDetected.add(String(device.id));
                                }
                            }
                        });

                        // Aggiorna la lista dei nuovi dispositivi
                        if (newlyDetected.size > 0) {
                            setNewDevicesInList(prev => {
                                const combined = new Set(prev);
                                newlyDetected.forEach(id => combined.add(id));
                                return combined;
                            });

                            newlyDetected.forEach(deviceId => {
                                setTimeout(() => {
                                    setNewDevicesInList(prev => {
                                        const next = new Set(prev);
                                        next.delete(deviceId);
                                        return next;
                                    });
                                }, 10000);
                            });
                        }

                        // Aggiorna i dispositivi (questo triggerà anche l'aggiornamento dei nodi)
                        setDevices(newDevices);
                    })
                    .catch(e => {
                        console.error('Errore polling dispositivi:', e);
                    });
            }
        }, 30000); // 30 secondi

        return () => clearInterval(intervalId);
    }, [selectedCompanyId, refreshDevicesKey, getAuthHeader]);

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

                    // Normalizza MAC per il matching
                    const normalizeMac = (mac) => {
                        if (!mac) return null;
                        return mac.replace(/[:-]/g, '').toUpperCase();
                    };

                    // Crea mappa posizioni basata su MAC invece di device_id
                    const macToPos = new Map(rows.map(r => {
                        const normalizedMac = normalizeMac(r.mac_address);
                        return [normalizedMac, { x: r.x, y: r.y, is_locked: r.is_locked || false }];
                    }));

                    const mapNodes = [];

                    // Crea una mappa dei dispositivi per accesso rapido (per ID e per MAC)
                    const devicesMapById = new Map(devices.map(d => [Number(d.id), d]));
                    const devicesMapByMac = new Map(devices
                        .filter(d => d.mac_address)
                        .map(d => [normalizeMac(d.mac_address), d])
                    );

                    // Itera SOLO sui dispositivi che hanno una posizione salvata nella mappatura
                    // Non creare nodi per dispositivi che non sono ancora stati aggiunti alla mappa
                    for (const d of devices) {
                        if (!d.mac_address) continue; // Salta dispositivi senza MAC

                        const normalizedMac = normalizeMac(d.mac_address);
                        const pos = macToPos.get(normalizedMac);

                        // IMPORTANTE: Crea nodi SOLO se hanno una posizione salvata nella mappatura
                        // Se non c'è posizione, significa che il dispositivo non è ancora stato aggiunto alla mappa
                        if (!pos) continue; // Salta dispositivi senza posizione salvata

                        // Verifica se questo MAC è stato appena eliminato (evita ricreazione immediata)
                        // Questo check viene fatto dopo il controllo pos perché se non c'è posizione, non c'è bisogno di controllare

                        const isLocked = pos.is_locked || false;

                        // Trova il nodo esistente nella simulazione per preservare la posizione reale
                        // Usa la simulazione come fonte di verità per le posizioni, non lo stato nodes
                        let nodeX = pos.x ?? 0;
                        let nodeY = pos.y ?? 0;

                        // Se la simulazione esiste, usa le posizioni dalla simulazione (più accurate)
                        if (simulationRef.current) {
                            const simNodes = simulationRef.current.nodes();
                            const existingSimNode = simNodes.find(n => {
                                // Cerca per ID o per MAC
                                if (Number(n.id) === Number(d.id)) return true;
                                if (n.details?.mac_address && normalizeMac(n.details.mac_address) === normalizedMac) return true;
                                return false;
                            });
                            if (existingSimNode) {
                                // Usa la posizione dalla simulazione (posizione reale visualizzata)
                                nodeX = existingSimNode.x;
                                nodeY = existingSimNode.y;
                            } else {
                                // Se non esiste nella simulazione, usa lo stato nodes come fallback
                                const existingNode = nodes.find(n => {
                                    if (Number(n.id) === Number(d.id)) return true;
                                    if (n.details?.mac_address && normalizeMac(n.details.mac_address) === normalizedMac) return true;
                                    return false;
                                });
                                if (existingNode) {
                                    nodeX = existingNode.x;
                                    nodeY = existingNode.y;
                                }
                            }
                        } else {
                            // Se la simulazione non esiste ancora, usa lo stato nodes
                            const existingNode = nodes.find(n => {
                                if (Number(n.id) === Number(d.id)) return true;
                                if (n.details?.mac_address && normalizeMac(n.details.mac_address) === normalizedMac) return true;
                                return false;
                            });
                            if (existingNode) {
                                nodeX = existingNode.x;
                                nodeY = existingNode.y;
                            }
                        }

                        mapNodes.push({
                            id: d.id,
                            type: mapDeviceType(d),
                            label: (d.notes || d.hostname || '').trim() || d.ip_address,
                            ip: d.ip_address,
                            status: d.status, // Usa lo stato aggiornato dal dispositivo
                            details: d, // Includi tutti i dettagli aggiornati
                            x: nodeX,
                            y: nodeY,
                            locked: isLocked,
                            // Se locked, imposta fx e fy per bloccare il nodo nella simulazione D3
                            fx: isLocked ? nodeX : null,
                            fy: isLocked ? nodeY : null
                        });
                    }
                    const mapLinks = [];
                    // Crea mappa MAC -> nodo per trovare i parent
                    const macToNodeMap = new Map(mapNodes.map(n => {
                        if (!n.details?.mac_address) return null;
                        return [normalizeMac(n.details.mac_address), n];
                    }).filter(Boolean));

                    for (const n of mapNodes) {
                        const parentDeviceId = n.details?.parent_device_id != null ? Number(n.details.parent_device_id) : null;
                        if (parentDeviceId == null) continue;

                        // Trova il nodo parent usando il suo MAC
                        const parentDevice = devicesMapById.get(parentDeviceId);
                        if (!parentDevice?.mac_address) continue;

                        const parentMac = normalizeMac(parentDevice.mac_address);
                        const parentNode = macToNodeMap.get(parentMac);
                        if (!parentNode) continue;

                        mapLinks.push({ source: parentNode.id, target: n.id });
                    }
                    if (ac.signal.aborted || parseAziendaId(selectedCompanyIdRef.current) !== aziendaId) return;

                    // Rileva cambiamenti di stato per animazioni
                    const prevStates = prevNodeStatesRef.current;
                    const newBlinking = new Set();

                    // Aggiorna i nodi esistenti nella simulazione preservando posizioni e proprietà
                    if (simulationRef.current) {
                        const simNodes = simulationRef.current.nodes();
                        const simNodesMap = new Map(simNodes.map(n => [String(n.id), n]));

                        mapNodes.forEach(newNode => {
                            const nodeId = String(newNode.id);
                            const existingSimNode = simNodesMap.get(nodeId);

                            if (existingSimNode) {
                                // Aggiorna lo stato e i dettagli mantenendo posizione e proprietà
                                existingSimNode.status = newNode.status;
                                existingSimNode.details = newNode.details;
                                existingSimNode.label = newNode.label;
                                existingSimNode.type = newNode.type;
                                existingSimNode.ip = newNode.ip;
                                // Preserva posizione e locked state
                                if (newNode.locked && (existingSimNode.fx === null || existingSimNode.fy === null)) {
                                    existingSimNode.fx = existingSimNode.x;
                                    existingSimNode.fy = existingSimNode.y;
                                } else if (!newNode.locked) {
                                    existingSimNode.fx = null;
                                    existingSimNode.fy = null;
                                }
                                existingSimNode.locked = newNode.locked;
                            }
                        });
                    }

                    mapNodes.forEach(node => {
                        const nodeId = String(node.id);
                        const prevState = prevStates.get(nodeId);

                        // Cambio di stato: online <-> offline (qualsiasi cambio stato)
                        if (prevState && prevState.status !== node.status) {
                            // Dispositivo cambia stato: lampeggia
                            newBlinking.add(nodeId);
                            // Rimuovi dal lampeggio dopo 10 secondi (richiesto dall'utente)
                            setTimeout(() => {
                                setBlinkingNodes(prev => {
                                    const next = new Set(prev);
                                    next.delete(nodeId);
                                    return next;
                                });
                            }, 10000);
                        }

                        // Aggiorna stato precedente (anche se è il primo caricamento)
                        prevStates.set(nodeId, {
                            status: node.status,
                            isNew: !prevState
                        });
                    });

                    // Rimuovi nodi che non esistono più
                    const currentIds = new Set(mapNodes.map(n => String(n.id)));
                    prevStates.forEach((_, nodeId) => {
                        if (!currentIds.has(nodeId)) {
                            prevStates.delete(nodeId);
                        }
                    });

                    setBlinkingNodes(newBlinking);
                    setLinks(mapLinks);

                    // Se la simulazione esiste già, aggiorna i nodi senza ricrearla
                    if (simulationRef.current && simulationRef.current.nodes().length > 0) {
                        // Aggiorna i nodi nella simulazione mantenendo le posizioni
                        const simNodes = simulationRef.current.nodes();
                        const existingNodeIds = new Set(simNodes.map(n => String(n.id)));
                        const newNodeIds = new Set(mapNodes.map(n => String(n.id)));

                        // Verifica se ci sono cambiamenti strutturali (nodi aggiunti/rimossi)
                        const hasStructuralChanges =
                            mapNodes.length !== simNodes.length ||
                            mapNodes.some(n => !existingNodeIds.has(String(n.id))) ||
                            simNodes.some(n => !newNodeIds.has(String(n.id)));

                        // Aggiorna i nodi nella simulazione preservando le posizioni esistenti
                        const newSimNodes = mapNodes.map(newNode => {
                            const existing = simNodes.find(n => String(n.id) === String(newNode.id));
                            if (existing) {
                                // Mantieni TUTTE le proprietà fisiche esistenti per preservare la posizione
                                // IMPORTANTE: preserva x, y esatti per evitare spostamenti
                                return {
                                    ...newNode,
                                    x: existing.x, // Posizione X esatta dalla simulazione
                                    y: existing.y, // Posizione Y esatta dalla simulazione
                                    vx: existing.vx || 0, // Mantieni velocità esistente (sarà azzerata se la sim è ferma)
                                    vy: existing.vy || 0, // Mantieni velocità esistente (sarà azzerata se la sim è ferma)
                                    fx: existing.fx, // Preserva fx (locked state)
                                    fy: existing.fy, // Preserva fy (locked state)
                                    // Preserva anche altre proprietà D3 se presenti
                                    index: existing.index
                                };
                            }
                            // Nuovo nodo: usa posizione dal database o default
                            return newNode;
                        });

                        // Se non ci sono cambiamenti strutturali, ferma la simulazione per evitare movimento
                        if (!hasStructuralChanges) {
                            // Ferma la simulazione per evitare che le forze D3 muovano i nodi
                            simulationRef.current.stop();
                        }

                        // Aggiorna i nodi nella simulazione
                        simulationRef.current.nodes(newSimNodes);

                        // Aggiorna i link se sono cambiati
                        const currentLinks = simulationRef.current.force('link');
                        if (currentLinks) {
                            currentLinks.links(mapLinks);
                        } else if (mapLinks.length > 0) {
                            simulationRef.current.force('link', d3.forceLink(mapLinks).id(d => d.id).distance(150));
                        }

                        // Riavvia la simulazione SOLO se ci sono cambiamenti strutturali
                        // Altrimenti aggiorna solo i dati senza far muovere i nodi
                        if (hasStructuralChanges) {
                            // Cambiamenti strutturali: riavvia con alpha basso per movimento minimo
                            simulationRef.current.alpha(0.1).restart();
                        }
                        // Se non ci sono cambiamenti strutturali, la simulazione rimane ferma
                        // Aggiorna solo lo stato React per riflettere i nuovi dati
                        setNodes([...newSimNodes]);
                    } else {
                        // Prima volta: crea la simulazione
                        ensureSimulation(mapNodes, mapLinks, true);
                    }
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

        if (type === 'generic') {
            return <Circle size={24} className="fill-current opacity-50" strokeWidth={1.5} />;
        }
        return <Icon size={24} strokeWidth={1.5} />;
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

        // Assicurati che i nodi locked abbiano fx e fy impostati per bloccarli
        nodeList.forEach(node => {
            if (node.locked) {
                // Se locked, mantieni la posizione fissa
                if (node.fx === null || node.fx === undefined) {
                    node.fx = node.x || 0;
                }
                if (node.fy === null || node.fy === undefined) {
                    node.fy = node.y || 0;
                }
            } else {
                // Se non locked, rimuovi fx/fy per permettere movimento
                if (node.fx !== null && node.fx !== undefined) {
                    node.fx = null;
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.fy = null;
                }
            }
        });

        const sim = d3.forceSimulation(nodeList)
            .velocityDecay(0.6) // Aumenta attrito per rendere nodi meno "molleggianti"
            .force('charge', d3.forceManyBody().strength(-600))
            .force('collide', d3.forceCollide().radius(50))
            .on('tick', () => {
                // Mantieni fx/fy per i nodi locked durante la simulazione
                sim.nodes().forEach(node => {
                    if (node.locked && (node.fx === null || node.fy === null)) {
                        node.fx = node.x;
                        node.fy = node.y;
                    }
                });
                setNodes([...sim.nodes()]);
            });
        if (linkList && linkList.length > 0) {
            sim.force('link', d3.forceLink(linkList).id(d => d.id).distance(150));
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
        // Normalizza MAC per il controllo
        const normalizeMac = (mac) => {
            if (!mac) return null;
            return mac.replace(/[:-]/g, '').toUpperCase();
        };

        // Controlla se esiste già un nodo con lo stesso MAC (non solo stesso ID)
        const normalizedMac = normalizeMac(d.mac_address);
        const exists = nodes.some(n => {
            if (Number(n.id) === Number(d.id)) return true;
            if (n.details?.mac_address && normalizeMac(n.details.mac_address) === normalizedMac) return true;
            return false;
        });

        if (exists) {
            const existingNode = nodes.find(n => {
                if (Number(n.id) === Number(d.id)) return true;
                if (n.details?.mac_address && normalizeMac(n.details.mac_address) === normalizedMac) return true;
                return false;
            });
            if (existingNode) {
                setSelectedNode(existingNode);
                return;
            }
        }

        const aziendaId = parseAziendaId(selectedCompanyId);
        if (!aziendaId) return;
        if (!d.mac_address) {
            alert('Dispositivo senza MAC address, impossibile aggiungere alla mappa');
            return;
        }
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes`), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ mac_address: d.mac_address, x: 0, y: 0 })
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
            y: 0,
            locked: false // Nuovi nodi non sono bloccati di default
        };

        // Se è online, fai lampeggiare verde
        const nodeId = String(newNode.id);
        if (newNode.status === 'online') {
            setBlinkingNodes(prev => new Set(prev).add(nodeId));
            setTimeout(() => {
                setBlinkingNodes(prev => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 3000);
        }

        // Aggiorna stato precedente
        prevNodeStatesRef.current.set(nodeId, {
            status: newNode.status,
            isNew: true
        });

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
                    if (!childDevice.mac_address) {
                        alert('Dispositivo senza MAC address, impossibile aggiungere alla mappa');
                        return;
                    }
                    const addRes = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes`), {
                        method: 'POST',
                        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mac_address: childDevice.mac_address, x: (parentNode.x || 0) + 80, y: parentNode.y || 0 })
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
                // Normalizza MAC per il salvataggio
                const normalizeMac = (mac) => {
                    if (!mac) return null;
                    return mac.replace(/[:-]/g, '').toUpperCase();
                };

                // Invia posizione e stato locked per ogni nodo usando MAC invece di device_id
                const payload = list.map(n => {
                    const macAddress = n.details?.mac_address;
                    if (!macAddress) {
                        console.warn('⚠️ Nodo senza MAC address, impossibile salvare posizione:', n);
                        return null;
                    }
                    return {
                        mac_address: normalizeMac(macAddress),
                        x: n.x,
                        y: n.y,
                        locked: n.locked || false
                    };
                }).filter(Boolean);
                fetch(buildApiUrl(`/api/network-monitoring/clients/${cid}/mappatura-nodes`), {
                    method: 'POST',
                    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes: payload }),
                    keepalive: true
                }).then(r => { if (!r.ok) console.error('❌ Mappatura POST layout fallito:', r.status); }).catch(e => console.error('❌ Mappatura POST layout:', e));
            } catch (e) { console.error('❌ Mappatura POST layout:', e); }
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
        const h = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Calcola il nuovo scale
            const currentScale = scaleRef.current;
            const scaleDelta = -e.deltaY * 0.001;
            const newScale = Math.min(Math.max(0.1, currentScale + scaleDelta), 4);

            // Se lo scale non è cambiato, non fare nulla
            if (newScale === currentScale) return;

            // Ottieni la posizione del mouse relativa al container
            const rect = el.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Ottieni l'offset corrente
            const currentOffset = offsetRef.current;

            // Calcola la posizione del mouse nel sistema di coordinate del canvas (prima dello zoom)
            const worldX = (mouseX - currentOffset.x) / currentScale;
            const worldY = (mouseY - currentOffset.y) / currentScale;

            // Calcola il nuovo offset per mantenere il punto del mouse fisso
            const newOffsetX = mouseX - worldX * newScale;
            const newOffsetY = mouseY - worldY * newScale;

            // Applica le modifiche
            setScale(newScale);
            setOffset({ x: newOffsetX, y: newOffsetY });
        };
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
            // Non aggiungere automaticamente alla mappa, lascia che l'utente lo trascini dalla lista
            // if (data.device) await addNodeFromDevice(data.device);
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

        // Estrai MAC address qui, fuori dai blocchi, per poterlo usare dopo
        const macAddress = node.details?.mac_address;

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
                    // Usa MAC address invece di device_id per eliminare il nodo
                    if (!macAddress) {
                        alert('Impossibile eliminare: dispositivo senza MAC address');
                        return;
                    }

                    // Normalizza MAC per l'URL (rimuovi separatori)
                    const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();

                    // Codifica il MAC per l'URL (potrebbe contenere caratteri speciali)
                    const encodedMac = encodeURIComponent(normalizedMac);

                    const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/mappatura-nodes/${encodedMac}`), {
                        method: 'DELETE',
                        headers: getAuthHeader()
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        alert(err.error || 'Errore rimozione dalla mappa');
                        return;
                    }

                    console.log(`✅ Nodo eliminato dal database: MAC=${normalizedMac}`);
                }
            } catch (e) {
                alert('Errore: ' + e.message);
                return;
            }
        }

        // Rimuovi il nodo dallo stato locale immediatamente
        // IMPORTANTE: Rimuovi per MAC invece di ID per evitare problemi
        const normalizeMacForFilter = (mac) => {
            if (!mac) return null;
            return mac.replace(/[:-]/g, '').toUpperCase();
        };

        const deleteMacNormalized = macAddress ? normalizeMacForFilter(macAddress) : null;

        const nextNodes = nodes.filter(n => {
            // Rimuovi per ID
            if (Number(n.id) === Number(id)) return false;

            // Rimuovi anche per MAC (per sicurezza) - solo se non è virtuale
            if (!isVirtual && deleteMacNormalized && n.details?.mac_address) {
                const nodeMacNormalized = normalizeMacForFilter(n.details.mac_address);
                if (nodeMacNormalized === deleteMacNormalized) {
                    console.log(`🗑️ Rimozione nodo locale per MAC: ${nodeMacNormalized}`);
                    return false;
                }
            }
            return true;
        });
        const nextLinks = links.filter(l => {
            const sourceId = typeof l.source === 'object' ? l.source?.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target?.id : l.target;
            return Number(sourceId) !== Number(id) && Number(targetId) !== Number(id);
        });
        setNodes(nextNodes);
        setLinks(nextLinks);
        setSelectedNode(null);
        ensureSimulation(nextNodes, nextLinks);
    };

    const handleNodeMouseDown = (e, node) => {
        e.stopPropagation();

        // Se il nodo è locked, non permettere il trascinamento
        if (node.locked) {
            return;
        }

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
            // Se il nodo non è locked, rimuovi fx/fy per permettere movimento libero
            if (!node.locked) {
                node.fx = null;
                node.fy = null;
            }
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

    // Normalizza MAC per il matching
    const normalizeMacForList = (mac) => {
        if (!mac) return null;
        return mac.replace(/[:-]/g, '').toUpperCase();
    };

    // Crea un Set di MAC address dei nodi già nella mappa
    const macAddressesOnMap = new Set(
        nodes
            .map(n => n.details?.mac_address)
            .filter(Boolean)
            .map(mac => normalizeMacForList(mac))
    );

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
        .filter(d => {
            // Mostra solo dispositivi con IP che NON sono già nella mappa
            if (!d.ip_address) return false;
            if (!d.mac_address) return true; // Se non ha MAC, mostra comunque (per retrocompatibilità)
            // Controlla se il MAC è già nella mappa
            return !macAddressesOnMap.has(normalizeMacForList(d.mac_address));
        })
        .sort((a, b) => {
            const ka = ipToSortKey(a.ip_address);
            const kb = ipToSortKey(b.ip_address);
            for (let i = 0; i < 4; i++) {
                if (ka[i] !== kb[i]) return ka[i] - kb[i];
            }
            return (a.ip_address || '').localeCompare(b.ip_address || '');
        });

    // Verifica se un nodo ha problemi di disconnessione continua
    const hasDisconnectionIssues = (node) => {
        // Un dispositivo ha problemi se:
        // 1. Ha un previous_ip (ha cambiato IP) ed è offline
        // 2. Ha molti cambi di stato (status_changes_count > 3)
        // 3. Ha un flag has_connection_issues
        return node.details?.previous_ip && node.status === 'offline' &&
            (node.details?.status_changes_count > 3 || node.details?.has_connection_issues);
    };

    const getNodeColor = (node) => {
        const nodeId = String(node.id);
        const isBlinking = blinkingNodes.has(nodeId);

        // Verifica se è uno switch virtuale (unmanaged_switch)
        const isVirtualSwitch = node.type === 'unmanaged_switch' ||
            (node.details?.device_type || '').toLowerCase().includes('unmanaged_switch');

        // Switch virtuali: sempre arancione
        if (isVirtualSwitch) {
            return 'bg-orange-500 border-orange-700';
        }

        // Verifica se il nodo è padre (ha figli collegati)
        const isParent = links.some(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            return sourceId === node.id;
        });

        // Problemi di disconnessione: rosso normale (l'ombra lampeggiante viene gestita separatamente)
        if (hasDisconnectionIssues(node)) {
            return isParent
                ? 'bg-red-700 border-red-900'
                : 'bg-red-600 border-red-800';
        }

        // Router: viola (più scuro se è padre)
        if (node.type === 'router') {
            return isParent ? 'bg-indigo-600 border-indigo-800' : 'bg-indigo-500 border-indigo-700';
        }

        // Offline: rosso (con lampeggio se appena cambiato, più scuro se è padre)
        if (node.status === 'offline') {
            if (isBlinking) {
                return isParent ? 'bg-red-700 border-red-900 animate-pulse' : 'bg-red-600 border-red-800 animate-pulse';
            }
            return isParent ? 'bg-red-600 border-red-800' : 'bg-red-500 border-red-700';
        }

        // Warning: arancione (più scuro se è padre)
        if (node.status === 'warning') {
            return isParent ? 'bg-orange-600 border-orange-800' : 'bg-orange-500 border-orange-700';
        }

        // Online: verde (con lampeggio se appena cambiato, più scuro se è padre)
        if (isBlinking) {
            return isParent ? 'bg-green-700 border-green-900 animate-pulse' : 'bg-green-600 border-green-800 animate-pulse';
        }
        return isParent ? 'bg-green-600 border-green-800' : 'bg-green-500 border-green-700';
    };

    return (
        <>
            {/* Animazione CSS per ombra rossa lampeggiante */}
            <style>{`
                @keyframes pulseShadow {
                    0%, 100% {
                        box-shadow: 0 8px 25px 12px rgba(239, 68, 68, 0.25), 0 0 0 0 rgba(239, 68, 68, 0.4);
                    }
                    50% {
                        box-shadow: 0 8px 30px 15px rgba(239, 68, 68, 0.4), 0 0 0 2px rgba(239, 68, 68, 0.2);
                    }
                }
            `}</style>
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
                        <div className="w-48 shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
                            <div className="p-2 flex flex-col gap-1.5 border-b border-gray-100 shrink-0">
                                <button
                                    className="bg-white p-1.5 rounded shadow border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                                    title="Aggiungi Switch Unmanaged"
                                    onClick={handleAddVirtualNode}
                                >
                                    <Server size={16} className="text-blue-600" />
                                    <span className="text-xs font-medium">Aggiungi Switch</span>
                                </button>
                                <button
                                    className="bg-white p-1.5 rounded shadow border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                                    title="Aggiorna Layout"
                                    onClick={handleRefreshLayout}
                                >
                                    <RotateCw size={16} className="text-gray-600" />
                                    <span className="text-xs font-medium">Aggiorna Layout</span>
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <h4 className="px-2 py-1 text-[10px] font-bold text-gray-600 uppercase border-b border-gray-100 shrink-0" title="Clicca per i dati a destra · Trascina in mappa per aggiungere · Trascina su un pallino per associare come figlio">IP presenti e individuati</h4>
                                <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                                    {loading && <div className="flex items-center gap-1 text-gray-500 text-xs py-1"><Loader size={12} className="animate-spin" /> Caricamento…</div>}
                                    {!loading && ipList.length === 0 && (
                                        <p className="text-xs text-gray-400 py-1">
                                            {devices.some(d => d.ip_address) ? 'Tutti in mappa. Elimina un nodo per far riapparire l’IP.' : 'Nessun IP.'}
                                        </p>
                                    )}
                                    {!loading && ipList.map(d => {
                                        const sel = selectedNode?.id === d.id || selectedDevice?.id === d.id;
                                        const isNew = newDevicesInList.has(String(d.id));
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
                                                className={`w-full text-left px-1.5 py-0.5 rounded text-xs font-mono truncate border transition cursor-grab active:cursor-grabbing flex flex-col gap-0.5 ${sel
                                                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                                                    : isNew
                                                        ? 'bg-yellow-100 border-yellow-400 hover:bg-yellow-200'
                                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-1.5 w-full">
                                                    {/* Pallino indicatore stato */}
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${d.status === 'online'
                                                        ? 'bg-green-500'
                                                        : d.status === 'offline'
                                                            ? 'bg-red-500'
                                                            : 'bg-gray-400'
                                                        }`} title={d.status || 'unknown'}></div>
                                                    <span className="truncate flex-1">{d.ip_address}</span>
                                                </div>
                                                {/* MAC address sotto l'IP, in piccolo */}
                                                {d.mac_address && (
                                                    <div className="text-[9px] text-gray-500 font-mono pl-3.5 truncate" title={d.mac_address}>
                                                        {d.mac_address}
                                                    </div>
                                                )}
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
                        className="flex-1 min-h-0 bg-white relative overflow-hidden cursor-move touch-none"
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
                        {/* Header Blueprint */}
                        <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start pointer-events-none z-40">
                            <div>
                                <h1 className="text-xl font-light tracking-widest uppercase text-slate-400">Network Status Blueprint</h1>
                                <div className="flex items-center gap-1 mt-2">
                                    <div className="h-0.5 w-12 bg-blue-500"></div>
                                    <div className="h-0.5 w-4 bg-emerald-500"></div>
                                </div>
                            </div>
                            <div className="flex gap-8 pointer-events-auto">
                                <div className="text-right">
                                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Sistemi Attivi</div>
                                    <div className="text-xl font-bold text-emerald-600">
                                        {nodes.filter(n => !hasDisconnectionIssues(n)).length} <span className="text-slate-300 text-sm">/</span> {nodes.length}
                                    </div>
                                </div>
                                <div className="text-right border-l border-slate-200 pl-8">
                                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Next Scan</div>
                                    <div className="text-xl font-bold text-slate-600 font-mono">
                                        <RefreshTimer />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            className="absolute -inset-[500%] pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)', backgroundSize: `${40 * scale}px ${40 * scale}px`, backgroundPosition: `${offset.x}px ${offset.y}px` }}
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
                                    return <line key={`link-${i}`} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="#cbd5e1" strokeWidth="1" />;
                                })}
                            </svg>
                            {nodes.map(node => {
                                const isOnline = !hasDisconnectionIssues(node);
                                const isHovered = hoveredNode?.id === node.id;
                                const isSelected = selectedNode?.id === node.id;

                                return (
                                    <div
                                        key={node.id}
                                        className="absolute flex flex-col items-center justify-center pointer-events-auto"
                                        style={{
                                            left: node.x, top: node.y, transform: 'translate(-50%, -50%)',
                                            width: 48, height: 48,
                                            cursor: node.locked ? 'not-allowed' : 'pointer',
                                            zIndex: isSelected ? 50 : 10
                                        }}
                                        onMouseDown={(e) => handleNodeMouseDown(e, node)}
                                        onMouseEnter={() => setHoveredNode(node)}
                                        onMouseLeave={() => setHoveredNode(null)}
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
                                        {/* Nodo Stile 'Blueprint' */}
                                        <div className={`
                                        relative w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300 bg-white
                                        ${isSelected ? 'border-blue-500 shadow-lg scale-110 ring-2 ring-blue-200' : 'border-slate-200 shadow-sm'}
                                        ${!isOnline ? 'border-red-200 bg-red-50' : ''}
                                        hover:border-blue-400 hover:shadow-md hover:scale-105
                                    `}>
                                            {/* Icona */}
                                            <div className={`transition-colors duration-300 ${isSelected ? 'text-blue-600' :
                                                (!isOnline ? 'text-red-400' : 'text-slate-600')
                                                }`}>
                                                {drawIcon(node.type)}
                                            </div>

                                            {/* LED Status */}
                                            <div className={`
                                            absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white
                                            ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-red-500'}
                                        `}></div>

                                            {/* Lock Icon */}
                                            {node.locked && (
                                                <div className="absolute -top-1 -right-1 bg-purple-100 rounded-full p-0.5 border border-purple-200" title="Nodo bloccato">
                                                    <Lock size={8} className="text-purple-600" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Etichetta Stile 'Blueprint' */}
                                        <div className={`
                                        absolute top-full mt-2 flex flex-col items-center pointer-events-none whitespace-nowrap z-50 transition-all duration-300
                                        ${isHovered || isSelected ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-90'}
                                    `}>
                                            <span className={`text-[9px] font-mono font-medium leading-none mb-0.5 ${isOnline ? 'text-blue-500' : 'text-red-400'}`}>
                                                {node.ip.startsWith('virtual-') ? 'VIRTUAL' : node.ip}
                                            </span>
                                            {node.label && node.label !== node.ip && (
                                                <span className="text-[10px] font-bold text-slate-700 tracking-tight bg-white/80 px-1.5 py-0.5 rounded shadow-sm border border-slate-100/50 backdrop-blur-[1px]">
                                                    {node.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Tooltip al hover */}
                        {hoveredNode && hoveredNode.id && (
                            <div
                                className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm z-[200] pointer-events-none"
                                style={{
                                    left: `${hoveredNode.x * scale + offset.x + 30}px`,
                                    top: `${hoveredNode.y * scale + offset.y - 30}px`,
                                    transform: 'translate(0, -100%)',
                                    maxWidth: '200px'
                                }}
                            >
                                <div className="font-semibold mb-1 border-b border-gray-700 pb-1 text-white">
                                    {hoveredNode.details?.hostname || hoveredNode.details?.device_type || hoveredNode.type || 'N/A'}
                                </div>
                                <div className="text-xs text-gray-300 space-y-1">
                                    <div><span className="text-gray-400">Utente:</span> {hoveredNode.details?.device_username || '-'}</div>
                                    <div><span className="text-gray-400">Percorso:</span> {hoveredNode.details?.device_path || '-'}</div>
                                </div>
                            </div>
                        )}
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
                        // Assicurati che nodeForPanel abbia il flag locked (default false se non presente)
                        if (nodeForPanel && nodeForPanel.locked === undefined) {
                            nodeForPanel.locked = false;
                        }
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
                                            onKeyDown={async (e) => {
                                                // Quando preme Invio, salva e aggiorna
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
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
                                                            if (n) {
                                                                // Salva il testo completo nel label
                                                                n.label = v || n.ip;
                                                                // Salva anche nel details per mantenere il testo originale
                                                                n.details = { ...n.details, notes: v };
                                                            }
                                                            setNodes([...simNodes]);
                                                        }
                                                    } catch (_) { }
                                                    // Rimuovi il focus dall'input
                                                    e.target.blur();
                                                }
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
                                                        if (n) {
                                                            n.label = v || n.ip;
                                                            n.details = { ...n.details, notes: v };
                                                        }
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
                                        <span className="text-gray-500">MAC</span>
                                        <span className="font-mono text-sm">{display.details?.mac_address || 'N/A'}</span>
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
                                                onClick={async () => {
                                                    const newLockedState = !nodeForPanel.locked;
                                                    let currentX = nodeForPanel.x;
                                                    let currentY = nodeForPanel.y;

                                                    // Update simulation node directly and get LIVE coordinates
                                                    if (simulationRef.current) {
                                                        const simNodes = simulationRef.current.nodes();
                                                        const n = simNodes.find(x => x.id === display.id);
                                                        if (n) {
                                                            n.locked = newLockedState;
                                                            if (newLockedState) {
                                                                n.fx = n.x;
                                                                n.fy = n.y;
                                                            } else {
                                                                n.fx = null;
                                                                n.fy = null;
                                                            }
                                                            // Capture LIVE coordinates
                                                            currentX = n.x;
                                                            currentY = n.y;

                                                            setNodes([...simNodes]);
                                                            if (!newLockedState) simulationRef.current.alpha(0.1).restart();
                                                        }
                                                    }

                                                    // Optimistic update - update coordinates too!
                                                    if (isNode && selectedNode) setSelectedNode(prev => prev ? { ...prev, locked: newLockedState, x: currentX, y: currentY } : null);
                                                    else if (selectedDevice) setSelectedDevice(prev => prev ? { ...prev, locked: newLockedState } : null);

                                                    try {
                                                        const macAddress = nodeForPanel.details?.mac_address || nodeForPanel.mac_address;
                                                        const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/mappatura-nodes`), {
                                                            method: 'POST',
                                                            headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                nodes: [{
                                                                    id: display.id,
                                                                    mac_address: macAddress,
                                                                    locked: newLockedState,
                                                                    x: currentX,
                                                                    y: currentY
                                                                }]
                                                            })
                                                        });

                                                        if (!response.ok) {
                                                            console.error('Errore aggiornamento lock:', response.status);
                                                        }
                                                    } catch (e) {
                                                        console.error('Errore updating node lock status:', e);
                                                    }
                                                }}
                                                className={`w-full py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${nodeForPanel.locked ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                                            >
                                                {nodeForPanel.locked ? <Lock size={16} /> : <Unlock size={16} />}
                                                {nodeForPanel.locked ? 'Sblocca posizione' : 'Fissa posizione'}
                                            </button>
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
                            <div className="text-gray-800 mb-2">{hoveredDevice.hostname || hoveredDevice.device_type || '-'}</div>
                            <div className="font-semibold text-gray-700 mb-1">Utente</div>
                            <div className="text-gray-800 mb-2">{hoveredDevice.device_username || '-'}</div>
                            <div className="font-semibold text-gray-700 mb-1">Percorso</div>
                            <div className="text-gray-800">{hoveredDevice.device_path || '-'}</div>
                        </div>,
                        document.body
                    )}
                </div>
            </div>
        </>
    );
};

export default MappaturaPage;
