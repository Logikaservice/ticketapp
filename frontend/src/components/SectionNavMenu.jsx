// Menu di navigazione tra sezioni (Email, Office, Anti-Virus, Monitoraggio Rete, Mappatura)
// Mostra icone orizzontali per navigazione rapida se c'è spazio, altrimenti sandwich su mobile

import React from 'react';
import { Building2, Mail, Shield, Wifi, MapPin, Home, Monitor, Gauge } from 'lucide-react';

const SectionNavMenu = ({
  currentPage,
  onNavigateHome,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateDispositiviAziendali,
  onNavigateSpeedTest,
  currentUser,
  selectedCompanyId = null
}) => {
  const isCompanyAdmin = currentUser?.ruolo === 'cliente' &&
    currentUser?.admin_companies &&
    Array.isArray(currentUser.admin_companies) &&
    currentUser.admin_companies.length > 0;
  const isTecnicoOrAdmin = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const hasAccess = isTecnicoOrAdmin || isCompanyAdmin;

  if (!hasAccess) return null;

  const allItems = [
    { id: 'home', label: 'Home', icon: Home, onClick: onNavigateHome, visible: !!onNavigateHome, color: 'text-gray-500' },
    { id: 'office', label: 'Office', icon: Building2, onClick: onNavigateOffice, visible: !!onNavigateOffice, color: 'text-slate-600' },
    { id: 'email', label: 'Email', icon: Mail, onClick: onNavigateEmail, visible: !!onNavigateEmail, color: 'text-blue-600' },
    { id: 'antivirus', label: 'Anti-Virus', icon: Shield, onClick: onNavigateAntiVirus, visible: !!onNavigateAntiVirus, color: 'text-red-600' },
    { id: 'dispositivi-aziendali', label: 'Dispositivi', icon: Monitor, onClick: onNavigateDispositiviAziendali, visible: !!onNavigateDispositiviAziendali, color: 'text-teal-600' },
    { id: 'speedtest', label: 'Speed Test', icon: Gauge, onClick: onNavigateSpeedTest, visible: isTecnicoOrAdmin && !!onNavigateSpeedTest, color: 'text-purple-600' },
    { id: 'network', label: 'Monitoraggio', icon: Wifi, onClick: onNavigateNetworkMonitoring, visible: !!onNavigateNetworkMonitoring, color: 'text-emerald-600' },
    { id: 'mappatura', label: 'Mappatura', icon: MapPin, onClick: onNavigateMappatura, visible: !!onNavigateMappatura, color: 'text-indigo-600' }
  ].filter(item => item.visible);

  return (
    <nav className="flex items-center gap-1 sm:gap-1.5 py-1 px-1 bg-gray-50/50 rounded-xl border border-gray-100/50 w-fit">
      {allItems.map(({ id, label, icon: Icon, onClick, color }) => {
        const isActive = id === currentPage;
        if (isActive) return null;

        return (
          <button
            key={id}
            onClick={() => onClick?.(selectedCompanyId)}
            className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-white hover:shadow-sm ${color} whitespace-nowrap`}
            title={label}
          >
            <Icon size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default SectionNavMenu;

