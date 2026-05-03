import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, WifiOff } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

export function getAgentEventVisual(eventType) {
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
}

export function getAgentEventMessage(event) {
  let eventData = {};
  try {
    eventData =
      event.event_data != null
        ? typeof event.event_data === 'string'
          ? JSON.parse(event.event_data)
          : event.event_data
        : {};
  } catch (_) {
    eventData = {};
  }

  switch (event.event_type) {
    case 'offline': {
      const offlineDuration = eventData.offline_duration_minutes || 0;
      return `Agent ${event.agent_name || event.agent_id} offline${offlineDuration > 0 ? ` (da ${offlineDuration} min)` : ''}`;
    }
    case 'online': {
      const onlineDuration = eventData.offline_duration_minutes || 0;
      return `Agent ${event.agent_name || event.agent_id} tornato online${onlineDuration > 0 ? ` (era offline da ${onlineDuration} min)` : ''}`;
    }
    case 'reboot': {
      const uptime = eventData.system_uptime_minutes || 'N/A';
      return `Agent ${event.agent_name || event.agent_id} riavviato (uptime: ${uptime} min)`;
    }
    case 'network_issue': {
      const issueDuration = eventData.issue_duration_minutes || 0;
      return `Agent ${event.agent_name || event.agent_id} - problema rete (durata: ${issueDuration} min)`;
    }
    default:
      return `Evento sconosciuto per agent ${event.agent_name || event.agent_id}`;
  }
}

/**
 * Eventi agent monitoraggio (stesso endpoint del triangolo in header / Ticket hub).
 */
export function useAgentMonitoringEvents(getAuthHeader, socket) {
  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsDebounceRef = useRef(null);

  const loadEvents = useCallback(async () => {
    if (!getAuthHeader) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
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
      if (err.name !== 'AbortError') console.error('Errore caricamento eventi agent:', err);
    }
  }, [getAuthHeader]);

  const loadUnreadCount = useCallback(async () => {
    if (!getAuthHeader) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
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
      if (err.name !== 'AbortError') console.error('Errore caricamento conteggio non letti:', err);
    }
  }, [getAuthHeader]);

  const markAsRead = async (eventId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent-events/${eventId}/read`), {
        method: 'POST',
        headers: getAuthHeader()
      });
      if (response.ok) {
        await loadEvents();
        await loadUnreadCount();
        try {
          window.dispatchEvent(new CustomEvent('agent-notifications-updated'));
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error('Errore marcatura evento come letto:', err);
    }
  };

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
        } catch {
          /* ignore */
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Errore cancellazione notifiche' }));
        alert(errorData.error || 'Errore cancellazione notifiche');
      }
    } catch (err) {
      console.error('Errore cancellazione notifiche:', err);
      alert('Errore cancellazione notifiche: ' + err.message);
    }
  };

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

  useEffect(() => {
    loadEvents();
    loadUnreadCount();
    const interval = setInterval(() => {
      loadEvents();
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadEvents, loadUnreadCount]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleAgentEvent = () => {
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
  }, [socket, loadEvents, loadUnreadCount]);

  useEffect(() => {
    const handler = () => {
      loadEvents();
      loadUnreadCount();
    };
    window.addEventListener('agent-notifications-updated', handler);
    return () => window.removeEventListener('agent-notifications-updated', handler);
  }, [loadEvents, loadUnreadCount]);

  return {
    events,
    unreadCount,
    loadEvents,
    loadUnreadCount,
    markAsRead,
    clearAllNotifications,
    formatDate
  };
}
