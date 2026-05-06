import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import TelegramConfigSection from '../components/TelegramConfigSection';
import {
  normalizeHex,
  getStoredTechHubAccent,
  hubEmbeddedRootInlineStyle,
  hubEmbeddedBackBtnInlineStyle
} from '../utils/techHubAccent';

const TelegramNotificationsPage = ({
  embedded = false,
  closeEmbedded,
  onClose,
  getAuthHeader,
  currentUser,
  accentHex: accentHexProp
}) => {
  const accent = useMemo(() => normalizeHex(accentHexProp) || getStoredTechHubAccent(), [accentHexProp]);
  const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);
  const rootEmbeddedStyle = useMemo(() => (embedded ? hubEmbeddedRootInlineStyle(accent) : undefined), [embedded, accent]);

  const rootClassName = embedded
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)] font-sans'
    : 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-100 font-sans';

  const [companies, setCompanies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [telegramConfigs, setTelegramConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  const readOnly = currentUser?.ruolo === 'cliente';

  const onEmbeddedBack = useCallback(() => {
    if (typeof closeEmbedded === 'function') closeEmbedded();
    else if (typeof onClose === 'function') onClose();
  }, [closeEmbedded, onClose]);

  const loadTelegramConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, agentsRes, cfgRes] = await Promise.all([
        fetch(buildApiUrl('/api/network-monitoring/companies'), { headers: getAuthHeader() }),
        fetch(buildApiUrl('/api/network-monitoring/agents'), { headers: getAuthHeader() }),
        fetch(buildApiUrl('/api/network-monitoring/telegram/config'), { headers: getAuthHeader() })
      ]);

      const companiesData = companiesRes.ok ? await companiesRes.json() : [];
      const agentsData = agentsRes.ok ? await agentsRes.json() : [];
      const cfgData = cfgRes.ok ? await cfgRes.json() : [];

      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setTelegramConfigs(Array.isArray(cfgData) ? cfgData : []);
    } catch (e) {
      // silent: la sezione gestisce UI error per save/delete
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const saveTelegramConfig = useCallback(
    async (config) => {
      const response = await fetch(buildApiUrl('/api/network-monitoring/telegram/config'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Errore salvataggio configurazione Telegram');
      }
      await loadTelegramConfigs();
      return await response.json();
    },
    [getAuthHeader, loadTelegramConfigs]
  );

  const deleteTelegramConfig = useCallback(
    async (configId) => {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/telegram/config/${configId}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error('Errore rimozione configurazione Telegram');
      await loadTelegramConfigs();
    },
    [getAuthHeader, loadTelegramConfigs]
  );

  useEffect(() => {
    loadTelegramConfigs();
  }, [loadTelegramConfigs]);

  // Refresh "locale" dalla topbar dell'Hub
  useEffect(() => {
    if (!embedded) return;
    const handler = (e) => {
      const view = e?.detail?.view;
      if (view !== 'telegram') return;
      loadTelegramConfigs();
    };
    window.addEventListener('hub:refresh', handler);
    return () => window.removeEventListener('hub:refresh', handler);
  }, [embedded, loadTelegramConfigs]);

  return (
    <div className={rootClassName} style={rootEmbeddedStyle}>
      <div
        className={
          embedded
            ? 'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3'
            : 'flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm'
        }
        style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
      >
        <div className="flex min-w-0 items-center gap-3">
          {embedded ? (
            <button type="button" onClick={onEmbeddedBack} style={embeddedBackBtnStyle}>
              <ArrowLeft size={18} aria-hidden />
              Panoramica Hub
            </button>
          ) : (
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">
              Chiudi
            </button>
          )}
          <div className="min-w-0">
            <h1 className={`font-bold ${embedded ? 'truncate text-lg text-[color:var(--hub-chrome-text)]' : 'text-xl text-gray-800'}`}>
              Notifiche Telegram
            </h1>
            <p className={`truncate ${embedded ? 'text-xs text-[color:var(--hub-chrome-text-muted)]' : 'text-sm text-gray-500'}`}>
              Configurazioni bot e canali
            </p>
          </div>
        </div>

        {embedded ? (
          <button
            type="button"
            onClick={loadTelegramConfigs}
            className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] px-3 py-1.5 text-xs font-semibold text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]"
            title="Aggiorna lista"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
        ) : null}
      </div>

      <div
        className={embedded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 md:px-5' : 'flex-1 overflow-y-auto p-6'}
        style={embedded ? { backgroundColor: 'var(--hub-chrome-page)' } : undefined}
      >
        <div className={embedded ? '' : 'mx-auto max-w-5xl'}>
          <div className={embedded ? 'rounded-2xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-4' : ''}>
            {!readOnly ? (
              <TelegramConfigSection
                companies={companies}
                agents={agents}
                telegramConfigs={telegramConfigs}
                loading={loading}
                onSave={saveTelegramConfig}
                onDelete={deleteTelegramConfig}
                onClose={embedded ? onEmbeddedBack : onClose}
                getAuthHeader={getAuthHeader}
                readOnly={false}
              />
            ) : (
              <div className={`flex items-center gap-2 rounded-lg border p-4 text-sm ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] text-[color:var(--hub-chrome-text-muted)]' : 'border-gray-200 text-gray-600'}`}>
                <AlertCircle size={18} />
                Solo i tecnici possono modificare le notifiche Telegram.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramNotificationsPage;

