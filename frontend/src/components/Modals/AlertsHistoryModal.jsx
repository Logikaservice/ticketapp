import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Info, Sparkles, Calendar, User, FileImage } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalSecondaryButton,
} from './HubModalChrome';

const AlertsHistoryModal = ({ isOpen, onClose, currentUser, getAuthHeader, alertsRefreshTrigger, initialAlertId }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  // Rimuovo apiBase, uso direttamente buildApiUrl

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
      // Reset selectedAlert quando si apre il modal (solo se non c'è initialAlertId)
      if (!initialAlertId) {
        setSelectedAlert(null);
      }
    }
  }, [isOpen, alertsRefreshTrigger]);

  // Espandi automaticamente l'avviso se viene passato initialAlertId
  useEffect(() => {
    if (isOpen && initialAlertId && alerts.length > 0) {
      const alertToExpand = alerts.find(a => a.id === initialAlertId);
      if (alertToExpand) {
        setSelectedAlert(alertToExpand);
        // Scroll all'avviso espanso
        setTimeout(() => {
          const element = document.querySelector(`[data-alert-id="${initialAlertId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    }
  }, [isOpen, alerts, initialAlertId]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/alerts'), {
        headers: getAuthHeader ? getAuthHeader() : {}
      });
      if (!res.ok) throw new Error('Errore caricamento avvisi');
      const allAlerts = await res.json();
      
      // Filtra solo gli avvisi con level === 'features'
      // IMPORTANTE: Mostra TUTTI gli avvisi features, anche quelli temporanei scaduti
      // (nella dashboard vengono nascosti, ma qui devono rimanere sempre visibili)
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
          icon: <AlertTriangle size={18} className="text-red-300" />,
          bgColor: 'bg-red-500/12',
          borderColor: 'border-red-400/45',
          textColor: 'text-red-100',
          badgeColor: 'bg-red-500/20 text-red-50'
        };
      case 'warning':
        return {
          label: 'Avviso',
          icon: <AlertTriangle size={18} className="text-amber-300" />,
          bgColor: 'bg-amber-500/12',
          borderColor: 'border-amber-400/45',
          textColor: 'text-amber-50',
          badgeColor: 'bg-amber-500/20 text-amber-50'
        };
      case 'info':
        return {
          label: 'Informazione',
          icon: <Info size={18} className="text-sky-300" />,
          bgColor: 'bg-sky-500/12',
          borderColor: 'border-sky-400/45',
          textColor: 'text-sky-50',
          badgeColor: 'bg-sky-500/20 text-sky-50'
        };
      case 'features':
        return {
          label: 'Nuove funzionalità',
          icon: <Sparkles size={18} className="text-emerald-300" />,
          bgColor: 'bg-emerald-500/12',
          borderColor: 'border-emerald-400/45',
          textColor: 'text-emerald-50',
          badgeColor: 'bg-emerald-500/20 text-emerald-50'
        };
      default:
        return {
          label: 'Avviso',
          icon: <AlertTriangle size={18} className="text-white/55" />,
          bgColor: 'bg-white/[0.06]',
          borderColor: 'border-white/15',
          textColor: 'text-white/85',
          badgeColor: 'bg-white/10 text-white/80'
        };
    }
  };

  if (!isOpen) return null;

  return (
    <HubModalInnerCard maxWidthClass="max-w-4xl" className="flex max-h-[90vh] flex-col overflow-hidden shadow-2xl animate-fadeIn">
      <HubModalChromeHeader
        icon={Sparkles}
        title="Nuove Funzionalità"
        subtitle="Cronologia delle nuove funzionalità aggiunte al sistema"
        onClose={onClose}
      />
      <HubModalBody>
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[color:var(--hub-accent)]" />
            <p className="mt-4 text-[color:var(--hub-chrome-text-muted)]">Caricamento avvisi...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center">
            <Clock size={48} className="mx-auto mb-4 text-[color:var(--hub-chrome-text-fainter)]" />
            <p className="text-lg text-[color:var(--hub-chrome-text-muted)]">Nessun avviso presente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const levelInfo = getLevelInfo(alert.level);
              const createdAt = alert.createdAt || alert.created_at;
              const formattedDate = createdAt ? formatDate(createdAt) : 'Data non disponibile';

              return (
                <div
                  key={alert.id}
                  data-alert-id={alert.id}
                  className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md ${levelInfo.borderColor} ${levelInfo.bgColor}`}
                  onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <h3 className={`text-lg font-bold ${levelInfo.textColor}`}>{alert.title}</h3>
                        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-[color:var(--hub-chrome-text-faint)]">
                          <Calendar size={14} />
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      {alert.createdBy && (
                        <div className="mb-2 flex items-center gap-1 text-sm text-[color:var(--hub-chrome-text-faint)]">
                          <User size={14} />
                          <span>{alert.createdBy}</span>
                        </div>
                      )}

                      {selectedAlert?.id === alert.id && (
                        <div className="mt-4 space-y-3 border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
                          <div>
                            <p className="mb-1 text-sm font-semibold text-[color:var(--hub-chrome-text-secondary)]">Descrizione:</p>
                            <p className="whitespace-pre-wrap text-sm text-[color:var(--hub-chrome-text-muted)]">{alert.body}</p>
                          </div>

                          {alert.attachments && Array.isArray(alert.attachments) && alert.attachments.length > 0 && (
                            <div>
                              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-[color:var(--hub-chrome-text-secondary)]">
                                <FileImage size={14} />
                                Allegati ({alert.attachments.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {alert.attachments.map((att, idx) => {
                                  const rawPath = att.path || '';
                                  const attachmentHref =
                                    typeof rawPath === 'string' && /^https?:\/\//i.test(rawPath)
                                      ? rawPath
                                      : buildApiUrl(String(rawPath).replace(/^\//, ''));
                                  return (
                                    <a
                                      key={idx}
                                      href={attachmentHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded px-3 py-1 text-xs text-[color:var(--hub-chrome-text-secondary)] transition hover:bg-[color:var(--hub-chrome-hover)]"
                                    >
                                      {att.originalName || att.filename}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedAlert?.id !== alert.id && (
                        <p className="mt-2 line-clamp-2 text-sm text-[color:var(--hub-chrome-text-faint)]">{alert.body}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HubModalBody>
      <HubModalChromeFooter className="justify-end">
        <HubModalSecondaryButton onClick={onClose}>Chiudi</HubModalSecondaryButton>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default AlertsHistoryModal;

