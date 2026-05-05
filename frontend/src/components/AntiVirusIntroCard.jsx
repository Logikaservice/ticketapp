// Blocco introduttivo "Progetto esclusivo" per pagina Anti-Virus
// Stessa forma di EmailIntroCard/OfficeIntroCard

import React, { useMemo } from 'react';
import { Shield, Monitor, Settings, Calendar, Building, AlertTriangle } from 'lucide-react';
import { hexToRgba, normalizeHex, getStoredTechHubAccent, hubChromeCssVariables } from '../utils/techHubAccent';

const features = [
  {
    title: 'Stato di Protezione',
    description:
      'Verifica istantaneamente se l\'Anti-Virus è attivo e operativo su ogni specifica macchina.',
    icon: Shield
  },
  {
    title: 'Dettaglio Dispositivo',
    description:
      'Identifica ogni postazione tramite il suo indirizzo IP e il nome dell\'utente assegnato per una rintracciabilità totale.',
    icon: Monitor
  },
  {
    title: 'Mix Tecnologico',
    description:
      'Monitora i diversi prodotti utilizzati (come AVG Business o Webroot) per garantire la migliore difesa su misura per ogni ruolo.',
    icon: Settings
  },
  {
    title: 'Pianificazione Scadenze',
    description:
      'Tieni sotto controllo la validità delle licenze per evitare che una postazione resti scoperta a causa di un abbonamento scaduto.',
    icon: Calendar
  }
];

const AntiVirusIntroCard = ({
  companies = [],
  value = '',
  onChange = null,
  embedded = false,
  accentHex: accentHexProp = null,
  hubSurfaceMode = 'dark'
}) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';
  const accent = normalizeHex(accentHexProp) || getStoredTechHubAccent();
  const hubLight = hubSurfaceMode === 'light';

  const embeddedStyle = useMemo(() => {
    if (!embedded) return undefined;
    return {
      ...hubChromeCssVariables(hubLight ? 'light' : 'dark'),
      backgroundColor: 'var(--hub-chrome-surface)',
      color: 'var(--hub-chrome-text)'
    };
  }, [embedded, hubLight]);

  const selectCls = embedded
    ? `${hubLight ? '[color-scheme:light]' : '[color-scheme:dark]'} w-full cursor-pointer appearance-none rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] py-3 pl-4 pr-10 text-sm text-[color:var(--hub-chrome-text)] outline-none focus:border-[color:var(--hub-accent-border)] focus:ring-1 focus:ring-[color:var(--hub-accent)]`
    : 'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 text-gray-700 hover:border-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500';

  const wrapCls = embedded
    ? 'mb-8 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-6 shadow-none transition-shadow duration-300 md:p-8'
    : 'mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 md:p-8';

  return (
    <div className={wrapCls} style={embeddedStyle}>
      {/* Blocco 1: CTA + selettore azienda */}
      <div
        className={
          embedded
            ? 'mb-8 flex flex-col items-center border-b border-[color:var(--hub-chrome-border-soft)] pb-8 text-center'
            : 'mb-8 flex flex-col items-center border-b border-gray-200 pb-8 text-center'
        }
      >
        <p className={embedded ? 'mb-3 text-sm text-[color:var(--hub-chrome-text-muted)]' : 'mb-3 text-gray-600'}>
          Seleziona la tua azienda nel menu per consultare lo stato di protezione Anti-Virus dei dispositivi.
        </p>
        {showSelector && (
          <div className="relative w-full max-w-sm">
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChange(v ? v : null);
              }}
              className={selectCls}
            >
              <option value="">Seleziona Azienda...</option>
              {companies
                .filter((c) => c.id != null)
                .map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.azienda || `ID ${c.id}`}
                  </option>
                ))}
            </select>
            <Building
              size={18}
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-400'}`}
            />
          </div>
        )}
      </div>

      {/* Blocco 2: Progetto esclusivo (pill, titolo, descrizione, card) */}
      <span
        className={
          embedded
            ? 'mb-4 inline-block rounded-full border border-[color:var(--hub-accent-border)] bg-[color:var(--hub-chrome-muted-fill)] px-3 py-1 text-xs font-semibold text-[color:var(--hub-accent)]'
            : 'mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800'
        }
      >
        PROGETTO ESCLUSIVO & PERSONALIZZATO
      </span>

      <h2 className={embedded ? 'mb-3 text-2xl font-bold text-[color:var(--hub-chrome-text)] md:text-3xl' : 'mb-3 text-2xl font-bold text-gray-900 md:text-3xl'}>
        Sicurezza Endpoint e Anti-Virus,{' '}
        <span style={{ color: embedded ? accent : undefined }} className={embedded ? 'italic' : 'italic text-blue-600'}>
          protezione attiva.
        </span>
      </h2>

      <p
        className={
          embedded
            ? 'mb-8 max-w-3xl text-base leading-relaxed text-[color:var(--hub-chrome-text-muted)]'
            : 'mb-8 max-w-3xl text-base leading-relaxed text-gray-600'
        }
      >
        In questa sezione puoi consultare lo stato di protezione di ogni singolo dispositivo connesso alla tua rete
        aziendale. Non si tratta di una difesa generica, ma di un monitoraggio puntuale che garantisce che ogni
        postazione, server o computer esterno sia equipaggiato con le soluzioni di sicurezza approvate.
      </p>

      <h3 className={embedded ? 'mb-4 font-semibold text-[color:var(--hub-chrome-text)]' : 'mb-4 font-semibold text-gray-900'}>
        Fattori Chiave del Monitoraggio
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className={
                embedded
                  ? 'flex cursor-default items-start gap-4 rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well)] p-4 transition-all duration-200 hover:border-[color:var(--hub-chrome-border)] hover:bg-[color:var(--hub-chrome-hover)]'
                  : 'flex cursor-default items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-sky-200'
              }
            >
              <div
                className={
                  embedded
                    ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl'
                    : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100'
                }
                style={embedded ? { backgroundColor: hexToRgba(accent, 0.14) } : undefined}
              >
                <Icon size={24} strokeWidth={2} style={embedded ? { color: accent } : undefined} className={embedded ? '' : 'text-sky-600'} />
              </div>
              <div className="min-w-0">
                <h3 className={embedded ? 'mb-1 font-bold text-[color:var(--hub-chrome-text)]' : 'mb-1 font-bold text-gray-900'}>{feat.title}</h3>
                <p className={embedded ? 'text-sm leading-snug text-[color:var(--hub-chrome-text-muted)]' : 'text-sm leading-snug text-gray-600'}>{feat.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota sulla precisione dei dati */}
      <div className={embedded ? 'mt-8 border-t border-[color:var(--hub-chrome-border-soft)] pt-6' : 'mt-8 border-t border-gray-200 pt-6'}>
        <div
          className={
            embedded
              ? 'flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-950/15 p-4'
              : 'flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4'
          }
        >
          <AlertTriangle size={20} className={`mt-0.5 shrink-0 ${embedded ? 'text-amber-500' : 'text-amber-600'}`} />
          <div>
            <h3 className={`mb-1 font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-amber-900'}`}>Nota sulla precisione dei dati</h3>
            <p className={`text-sm leading-relaxed ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-amber-800'}`}>
              Le informazioni riportate in questa finestra riflettono esclusivamente le analisi eseguite e documentate da
              Logika Service. Qualora vengano aggiunti nuovi dispositivi, sostituiti computer o installati software di
              protezione diversi senza darne comunicazione alla Logika Service, potrebbero riscontrarsi delle discrepanze
              tra lo stato reale dei sistemi e i dati qui visualizzati.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AntiVirusIntroCard;
