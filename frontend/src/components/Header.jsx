// src/components/Header.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Plus, LogOut, Settings, Users, UserPlus, List, Sparkles, Key, BarChart3 } from 'lucide-react';

const Header = ({ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal, openAlertsHistory, openImportKeepass, openAnalytics }) => {
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [expandedAction, setExpandedAction] = useState(null);
  const menuRef = useRef(null);
  const quickPanelRef = useRef(null);

  // Chiudi il menu quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowClientMenu(false);
      }
      if (
        showQuickActions &&
        quickPanelRef.current &&
        !quickPanelRef.current.contains(event.target) &&
        !event.target.closest('#quick-actions-toggle')
      ) {
        setShowQuickActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickActions]);

  // Versione sicura per visualizzare il ruolo
  const userRole = (currentUser?.ruolo || '').toUpperCase();
  const roleClasses = currentUser?.ruolo === 'cliente' 
    ? 'bg-blue-100 text-blue-800' 
    : 'bg-green-100 text-green-800';

  const quickActions = [
    {
      label: 'Nuove funzionalità',
      description: 'Storico aggiornamenti',
      icon: Sparkles,
      iconWrapperClass: 'text-emerald-600 bg-emerald-50',
      rowClass: 'hover:bg-emerald-50/80 border-l-4 border-l-emerald-400',
      action: openAlertsHistory,
      visible: typeof openAlertsHistory === 'function'
    },
    {
      label: 'Gestione Clienti',
      description: 'Nuovo cliente o elenco completo',
      icon: Users,
      iconWrapperClass: 'text-cyan-600 bg-cyan-50',
      rowClass: 'hover:bg-cyan-50/80 border-l-4 border-l-cyan-400',
      action: () => {},
      subActions: [
        {
          label: 'Nuovo Cliente',
          description: 'Crea un nuovo profilo',
          icon: UserPlus,
          colorClass: 'text-emerald-600',
          action: openNewClientModal
        },
        {
          label: 'Gestisci Clienti',
          description: 'Apri elenco completo',
          icon: List,
          colorClass: 'text-sky-600',
          action: openManageClientsModal
        }
      ],
      visible: currentUser?.ruolo === 'tecnico' &&
        typeof openManageClientsModal === 'function' &&
        typeof openNewClientModal === 'function'
    },
    {
      label: 'Importa KeePass',
      description: 'Gestione credenziali',
      icon: Key,
      iconWrapperClass: 'text-indigo-600 bg-indigo-50',
      rowClass: 'hover:bg-indigo-50/80 border-l-4 border-l-indigo-400',
      action: openImportKeepass,
      visible: currentUser?.ruolo === 'tecnico' && typeof openImportKeepass === 'function'
    },
    {
      label: 'Analytics',
      description: 'Statistiche avanzate',
      icon: BarChart3,
      iconWrapperClass: 'text-purple-600 bg-purple-50',
      rowClass: 'hover:bg-purple-50/80 border-l-4 border-l-purple-400',
      action: openAnalytics,
      visible: currentUser?.ruolo === 'tecnico' && typeof openAnalytics === 'function'
    },
    {
      label: 'Impostazioni',
      description: 'Preferenze account',
      icon: Settings,
      iconWrapperClass: 'text-amber-600 bg-amber-50',
      rowClass: 'hover:bg-amber-50/80 border-l-4 border-l-amber-400',
      action: openSettings,
      visible: typeof openSettings === 'function'
    }
  ].filter(item => item.visible);

  const handleQuickActionClick = (item) => {
    if (item.subActions && item.subActions.length > 0) {
      setExpandedAction(prev => (prev === item.label ? null : item.label));
      return;
    }

    if (typeof item.action === 'function') {
      item.action();
      setShowQuickActions(false);
    }
  };

  return (
    <div className="bg-white border-b relative">
      {showQuickActions && (
        <div
          ref={quickPanelRef}
          className="fixed top-28 left-6 z-50"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-100 w-72 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-5 py-4">
              <p className="text-xs uppercase tracking-widest opacity-80">Pannello rapido</p>
              <p className="text-lg font-semibold mt-1">Azioni principali</p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100">
              {quickActions.map((item) => {
                const { label, description, icon: Icon, iconWrapperClass, rowClass } = item;
                const isExpanded = expandedAction === label;
                return (
                  <div key={label}>
                    <button
                      onClick={() => handleQuickActionClick(item)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition ${rowClass}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold ${iconWrapperClass}`}>
                        <Icon size={22} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                      <div className="text-gray-400">
                        {item.subActions && item.subActions.length > 0 && (
                          <span className="text-xs font-semibold">{isExpanded ? '−' : '+'}</span>
                        )}
                      </div>
                    </button>
                    {item.subActions && item.subActions.length > 0 && isExpanded && (
                      <div className="px-5 pb-4 pt-0 space-y-3 bg-white/70">
                        {item.subActions.map((sub) => (
                          <button
                            key={sub.label}
                            onClick={() => {
                              if (typeof sub.action === 'function') {
                                sub.action();
                                setShowQuickActions(false);
                                setExpandedAction(null);
                              }
                            }}
                            className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-2xl px-4 py-3 transition"
                          >
                            <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow text-lg ${sub.colorClass}`}>
                              <sub.icon size={20} />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-semibold text-gray-800">{sub.label}</p>
                              <p className="text-xs text-gray-500">{sub.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <button
              id="quick-actions-toggle"
              onClick={() => setShowQuickActions(!showQuickActions)}
              className={`mt-1 p-2 rounded-xl border transition ${showQuickActions ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              title="Pannello rapido"
            >
              <List size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Sistema Gestione Ticket</h1>
              <p className="text-sm text-gray-600 mt-1">
                {/* --- CODICE CORRETTO --- */}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleClasses}`}>
                  {userRole}
                </span>
                {/* Controlla che currentUser esista prima di accedere alle sue proprietà */}
                <span className="ml-2">{currentUser?.nome} - {currentUser?.azienda}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {currentUser?.ruolo === 'cliente' && (
              <button 
                onClick={openNewTicketModal} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Nuovo Ticket
              </button>
            )}
            
            {currentUser?.ruolo === 'tecnico' && (
              <button 
                onClick={openNewTicketModal} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Nuovo Ticket
              </button>
            )}
            
            <button 
              onClick={handleLogout} 
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
