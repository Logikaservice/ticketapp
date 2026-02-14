// Menu sandwich per navigazione tra sezioni (Email, Office, Anti-Virus, Monitoraggio Rete, Mappatura)
// Esclude sempre "Nuove funzionalità" e "Impostazioni"

import React, { useState, useRef, useEffect } from 'react';
import { Menu, Building2, Mail, Shield, Wifi, MapPin, Home } from 'lucide-react';

const SectionNavMenu = ({
  currentPage,
  onNavigateHome,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  currentUser
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
    { id: 'email', label: 'Email', icon: Mail, onClick: onNavigateEmail, visible: !!onNavigateEmail },
    { id: 'antivirus', label: 'Anti-Virus', icon: Shield, onClick: onNavigateAntiVirus, visible: !!onNavigateAntiVirus },
    { id: 'network', label: 'Monitoraggio Rete', icon: Wifi, onClick: onNavigateNetworkMonitoring, visible: !!onNavigateNetworkMonitoring },
    { id: 'mappatura', label: 'Mappatura', icon: MapPin, onClick: onNavigateMappatura, visible: !!onNavigateMappatura }
  ].filter(item => item.visible && item.id !== currentPage);
  const items = [...homeItem, ...sectionItems];

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
        title="Menu di navigazione"
      >
        <Menu size={20} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[9999]">
          {items.map(({ id, label, icon: Icon, onClick }) => (
            <button
              key={id}
              onClick={() => {
                onClick?.();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition"
            >
              <Icon size={18} className="text-gray-500" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SectionNavMenu;
