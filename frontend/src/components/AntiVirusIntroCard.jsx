// Blocco introduttivo "Progetto esclusivo" per pagina Anti-Virus
// Stessa forma di EmailIntroCard/OfficeIntroCard

import React from 'react';
import { Shield, Monitor, Settings, Calendar, Building, AlertTriangle } from 'lucide-react';
import { hexToRgba, normalizeHex, getStoredTechHubAccent } from '../utils/techHubAccent';

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
  accentHex: accentHexProp = null
}) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';
  const accent = normalizeHex(accentHexProp) || getStoredTechHubAccent();

  const selectCls = embedded
    ? 'w-full appearance-none cursor-pointer rounded-lg border border-gray-300 bg-gray-50 py-3 pl-4 pr-10 text-sm text-gray-900 [color-scheme:light] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/80 hover:border-gray-400'
    : 'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 text-gray-700 hover:border-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500';

  const wrapCls = embedded
    ? 'mb-8 rounded-2xl border border-white/[0.10] bg-black/[0.22] p-6 shadow-sm backdrop-blur-sm transition-shadow duration-300 md:p-8'
    : 'mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 md:p-8';

  return (
    <div className={wrapCls}>
      {/* Blocco 1: CTA + selettore azienda */}
      <div
        className={
          embedded
            ? 'mb-8 flex flex-col items-center border-b border-white/[0.08] pb-8 text-center'
            : 'mb-8 flex flex-col items-center border-b border-gray-200 pb-8 text-center'
        }
      >
        <p className={embedded ? 'mb-3 text-sm text-white/65' : 'mb-3 text-gray-600'}>
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
            <Building size={18} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${embedded ? 'text-gray-400' : 'text-gray-400'}`} />
          </div>
        )}
      </div>

      {/* Blocco 2: Progetto esclusivo (pill, titolo, descrizione, card) */}
      <span
        className={
          embedded
            ? 'mb-4 inline-block rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-[color:var(--hub-accent,#C1FF72)] ring-1 ring-white/[0.12]'
            : 'mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800'
        }
      >
        PROGETTO ESCLUSIVO & PERSONALIZZATO
      </span>

      <h2 className={embedded ? 'mb-3 text-2xl font-bold text-white md:text-3xl' : 'mb-3 text-2xl font-bold text-gray-900 md:text-3xl'}>
        Sicurezza Endpoint e Anti-Virus,{' '}
        <span style={{ color: embedded ? accent : undefined }} className={embedded ? 'italic' : 'italic text-blue-600'}>
          protezione attiva.
        </span>
      </h2>

      <p
        className={
          embedded
            ? 'mb-8 max-w-3xl text-base leading-relaxed text-white/60'
            : 'mb-8 max-w-3xl text-base leading-relaxed text-gray-600'
        }
      >
        In questa sezione puoi consultare lo stato di protezione di ogni singolo dispositivo connesso alla tua rete
        aziendale. Non si tratta di una difesa generica, ma di un monitoraggio puntuale che garantisce che ogni
        postazione, server o computer esterno sia equipaggiato con le soluzioni di sicurezza approvate.
      </p>

      <h3 className={embedded ? 'mb-4 font-semibold text-white' : 'mb-4 font-semibold text-gray-900'}>
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
                  ? 'flex cursor-default items-start gap-4 rounded-xl border border-white/[0.08] bg-black/[0.18] p-4 transition-all duration-200 hover:border-[color:var(--hub-accent-border,hsla(0,0%,100%,0.2))]'
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
                <h3 className={embedded ? 'mb-1 font-bold text-white' : 'mb-1 font-bold text-gray-900'}>{feat.title}</h3>
                <p className={embedded ? 'text-sm leading-snug text-white/55' : 'text-sm leading-snug text-gray-600'}>{feat.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota sulla precisione dei dati */}
      <div className={embedded ? 'mt-8 border-t border-white/[0.08] pt-6' : 'mt-8 border-t border-gray-200 pt-6'}>
        <div
          className={
            embedded
              ? 'flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4'
              : 'flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4'
          }
        >
          <AlertTriangle size={20} className={`mt-0.5 shrink-0 ${embedded ? 'text-amber-300' : 'text-amber-600'}`} />
          <div>
            <h3 className={`mb-1 font-semibold ${embedded ? 'text-amber-100' : 'text-amber-900'}`}>Nota sulla precisione dei dati</h3>
            <p className={`text-sm leading-relaxed ${embedded ? 'text-amber-100/85' : 'text-amber-800'}`}>
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
