// src/components/Header.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Plus, LogOut, Settings, Users, UserPlus, List, Sparkles, Key, BarChart3, Activity, Clock, FolderOpen, Calendar, Volume2, Monitor } from 'lucide-react';

const Header = ({ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal, openAlertsHistory, openImportKeepass, openAnalytics, openAccessLogs, openInactivityTimer, openOrariTurni, openPackVision, isOrariDomain = false }) => {
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [expandedAction, setExpandedAction] = useState(null);
  const menuRef = useRef(null);
  const quickActionsRef = useRef(null);

  // Chiudi i menu quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowClientMenu(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target)) {
        setShowQuickActions(false);
        setExpandedAction(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gestione click su azioni rapide
  const handleQuickActionClick = (action, hasSubActions = false) => {
    if (hasSubActions) {
      setExpandedAction(expandedAction === action ? null : action);
    } else {
      if (action === 'alerts') openAlertsHistory();
      else if (action === 'importKeepass') openImportKeepass();
      else if (action === 'analytics') openAnalytics();
      else if (action === 'settings') openSettings();
      else if (action === 'accessLogs') openAccessLogs();
      setShowQuickActions(false);
      setExpandedAction(null);
    }
  };

  // Versione sicura per visualizzare il ruolo
  const userRole = (currentUser?.ruolo || '').toUpperCase();
  const roleClasses = currentUser?.ruolo === 'cliente'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-green-100 text-green-800';

  // Azioni rapide disponibili
  const quickActions = [
    {
      id: 'alerts',
      label: 'Nuove funzionalità',
      icon: Sparkles,
      color: 'emerald',
      visible: !isOrariDomain && (currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'cliente'),
      onClick: () => handleQuickActionClick('alerts')
    },
    {
      id: 'clients',
      label: 'Gestione Clienti',
      icon: Users,
      color: 'cyan',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico',
      hasSubActions: true,
      subActions: [
        { label: 'Nuovo Cliente', icon: UserPlus, color: 'emerald', onClick: openNewClientModal },
        { label: 'Gestisci Clienti', icon: List, color: 'sky', onClick: openManageClientsModal }
      ]
    },
    {
      id: 'importKeepass',
      label: 'Importa KeePass',
      icon: Key,
      color: 'indigo',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico' && openImportKeepass,
      onClick: () => handleQuickActionClick('importKeepass')
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      color: 'purple',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico' && openAnalytics,
      onClick: () => handleQuickActionClick('analytics')
    },
    {
      id: 'inactivityTimer',
      label: 'Timer Inattività',
      icon: Clock,
      color: 'blue',
      visible: !isOrariDomain && currentUser?.ruolo === 'cliente' && openInactivityTimer,
      onClick: () => {
        if (openInactivityTimer) {
          openInactivityTimer();
          setShowQuickActions(false);
          setExpandedAction(null);
        }
      }
    },
    {
      id: 'settings',
      label: 'Impostazioni',
      icon: Settings,
      color: 'amber',
      visible: true,
      onClick: () => handleQuickActionClick('settings')
    },
    {
      id: 'accessLogs',
      label: 'Log accessi',
      icon: Activity,
      color: 'orange',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico' && openAccessLogs,
      onClick: () => handleQuickActionClick('accessLogs')
    },
    {
      id: 'progetti',
      label: 'Progetti',
      icon: FolderOpen,
      color: 'violet',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico',
      hasSubActions: true,
      subActions: [
        { label: 'Orari e Turni', icon: Calendar, color: 'violet', onClick: openOrariTurni },
        { label: 'Vivaldi', icon: Volume2, color: 'violet', onClick: () => window.location.href = '/?domain=vivaldi' },
        { label: 'PackVision', icon: Monitor, color: 'violet', onClick: openPackVision }
      ]
    }
  ].filter(action => action.visible);

  return (
    <div className="bg-white border-b relative">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Pulsante Pannello Rapido */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Pannello rapido"
            >
              <List size={20} />
            </button>

            <div>
              <h1 className="text-2xl font-bold">{isOrariDomain ? 'Gestione Orari e Turni' : 'Sistema Gestione Ticket'}</h1>
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
            {!isOrariDomain && currentUser?.ruolo === 'cliente' && (
              <button
                onClick={openNewTicketModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Nuovo Ticket
              </button>
            )}

            {!isOrariDomain && currentUser?.ruolo === 'tecnico' && (
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

      {/* Pannello Rapido Laterale */}
      {showQuickActions && (
        <div
          ref={quickActionsRef}
          className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50"
        >
          {quickActions.map((action) => {
            const Icon = action.icon;
            const colorClasses = {
              emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
              cyan: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
              indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
              purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
              amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
              orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
              sky: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
              blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
              violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100'
            };

            const getIconBgClass = (color) => {
              const classes = {
                emerald: 'bg-emerald-100 text-emerald-600',
                cyan: 'bg-cyan-100 text-cyan-600',
                indigo: 'bg-indigo-100 text-indigo-600',
                purple: 'bg-purple-100 text-purple-600',
                amber: 'bg-amber-100 text-amber-600',
                orange: 'bg-orange-100 text-orange-600',
                sky: 'bg-sky-100 text-sky-600',
                blue: 'bg-blue-100 text-blue-600',
                violet: 'bg-violet-100 text-violet-600'
              };
              return classes[color] || 'bg-gray-100 text-gray-600';
            };

            const getIconTextClass = (color) => {
              const classes = {
                emerald: 'text-emerald-600',
                cyan: 'text-cyan-600',
                indigo: 'text-indigo-600',
                purple: 'text-purple-600',
                amber: 'text-amber-600',
                orange: 'text-orange-600',
                sky: 'text-sky-600',
                blue: 'text-blue-600',
                violet: 'text-violet-600'
              };
              return classes[color] || 'text-gray-600';
            };

            return (
              <div key={action.id}>
                <button
                  onClick={() => action.onClick ? action.onClick() : handleQuickActionClick(action.id, action.hasSubActions)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${colorClasses[action.color]}`}
                >
                  <div className={`p-2 rounded-lg ${getIconBgClass(action.color)}`}>
                    <Icon size={18} />
                  </div>
                  <span className="font-medium">{action.label}</span>
                </button>

                {/* Sotto-azioni (es. Gestione Clienti) */}
                {action.hasSubActions && expandedAction === action.id && (
                  <div className="ml-4 border-l-2 border-gray-200 pl-2">
                    {action.subActions.map((subAction, idx) => {
                      const SubIcon = subAction.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            subAction.onClick();
                            setShowQuickActions(false);
                            setExpandedAction(null);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${colorClasses[subAction.color]}`}
                        >
                          <SubIcon size={16} className={getIconTextClass(subAction.color)} />
                          <span className="text-sm">{subAction.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Header;
