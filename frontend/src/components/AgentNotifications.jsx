// src/components/AgentNotifications.jsx

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle, RefreshCw, WifiOff, Wifi, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const AgentNotifications = ({ getAuthHeader, socket, onOpenNetworkMonitoring, hubTone = false }) => {
  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const wsDebounceRef = useRef(null); // Debounce per eventi WebSocket

  // Carica eventi dal backend
  const loadEvents = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const response = await fetch(buildApiUrl('/api/network-monitoring/agent-events?limit=20'), {
        headers: getAuthHeader(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Errore caricamento eventi agent:', err);
      }
    }
  };

  // Carica conteggio non letti
  const loadUnreadCount = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const response = await fetch(buildApiUrl('/api/network-monitoring/agent-events/unread-count'), {
        headers: getAuthHeader(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Errore caricamento conteggio non letti:', err);
      }
    }
  };

  // Marca evento come letto
  const markAsRead = async (eventId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent-events/${eventId}/read`), {
        method: 'POST',
        headers: getAuthHeader()
      });
      if (response.ok) {
        loadEvents();
        loadUnreadCount();
        try {
          window.dispatchEvent(new CustomEvent('agent-notifications-updated'));
        } catch { }
      }
    } catch (err) {
      console.error('Errore marcatura evento come letto:', err);
    }
  };

  // "Pulisci" nel triangolo: segna tutte come lette e svuota il popup (non cancella lo storico)
  const clearAllNotifications = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/agent-events/clear'), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (response.ok) {
        setEvents([]);
        setUnreadCount(0);
        try {
          window.dispatchEvent(new CustomEvent('agent-notifications-updated'));
        } catch { }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Errore cancellazione notifiche' }));
        alert(errorData.error || 'Errore cancellazione notifiche');
      }
    } catch (err) {
      console.error('Errore cancellazione notifiche:', err);
      alert('Errore cancellazione notifiche: ' + err.message);
    }
  };

  // Formatta data
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Ottieni icona e colore per tipo evento
  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'offline':
        return { icon: WifiOff, color: 'text-red-600', bg: 'bg-red-100' };
      case 'online':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
      case 'reboot':
        return { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'network_issue':
        return { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100' };
      default:
        return { icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  // Ottieni messaggio per tipo evento
  const getEventMessage = (event) => {
    const eventData = event.event_data ? (typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data) : {};

    switch (event.event_type) {
      case 'offline':
        const offlineDuration = eventData.offline_duration_minutes || 0;
        return `Agent ${event.agent_name || event.agent_id} offline${offlineDuration > 0 ? ` (da ${offlineDuration} min)` : ''}`;
      case 'online':
        const onlineDuration = eventData.offline_duration_minutes || 0;
        return `Agent ${event.agent_name || event.agent_id} tornato online${onlineDuration > 0 ? ` (era offline da ${onlineDuration} min)` : ''}`;
      case 'reboot':
        const uptime = eventData.system_uptime_minutes || 'N/A';
        return `Agent ${event.agent_name || event.agent_id} riavviato (uptime: ${uptime} min)`;
      case 'network_issue':
        const issueDuration = eventData.issue_duration_minutes || 0;
        return `Agent ${event.agent_name || event.agent_id} - problema rete (durata: ${issueDuration} min)`;
      default:
        return `Evento sconosciuto per agent ${event.agent_name || event.agent_id}`;
    }
  };

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carica eventi al mount e periodicamente
  useEffect(() => {
    loadEvents();
    loadUnreadCount();
    const interval = setInterval(() => {
      loadEvents();
      loadUnreadCount();
    }, 30000); // Aggiorna ogni 30 secondi
    return () => clearInterval(interval);
  }, []);

  // Ascolta eventi WebSocket (con debounce 2s per evitare raffica di chiamate API)
  useEffect(() => {
    if (socket) {
      const handleAgentEvent = () => {
        // Debounce: aspetta 2 secondi dall'ultimo evento prima di ricaricare
        if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
        wsDebounceRef.current = setTimeout(() => {
          loadEvents();
          loadUnreadCount();
        }, 2000);
      };
      socket.on('agent-event', handleAgentEvent);
      return () => {
        socket.off('agent-event', handleAgentEvent);
        if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
      };
    }
  }, [socket]);

  // Aggiornamento cross-component (es. quando si segna tutto come letto nella pagina Monitoraggio Rete)
  useEffect(() => {
    const handler = () => {
      loadEvents();
      loadUnreadCount();
    };
    window.addEventListener('agent-notifications-updated', handler);
    return () => window.removeEventListener('agent-notifications-updated', handler);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={
          hubTone
            ? 'relative rounded-xl border border-white/[0.12] bg-black/35 p-2 text-white/80 transition hover:border-[color:var(--hub-accent-border)] hover:bg-white/[0.06]'
            : 'relative rounded-lg p-2 text-gray-700 transition hover:bg-gray-100'
        }
        title="Notifiche Agent"
      >
        <AlertTriangle
          size={20}
          className={
            unreadCount > 0
              ? hubTone
                ? 'text-amber-400'
                : 'text-yellow-600'
              : hubTone
                ? 'text-white/55'
                : 'text-gray-600'
          }
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          className={`absolute left-0 top-full z-[9999] mt-2 max-h-96 w-96 overflow-y-auto rounded-xl border shadow-2xl ${
            hubTone
              ? 'border-white/[0.12] bg-[#252525] text-white/90'
              : 'border border-gray-200 bg-white'
          }`}
        >
          <div className={`flex items-center justify-between border-b p-4 ${hubTone ? 'border-white/[0.1]' : 'border-gray-200'}`}>
            <h3 className={`font-semibold ${hubTone ? 'text-white' : 'text-gray-900'}`}>Notifiche Agent</h3>
            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className={
                    hubTone
                      ? 'rounded p-1 text-red-400 transition hover:bg-red-500/20 hover:text-red-200'
                      : 'rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700'
                  }
                  title="Pulisci tutte le notifiche"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className={
                  hubTone ? 'rounded p-1 text-white/50 hover:text-white' : 'rounded p-1 text-gray-400 hover:text-gray-600'
                }
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className={`p-8 text-center ${hubTone ? 'text-white/45' : 'text-gray-500'}`}>Nessun evento</div>
          ) : (
            <div className={hubTone ? 'divide-y divide-white/[0.08]' : 'divide-y divide-gray-200'}>
              {events.map((event) => {
                const { icon: Icon, color, bg } = getEventIcon(event.event_type);
                const isUnread = !event.is_read;

                return (
                  <div
                    key={event.id}
                    className={`cursor-pointer p-4 transition ${
                      hubTone
                        ? `hover:bg-white/[0.05] ${isUnread ? 'bg-sky-500/12' : ''}`
                        : `hover:bg-gray-50 ${isUnread ? 'bg-blue-50' : ''}`
                    }`}
                    onClick={() => {
                      if (!event.is_read) {
                        markAsRead(event.id);
                      }
                      if (onOpenNetworkMonitoring) {
                        onOpenNetworkMonitoring();
                        setShowDropdown(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${bg}`}>
                        <Icon size={18} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'} ${hubTone ? 'text-white/92' : 'text-gray-900'}`}
                        >
                          {getEventMessage(event)}
                        </p>
                        <p className={`mt-1 text-xs ${hubTone ? 'text-white/45' : 'text-gray-500'}`}>
                          {formatDate(event.detected_at)}
                          {event.azienda && ` • ${event.azienda}`}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentNotifications;
