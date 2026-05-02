// Menu sandwich per navigazione tra sezioni (Email, Office, Anti-Virus, Monitoraggio Rete, Mappatura)
// Esclude sempre "Nuove funzionalità" e "Impostazioni"

import React, { useState, useRef, useEffect } from 'react';
import { Menu, Building2, Mail, Shield, Wifi, MapPin, Home, Monitor, Gauge, Eye, LockKeyhole } from 'lucide-react';

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
  onNavigateLSight,
  onNavigateVpn,
  currentUser,
  selectedCompanyId = null,
  /** Su sfondo scuro Hub (moduli embedded nel workbench). */
  embedded = false
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const isCompanyAdmin = currentUser?.ruolo === 'cliente' &&
    currentUser?.admin_companies &&
    Array.isArray(currentUser.admin_companies) &&
    currentUser.admin_companies.length > 0;
  const isTecnicoOrAdmin = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const hasAccess = isTecnicoOrAdmin || isCompanyAdmin;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!hasAccess) return null;

  const homeItem = onNavigateHome ? [{ id: 'home', label: 'Home', icon: Home, onClick: onNavigateHome }] : [];
  const sectionItems = [
    { id: 'office', label: 'Office', icon: Building2, onClick: onNavigateOffice, visible: !!onNavigateOffice },
    { id: 'vpn', label: 'VPN', icon: LockKeyhole, onClick: onNavigateVpn, visible: currentUser?.ruolo === 'tecnico' && !!onNavigateVpn },
    { id: 'email', label: 'Email', icon: Mail, onClick: onNavigateEmail, visible: !!onNavigateEmail },
    { id: 'antivirus', label: 'Anti-Virus', icon: Shield, onClick: onNavigateAntiVirus, visible: !!onNavigateAntiVirus },
    { id: 'lsight', label: 'L-Sight', icon: Eye, onClick: onNavigateLSight, visible: !!onNavigateLSight },
    { id: 'dispositivi-aziendali', label: 'Dispositivi aziendali', icon: Monitor, onClick: onNavigateDispositiviAziendali, visible: !!onNavigateDispositiviAziendali },
    { id: 'speedtest', label: 'Speed Test', icon: Gauge, onClick: onNavigateSpeedTest, visible: isTecnicoOrAdmin && !!onNavigateSpeedTest },
    { id: 'network', label: 'Monitoraggio Rete', icon: Wifi, onClick: onNavigateNetworkMonitoring, visible: !!onNavigateNetworkMonitoring },
    { id: 'mappatura', label: 'Mappatura', icon: MapPin, onClick: onNavigateMappatura, visible: !!onNavigateMappatura }
  ].filter(item => item.visible && item.id !== currentPage);
  const items = [...homeItem, ...sectionItems];

  if (items.length === 0) return null;

  return (
    <div className="relative mr-2 inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className={
          embedded
            ? 'flex items-center justify-center rounded-lg border border-white/[0.12] bg-black/28 p-2 text-white/75 transition-colors hover:bg-white/[0.08] hover:text-[color:var(--hub-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)]'
            : 'flex items-center justify-center rounded-lg border border-transparent p-2 text-gray-600 transition-colors hover:border-gray-200 hover:bg-gray-100'
        }
        title="Menu di navigazione"
      >
        <Menu size={22} />
      </button>
      {open && (
        <div
          className={
            embedded
              ? 'absolute left-0 top-full z-[99999] mt-1 w-56 rounded-xl border border-white/[0.12] bg-[#1e1e1e] py-2 shadow-2xl'
              : 'absolute left-0 top-full z-[99999] mt-1 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-2xl'
          }
        >
          <div
            className={
              embedded
                ? 'mb-1 border-b border-white/[0.08] px-3 py-1.5'
                : 'mb-1 border-b border-gray-100 px-3 py-1.5'
            }
          >
            <span className={`text-[10px] font-bold uppercase tracking-widest ${embedded ? 'text-white/40' : 'text-gray-400'}`}>Navigazione</span>
          </div>
          {items.map(({ id, label, icon: Icon, onClick }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onClick?.(selectedCompanyId);
                setOpen(false);
              }}
              className={
                embedded
                  ? 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-white/88 transition-colors hover:bg-white/[0.06] hover:text-[color:var(--hub-accent)]'
                  : 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:text-blue-600'
              }
            >
              <Icon size={18} className={embedded ? 'text-white/45' : 'text-gray-400'} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SectionNavMenu;

