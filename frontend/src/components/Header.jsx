// src/components/Header.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Plus, LogOut, Settings, Users, UserPlus, List, Sparkles, Key, BarChart3, Activity, Clock, FolderOpen, Calendar, Volume2, Monitor, FileText, Table, Wifi, Server as ServerIcon, MapPin, Shield, AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';
import AgentNotifications from './AgentNotifications';

const Header = ({ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal, openAlertsHistory, openAnalytics, openAccessLogs, openInactivityTimer, openOrariTurni, openVivaldi = null, openPackVision, openCreateContract, openContractsList, openNetworkMonitoring, openNetworkMonitoringAgents, openNetworkMonitoringCreateAgent, openNetworkMonitoringDeviceTypes, openNetworkMonitoringNotifications, openNetworkMonitoringTelegram, openMappatura, openAntiVirus, isOrariDomain = false, getAuthHeader = null, socket = null }) => {
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [expandedAction, setExpandedAction] = useState(null);
  const [expandedSubAction, setExpandedSubAction] = useState(null); // Per sottomenù annidati
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
        setExpandedSubAction(null);
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
      else if (action === 'analytics') openAnalytics();
      else if (action === 'settings') openSettings();
      else if (action === 'accessLogs') openAccessLogs();
      else if (action === 'networkMonitoring') {
        if (openNetworkMonitoring) {
          openNetworkMonitoring();
          setShowQuickActions(false);
          setExpandedAction(null);
        }

      } else if (action === 'mappatura') {
        window.dispatchEvent(new CustomEvent('open-mappatura'));
        setShowQuickActions(false);
        setExpandedAction(null);
      } else if (action === 'antivirus') {
        if (openAntiVirus) {
          openAntiVirus();
          setShowQuickActions(false);
          setExpandedAction(null);
        }
      }
      setShowQuickActions(false);
      setExpandedAction(null);
    }
  };

  // Versione sicura per visualizzare il ruolo
  const userRole = (currentUser?.ruolo || '').toUpperCase();
  const roleClasses = currentUser?.ruolo === 'cliente'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-green-100 text-green-800';

  // Verifica se l'utente è un amministratore aziendale
  const isCompanyAdmin = currentUser?.ruolo === 'cliente' &&
    currentUser?.admin_companies &&
    Array.isArray(currentUser.admin_companies) &&
    currentUser.admin_companies.length > 0;

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
      color: 'blue',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico',
      hasSubActions: true,
      subActions: [
        { label: 'Nuovo Cliente', icon: UserPlus, color: 'emerald', onClick: openNewClientModal },
        { label: 'Gestisci Clienti', icon: List, color: 'sky', onClick: openManageClientsModal }
      ]
    },
    {
      id: 'contracts',
      label: 'Gestione Contratti',
      icon: FileText,
      color: 'rose',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico',
      hasSubActions: true,
      subActions: [
        { label: 'Nuovo Contratto', icon: Plus, color: 'emerald', onClick: openCreateContract },
        { label: 'Lista Contratti', icon: Table, color: 'sky', onClick: openContractsList }
      ]
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
      color: 'sky',
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
      color: 'slate',
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
      id: 'antivirus',
      label: 'Anti-Virus',
      icon: Shield,
      color: 'indigo',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico',
      onClick: () => handleQuickActionClick('antivirus')
    },
    {
      id: 'networkMonitoring',
      label: 'Monitoraggio Rete',
      icon: Wifi,
      color: 'cyan',
      visible: !isOrariDomain && (currentUser?.ruolo === 'tecnico' || isCompanyAdmin) && openNetworkMonitoring,
      hasSubActions: true,
      subActions: [
        { label: 'Dashboard Monitoraggio', icon: Wifi, color: 'cyan', onClick: () => { if (openNetworkMonitoring) { openNetworkMonitoring(); setShowQuickActions(false); setExpandedAction(null); } } },
        { label: 'Mappatura', icon: MapPin, color: 'emerald', onClick: () => { if (openMappatura) { openMappatura(); setShowQuickActions(false); setExpandedAction(null); } } },
        { 
          label: 'Agent', 
          icon: ServerIcon, 
          color: 'cyan',
          hasSubActions: true,
          subActions: [
            { label: 'Agent Esistenti', icon: ServerIcon, color: 'cyan', onClick: () => { if (openNetworkMonitoringAgents) { openNetworkMonitoringAgents(); setShowQuickActions(false); setExpandedAction(null); } } },
            { label: 'Notifiche Agent', icon: AlertTriangle, color: 'yellow', onClick: () => { if (openNetworkMonitoringNotifications) { openNetworkMonitoringNotifications(); setShowQuickActions(false); setExpandedAction(null); } } },
            { label: 'Crea Agent', icon: Plus, color: 'cyan', onClick: () => { if (openNetworkMonitoringCreateAgent) { openNetworkMonitoringCreateAgent(); setShowQuickActions(false); setExpandedAction(null); } } }
          ]
        },
        { label: 'Notifiche Telegram', icon: AlertCircle, color: 'blue', onClick: () => { if (openNetworkMonitoringTelegram) { openNetworkMonitoringTelegram(); setShowQuickActions(false); setExpandedAction(null); } } }
      ]
    },
    {
      id: 'progetti',
      label: 'Progetti',
      icon: FolderOpen,
      color: 'indigo',
      visible: !isOrariDomain && currentUser?.ruolo === 'tecnico',
      hasSubActions: true,
      subActions: [
        { label: 'Orari e Turni', icon: Calendar, color: 'indigo', onClick: openOrariTurni },
        { label: 'Vivaldi', icon: Volume2, color: 'indigo', onClick: openVivaldi || (() => window.location.href = '/?domain=vivaldi') },
        { label: 'PackVision', icon: Monitor, color: 'indigo', onClick: openPackVision }
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

            {!isOrariDomain && currentUser?.ruolo === 'tecnico' && getAuthHeader && (
              <AgentNotifications
                getAuthHeader={getAuthHeader}
                socket={socket}
                onOpenNetworkMonitoring={openNetworkMonitoringAgents}
              />
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
              violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
              teal: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
              rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
              slate: 'bg-slate-50 text-slate-700 hover:bg-slate-100'
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
                violet: 'bg-violet-100 text-violet-600',
                teal: 'bg-teal-100 text-teal-600',
                rose: 'bg-rose-100 text-rose-600',
                slate: 'bg-slate-100 text-slate-600'
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
                violet: 'text-violet-600',
                teal: 'text-teal-600',
                rose: 'text-rose-600',
                slate: 'text-slate-600'
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
                      const subActionKey = `${action.id}-${idx}`;
                      const isSubActionExpanded = expandedSubAction === subActionKey;
                      
                      return (
                        <div key={idx}>
                          <button
                            onClick={() => {
                              if (subAction.hasSubActions) {
                                // Se ha sottomenù, espandi/contrai
                                setExpandedSubAction(isSubActionExpanded ? null : subActionKey);
                              } else if (subAction.onClick) {
                                // Se ha onClick, esegui e chiudi menu
                                subAction.onClick();
                                setShowQuickActions(false);
                                setExpandedAction(null);
                                setExpandedSubAction(null);
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${colorClasses[subAction.color]}`}
                          >
                            <SubIcon size={16} className={getIconTextClass(subAction.color)} />
                            <span className="text-sm flex-1">{subAction.label}</span>
                            {subAction.hasSubActions && (
                              <ChevronRight size={14} className={`transition-transform ${isSubActionExpanded ? 'rotate-90' : ''}`} />
                            )}
                          </button>
                          
                          {/* Sottomenù annidati */}
                          {subAction.hasSubActions && isSubActionExpanded && subAction.subActions && (
                            <div className="ml-4 border-l-2 border-gray-300 pl-2">
                              {subAction.subActions.map((nestedAction, nestedIdx) => {
                                const NestedIcon = nestedAction.icon;
                                return (
                                  <button
                                    key={nestedIdx}
                                    onClick={() => {
                                      if (nestedAction.onClick) {
                                        nestedAction.onClick();
                                        setShowQuickActions(false);
                                        setExpandedAction(null);
                                        setExpandedSubAction(null);
                                      }
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${colorClasses[nestedAction.color]}`}
                                  >
                                    <NestedIcon size={14} className={getIconTextClass(nestedAction.color)} />
                                    <span className="text-sm">{nestedAction.label}</span>
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
          })}
        </div>
      )}
    </div>
  );
};

export default Header;
