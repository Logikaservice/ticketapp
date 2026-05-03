// src/components/AgentNotifications.jsx

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { useAgentMonitoringEvents, getAgentEventVisual, getAgentEventMessage } from '../hooks/useAgentMonitoringEvents';

const AgentNotifications = ({ getAuthHeader, socket, onOpenNetworkMonitoring, hubTone = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const { events, unreadCount, markAsRead, clearAllNotifications, formatDate } = useAgentMonitoringEvents(
    getAuthHeader,
    socket
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          <span className="absolute -top-1 -right-1 flex h-5 w-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          className={`absolute left-0 top-full z-[9999] mt-2 max-h-96 w-96 overflow-y-auto rounded-xl border shadow-2xl ${
            hubTone ? 'border-white/[0.12] bg-[#252525] text-white/90' : 'border border-gray-200 bg-white'
          }`}
        >
          <div className={`flex items-center justify-between border-b p-4 ${hubTone ? 'border-white/[0.1]' : 'border-gray-200'}`}>
            <h3 className={`font-semibold ${hubTone ? 'text-white' : 'text-gray-900'}`}>Notifiche Agent</h3>
            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <button
                  type="button"
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
                type="button"
                onClick={() => setShowDropdown(false)}
                className={hubTone ? 'rounded p-1 text-white/50 hover:text-white' : 'rounded p-1 text-gray-400 hover:text-gray-600'}
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
                const { icon: Icon, color, bg } = getAgentEventVisual(event.event_type);
                const isUnread = !event.is_read;

                return (
                  <button
                    type="button"
                    key={event.id}
                    className={`flex w-full cursor-pointer p-4 text-left transition ${
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
                      <div className={`rounded-lg p-2 ${bg}`}>
                        <Icon size={18} className={color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'} ${hubTone ? 'text-white/92' : 'text-gray-900'}`}
                        >
                          {getAgentEventMessage(event)}
                        </p>
                        <p className={`mt-1 text-xs ${hubTone ? 'text-white/45' : 'text-gray-500'}`}>
                          {formatDate(event.detected_at)}
                          {event.azienda && ` • ${event.azienda}`}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                  </button>
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
