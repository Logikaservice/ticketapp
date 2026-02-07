/**
 * Icone tipo dispositivo condivise tra Mappatura e Monitoraggio Rete.
 * Modificando qui, l'icona è uguale in entrambe le viste.
 */
import React from 'react';
import {
  Monitor, Server, Layers, HardDrive, Router, Shield, Network,
  Wifi, Key, RadioTower, Printer, Smartphone, Tablet, Laptop, Camera, Tv, Watch,
  Phone, Database, Cloud, Globe, Circle, PhoneCall, Speaker
} from 'lucide-react';

export const AVAILABLE_ICONS = [
  { type: 'pc', icon: Monitor, label: 'PC / Monitor' },
  { type: 'server', icon: Server, label: 'Server' },
  { type: 'virtualization', icon: Layers, label: 'Virtualizzazione' },
  { type: 'virtual', icon: Layers, label: 'Virtuale' },
  { type: 'nas', icon: HardDrive, label: 'NAS / Storage' },
  { type: 'router', icon: Router, label: 'Router' },
  { type: 'firewall', icon: Shield, label: 'Firewall' },
  { type: 'switch', icon: Network, label: 'Switch' },
  { type: 'unmanaged_switch', icon: Network, label: 'Unmanaged Switch' },
  { type: 'managed_switch', icon: Network, label: 'Managed Switch' },
  { type: 'wifi', icon: Wifi, label: 'WiFi / AP' },
  { type: 'cloud_key', icon: Key, label: 'Cloud Key / Controller WiFi' },
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
  { type: 'pbx', icon: PhoneCall, label: 'Centralino VoIP / PBX' },
  { type: 'dect_cell', icon: RadioTower, label: 'Cella DECT / Base DECT' },
  { type: 'dect_handset', icon: Phone, label: 'Cordless DECT' },
  { type: 'database', icon: Database, label: 'Database' },
  { type: 'cloud', icon: Cloud, label: 'Cloud' },
  { type: 'internet', icon: Globe, label: 'Internet' },
  { type: 'generic', icon: Circle, label: 'Generico / Altro' },
  { type: 'workstation', icon: Monitor, label: 'Workstation' }
];

/**
 * Restituisce il componente icona per un device_type (stessa lista della Mappatura).
 * @param {string} deviceType - es. 'server', 'pc', 'router'
 * @param {number} size - dimensione in px (default 18)
 * @param {string} className - classi Tailwind opzionali
 */
export function getDeviceIcon(deviceType, size = 18, className = 'text-gray-600') {
  const t = (deviceType || '').toLowerCase().trim();
  const def = AVAILABLE_ICONS.find(i => i.type === t) || AVAILABLE_ICONS.find(i => i.type === 'pc');
  const Icon = def ? def.icon : Monitor;
  if (t === 'generic' || t === '') {
    return <Circle size={size} className={`${className} opacity-50`} strokeWidth={1.5} />;
  }
  return <Icon size={size} className={className} strokeWidth={1.5} />;
}
