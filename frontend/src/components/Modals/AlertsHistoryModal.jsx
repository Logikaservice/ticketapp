import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Info, Sparkles, Calendar, User, Building, FileImage, Mail } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const AlertsHistoryModal = ({ isOpen, onClose, currentUser, getAuthHeader }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const apiBase = process.env.REACT_APP_API_URL;

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/alerts`, {
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Errore caricamento avvisi');
      const allAlerts = await res.json();
      
      // Parsa correttamente il campo clients
      const parsedAlerts = allAlerts.map(alert => {
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
      
      // Filtra solo gli avvisi di tipo "features" (Nuove funzionalità)
      // NOTA: Mostriamo TUTTI gli avvisi features, anche quelli scaduti, per mantenere la cronologia completa
      const featuresAlerts = parsedAlerts.filter(alert => alert.level === 'features');
      
      // Ordina per data di creazione (più recenti prima)
      featuresAlerts.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at);
        const dateB = new Date(b.createdAt || b.created_at);
        return dateB - dateA;
      });
      
      setAlerts(featuresAlerts);
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
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Sparkles size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Nuove Funzionalità</h2>
              <p className="text-sm text-gray-600 mt-1">Cronologia delle migliorie e sviluppi del progetto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-gray-600 mt-4">Caricamento avvisi...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Nessuna nuova funzionalità ancora pubblicata</p>
              <p className="text-sm text-gray-500 mt-2">Le nuove funzionalità verranno mostrate qui</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const levelInfo = getLevelInfo(alert.level);
                const createdAt = alert.createdAt || alert.created_at;
                const formattedDate = createdAt ? formatDate(createdAt) : 'Data non disponibile';
                const formattedTime = createdAt ? new Date(createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${levelInfo.borderColor} ${levelInfo.bgColor} hover:shadow-md transition-all cursor-pointer`}
                    onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {levelInfo.icon}
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${levelInfo.badgeColor}`}>
                            {levelInfo.label}
                          </span>
                          {alert.isPermanent ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              Permanente
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
                              Temporaneo ({alert.daysToExpire || 7} giorni)
                            </span>
                          )}
                        </div>
                        
                        <h3 className={`font-bold text-lg mb-2 ${levelInfo.textColor}`}>
                          {alert.title}
                        </h3>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{formattedDate} {formattedTime && `alle ${formattedTime}`}</span>
                          </div>
                          {alert.createdBy && (
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span>{alert.createdBy}</span>
                            </div>
                          )}
                        </div>

                        {selectedAlert?.id === alert.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-700 mb-1">Descrizione:</p>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap">{alert.body}</p>
                            </div>
                            
                            {alert.clients && Array.isArray(alert.clients) && alert.clients.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                                  <Building size={14} />
                                  Destinatari:
                                </p>
                                <p className="text-sm text-gray-600">
                                  {alert.clients.length} destinatario{alert.clients.length !== 1 ? 'i' : ''} specifico{alert.clients.length !== 1 ? 'i' : ''}
                                </p>
                              </div>
                            )}

                            {(!alert.clients || alert.clients.length === 0) && (
                              <div>
                                <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                                  <Mail size={14} />
                                  Destinatari:
                                </p>
                                <p className="text-sm text-gray-600">Tutti i clienti</p>
                              </div>
                            )}

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
                                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition"
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
        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertsHistoryModal;

