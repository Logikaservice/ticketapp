// src/components/AgentNotifications.jsx

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle, RefreshCw, WifiOff, Wifi } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const AgentNotifications = ({ getAuthHeader, socket, onOpenNetworkMonitoring }) => {
  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Carica eventi dal backend
  const loadEvents = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/agent-events?limit=20'), {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Errore caricamento eventi agent:', err);
    }
  };

  // Carica conteggio non letti
  const loadUnreadCount = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/agent-events/unread-count'), {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (err) {
      console.error('Errore caricamento conteggio non letti:', err);
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
      }
    } catch (err) {
      console.error('Errore marcatura evento come letto:', err);
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

  // Ascolta eventi WebSocket
  useEffect(() => {
    if (socket) {
      const handleAgentEvent = (data) => {
        loadEvents();
        loadUnreadCount();
      };
      socket.on('agent-event', handleAgentEvent);
      return () => {
        socket.off('agent-event', handleAgentEvent);
      };
    }
  }, [socket]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
        title="Notifiche Agent"
      >
        <AlertTriangle size={20} className={unreadCount > 0 ? 'text-yellow-600' : 'text-gray-600'} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifiche Agent</h3>
            <button
              onClick={() => setShowDropdown(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nessun evento
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => {
                const { icon: Icon, color, bg } = getEventIcon(event.event_type);
                const isUnread = !event.is_read;

                return (
                  <div
                    key={event.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition ${isUnread ? 'bg-blue-50' : ''}`}
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
                        <p className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                          {getEventMessage(event)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
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
