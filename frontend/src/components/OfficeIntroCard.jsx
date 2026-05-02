// Blocco introduttivo "Progetto esclusivo" per pagina Office
// Stessa forma di EmailIntroCard/MonitoraggioIntroCard, con contenuto licenze Office

import React from 'react';
import { Key, Monitor, Package, Shield, Building, AlertTriangle } from 'lucide-react';

const features = [
  {
    title: 'Monitoraggio Licenze',
    description: 'Visualizza lo stato di attivazione e l\'assegnazione dei pacchetti software per ogni utente.',
    icon: Key,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-amber-200'
  },
  {
    title: 'Distribuzione Dispositivi',
    description: 'Identifica con precisione su quali postazioni o dispositivi è installato e attivo l\'applicativo.',
    icon: Monitor,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-sky-200'
  },
  {
    title: 'Verifica Disponibilità',
    description: 'Controlla immediatamente se hai postazioni libere o slot inutilizzati per nuove installazioni.',
    icon: Package,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-green-200'
  },
  {
    title: 'Compliance & Gestione',
    description: 'Assicurati che ogni membro del team utilizzi una licenza corretta e aggiornata secondo gli standard aziendali.',
    icon: Shield,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-violet-200'
  }
];

const OfficeIntroCard = ({ embedded = false, companies = [], value = '', onChange = null }) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';

  return (
    <div
      className={
        embedded
          ? 'mb-8 rounded-2xl border border-white/[0.08] bg-[#1E1E1E] p-6 shadow-none md:p-8'
          : 'mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 md:p-8'
      }
    >
      {/* Blocco 1: CTA + selettore azienda */}
      <div
        className={`mb-8 flex flex-col items-center pb-8 text-center ${
          embedded ? 'border-b border-white/[0.08]' : 'border-b border-gray-200'
        }`}
      >
        <p className={`mb-3 ${embedded ? 'text-white/62' : 'text-gray-600'}`}>
          Seleziona la tua azienda nel menu per vedere la distribuzione delle licenze Office.
        </p>
        {showSelector && (
          <div className="relative w-full max-w-sm">
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChange(v ? v : null);
              }}
              className={
                embedded
                  ? '[color-scheme:dark] w-full cursor-pointer appearance-none rounded-lg border border-white/15 bg-black/35 py-3 pl-4 pr-10 text-white outline-none focus:border-[color:var(--hub-accent-border)] focus:ring-1 focus:ring-[color:var(--hub-accent)]'
                  : 'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 text-gray-700 hover:border-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500'
              }
            >
              <option value="">Seleziona Azienda...</option>
              {companies.filter(c => c.id != null).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.azienda || `ID ${c.id}`}</option>
              ))}
            </select>
            <Building size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${embedded ? 'text-white/42' : 'text-gray-400'}`} />
          </div>
        )}
      </div>

      {/* Blocco 2: Progetto esclusivo (pill, titolo, descrizione, card) */}
      <span
        className={
          embedded
            ? 'mb-4 inline-block rounded-full border border-[color:var(--hub-accent-border)] bg-[color:var(--hub-accent)]/15 px-3 py-1 text-xs font-semibold text-white/92'
            : 'mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800'
        }
      >
        PROGETTO ESCLUSIVO & PERSONALIZZATO
      </span>

      <h2 className={`mb-3 text-2xl font-bold md:text-3xl ${embedded ? 'text-white' : 'text-gray-900'}`}>
        Gestione Licenze Office,{' '}
        <span className={embedded ? 'italic text-[color:var(--hub-accent)]' : 'italic text-blue-600'}>sotto controllo.</span>
      </h2>

      <p className={`mb-8 max-w-3xl text-base leading-relaxed ${embedded ? 'text-white/60' : 'text-gray-600'}`}>
        Questa sezione ti permette di monitorare la distribuzione delle licenze Microsoft Office all&apos;interno della tua organizzazione. Grazie a questa vista, puoi verificare come vengono utilizzati i software e su quali dispositivi o utenti sono attive le licenze, ottimizzando le risorse digitali della tua azienda.
      </p>

      {/* Feature cards - 2x2 grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className={`flex cursor-default items-start gap-4 rounded-xl p-4 transition-all duration-200 ${
                embedded
                  ? 'border border-white/[0.08] bg-black/25 hover:border-white/[0.14] hover:bg-black/35'
                  : `border border-gray-100 bg-white ${feat.cardHover}`
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  embedded ? 'bg-white/[0.08] text-[color:var(--hub-accent)]' : `${feat.iconBg} ${feat.iconColor}`
                }`}
              >
                <Icon size={24} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className={`mb-1 font-bold ${embedded ? 'text-white' : 'text-gray-900'}`}>{feat.title}</h3>
                <p className={`text-sm leading-snug ${embedded ? 'text-white/55' : 'text-gray-600'}`}>{feat.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota sulla precisione dei dati */}
      <div className={`mt-8 border-t pt-6 ${embedded ? 'border-white/[0.08]' : 'border-gray-200'}`}>
        <div
          className={`flex items-start gap-2 rounded-xl p-4 ${
            embedded
              ? 'border border-amber-500/30 bg-amber-950/35'
              : 'border border-amber-200 bg-amber-50'
          }`}
        >
          <AlertTriangle size={20} className={`mt-0.5 shrink-0 ${embedded ? 'text-amber-400' : 'text-amber-600'}`} />
          <div>
            <h3 className={`mb-1 font-semibold ${embedded ? 'text-amber-100' : 'text-amber-900'}`}>
              Nota sulla precisione dei dati
            </h3>
            <p className={`text-sm leading-relaxed ${embedded ? 'text-amber-50/92' : 'text-amber-800'}`}>
              Le informazioni riportate in questa finestra riflettono esclusivamente le analisi eseguite e documentate da Logika Service. Qualora venissero eseguite attività, installazioni o spostamenti di licenza che <strong>non vengono comunicati</strong> alla Logika Service (e quindi non riportati ufficialmente in questo documento), potrebbero riscontrarsi delle discrepanze tra lo stato reale dei dispositivi e i dati qui visualizzati.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficeIntroCard;
