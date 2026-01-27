import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeft, ZoomIn, ZoomOut, Maximize, Loader, Server, RotateCw,
    Monitor, Printer, Wifi, Router, X, Trash2, Link2,
    Smartphone, Tablet, Laptop, Camera, Tv, Watch, Phone, Database, Cloud, Globe
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import * as d3 from 'd3-force';

// Definizione icone disponibili
const AVAILABLE_ICONS = [
    { type: 'pc', icon: Monitor, label: 'PC / Monitor' },
    { type: 'server', icon: Server, label: 'Server' },
    { type: 'router', icon: Router, label: 'Router' },
    { type: 'wifi', icon: Wifi, label: 'WiFi / AP' },
    { type: 'printer', icon: Printer, label: 'Stampante' },
    { type: 'smartphone', icon: Smartphone, label: 'Smartphone' },
    { type: 'tablet', icon: Tablet, label: 'Tablet' },
    { type: 'laptop', icon: Laptop, label: 'Laptop' },
    { type: 'camera', icon: Camera, label: 'Camera / CCTV' },
    { type: 'tv', icon: Tv, label: 'TV / Screen' },
    { type: 'phone', icon: Phone, label: 'Telefono VoIP' },
    { type: 'switch', icon: Server, label: 'Switch' }, // Switch generic
    { type: 'database', icon: Database, label: 'Database' },
    { type: 'cloud', icon: Cloud, label: 'Cloud' },
    { type: 'internet', icon: Globe, label: 'Internet' }
];

// ... inside component ...

const mapDeviceType = (d) => {
    const t = (d.device_type || '').toLowerCase();
    if (t.includes('printer') || t.includes('stampante')) return 'printer';
    if (t.includes('server') || t.includes('nas')) return 'server';
    if (t.includes('wifi') || t.includes('access point') || t.includes('ap')) return 'wifi';
    if (t.includes('switch')) return 'switch';
    if (t.includes('camera') || t.includes('cctv')) return 'camera';
    if (t.includes('phone') || t.includes('voip')) return 'phone';
    if (t.includes('tv') || t.includes('television')) return 'tv';
    if (t.includes('tablet')) return 'tablet';
    if (t.includes('mobile') || t.includes('smartphone')) return 'smartphone';
    if (t.includes('laptop') || t.includes('notebook')) return 'laptop';
    // Supporto diretto per i tipi definiti manualmente
    if (AVAILABLE_ICONS.some(icon => icon.type === t)) return t;

    return 'pc';
};

const drawIcon = (type) => {
    const IconDef = AVAILABLE_ICONS.find(i => i.type === type);
    const Icon = IconDef ? IconDef.icon : Monitor;

    // Special case styles
    if (type === 'switch' || type === 'unmanaged_switch') {
        return <Server size={20} className="text-white bg-gray-600 rounded-sm p-0.5" />; // Keep switch style distinctive
    }

    return <Icon size={20} className="text-white" strokeWidth={1.5} />;
};

// ... inside render right panel ...

<div className="flex justify-between border-b pb-2">
    <span className="text-gray-500">Status</span>
    <span className={`font-bold ${display.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>{display.status?.toUpperCase() || 'N/A'}</span>
</div>

{/* Icon Selector */ }
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
{
    onMap && nodeForPanel && (
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
    )
}
                        </div >
                    </div >
                    );
                }) ()}
            </div >

    { hoveredDevice && tooltipRect && createPortal(
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
        </div >
    );
};

export default MappaturaPage;
