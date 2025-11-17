import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Info, Sparkles, Calendar, User, Building, FileImage, Mail } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
// getAuthHeader viene passato come prop, non importato

const AlertsHistoryModal = ({ isOpen, onClose, currentUser, getAuthHeader, alertsRefreshTrigger }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const apiBase = process.env.REACT_APP_API_URL;

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, alertsRefreshTrigger]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/alerts`, {
        headers: getAuthHeader ? getAuthHeader() : {}
      });
      if (!res.ok) throw new Error('Errore caricamento avvisi');
      const allAlerts = await res.json();
      
      // Filtra solo gli avvisi con level === 'features'
      const featuresAlerts = allAlerts.filter(alert => alert.level === 'features');
      
      // Parsa correttamente il campo clients
      const parsedAlerts = featuresAlerts.map(alert => {
        let clients = [];
        try {
          if (alert.clients) {
            if (Array.isArray(alert.clients)) {
              clients = alert.clients;
            } else if (typeof alert.clients === 'string') {
              clients = JSON.parse(alert.clients);
            } else {
              clients = alert.clients;
            }
            if (!Array.isArray(clients)) {
              clients = [];
            }
          }
        } catch (e) {
          console.error('Errore parsing clients:', e);
          clients = [];
        }
        return { ...alert, clients };
      });
      
      // Ordina per data di creazione (più recenti prima)
      parsedAlerts.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at);
        const dateB = new Date(b.createdAt || b.created_at);
        return dateB - dateA;
      });
      
      setAlerts(parsedAlerts);
    } catch (e) {
      console.error('Errore caricamento avvisi:', e);
    } finally {
      setLoading(false);
    }
  };

  const getLevelInfo = (level) => {
    switch (level) {
      case 'danger':
        return {
          label: 'Critico',
          icon: <AlertTriangle size={18} className="text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          badgeColor: 'bg-red-100 text-red-700'
        };
      case 'warning':
        return {
          label: 'Avviso',
          icon: <AlertTriangle size={18} className="text-yellow-600" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-800',
          badgeColor: 'bg-yellow-100 text-yellow-700'
        };
      case 'info':
        return {
          label: 'Informazione',
          icon: <Info size={18} className="text-blue-600" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-300',
          textColor: 'text-blue-800',
          badgeColor: 'bg-blue-100 text-blue-700'
        };
      case 'features':
        return {
          label: 'Nuove funzionalità',
          icon: <Sparkles size={18} className="text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-300',
          textColor: 'text-green-800',
          badgeColor: 'bg-green-100 text-green-700'
        };
      default:
        return {
          label: 'Avviso',
          icon: <AlertTriangle size={18} className="text-gray-600" />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-800',
          badgeColor: 'bg-gray-100 text-gray-700'
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-[0_20px_80px_rgba(16,185,129,0.25)] border border-emerald-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-emerald-100 flex items-center justify-between bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Nuove Funzionalità</h2>
              <p className="text-sm text-white/80 mt-1">Cronologia delle novità introdotte nella piattaforma</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white/60 backdrop-blur">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-gray-600 mt-4">Caricamento avvisi...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Nessun avviso presente</p>
            </div>
          ) : (
            <div className="space-y-4 relative">
              <div className="absolute left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-200 to-sky-200 rounded-full" />
              {alerts.map((alert, index) => {
                const levelInfo = getLevelInfo(alert.level);
                const createdAt = alert.createdAt || alert.created_at;
                const formattedDate = createdAt ? formatDate(createdAt) : 'Data non disponibile';

                return (
                  <div
                    key={alert.id}
                    className={`relative ml-8 border rounded-2xl p-5 ${levelInfo.borderColor} ${levelInfo.bgColor} hover:shadow-lg transition-all cursor-pointer`}
                    onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                  >
                    <div className="absolute -left-8 top-6 w-4 h-4 rounded-full border-4 border-white shadow bg-emerald-400" />
                    <div className="absolute -left-7 top-6 text-xs text-gray-400 font-semibold">{index + 1}</div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center">
                              {levelInfo.icon}
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-widest text-gray-500">{levelInfo.label}</p>
                              <h3 className={`font-bold text-lg ${levelInfo.textColor}`}>
                                {alert.title}
                              </h3>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                            <Calendar size={14} />
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                        
                        {alert.createdBy && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                            <User size={14} />
                            <span>{alert.createdBy}</span>
                          </div>
                        )}

                        {selectedAlert?.id === alert.id && (
                          <div className="mt-4 pt-4 border-t border-white/60 space-y-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-700 mb-1">Descrizione:</p>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">{alert.body}</p>
                            </div>
                            
                            {alert.attachments && Array.isArray(alert.attachments) && alert.attachments.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                  <FileImage size={14} />
                                  Allegati ({alert.attachments.length}):
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {alert.attachments.map((att, idx) => (
                                    <a
                                      key={idx}
                                      href={`${apiBase}${att.path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1 bg-white/80 hover:bg-white rounded-full text-xs text-gray-700 transition shadow"
                                    >
                                      {att.originalName || att.filename}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {selectedAlert?.id !== alert.id && (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                            {alert.body}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-emerald-100 bg-white/80 flex justify-end backdrop-blur">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertsHistoryModal;

