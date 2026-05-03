// Blocco introduttivo "Progetto esclusivo" per pagina Email
// Stessa forma di MonitoraggioIntroCard, con contenuto specifico per accessi Email

import React from 'react';
import { User, CalendarCheck, Link, MessageCircle, Building } from 'lucide-react';

const features = [
  {
    title: 'Anagrafica Account',
    description: 'Visualizza rapidamente tutti i nomi utente e gli indirizzi email configurati per il tuo dominio.',
    icon: User,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-sky-200'
  },
  {
    title: 'Controllo Scadenze',
    description: 'Monitora la validità dei tuoi servizi per evitare interruzioni impreviste nella ricezione o nell\'invio di messaggi.',
    icon: CalendarCheck,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-amber-200'
  },
  {
    title: 'Accesso Diretto',
    description: 'Identifica gli URL di riferimento e i parametri necessari per consultare la tua posta via web o configurare i tuoi dispositivi.',
    icon: Link,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-green-200'
  },
  {
    title: 'Assistenza Integrata',
    description: 'Hai un dubbio o un problema tecnico? Apri una richiesta di supporto direttamente dalla riga specifica del servizio interessato.',
    icon: MessageCircle,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-violet-200'
  }
];

const hubFeatureIcon = (feat) => {
  if (feat.title === 'Anagrafica Account') {
    return { wrap: 'bg-[color:var(--hub-chrome-palette-sky-bg)]', icon: 'text-[color:var(--hub-chrome-palette-sky-fg)]' };
  }
  if (feat.title === 'Controllo Scadenze') {
    return { wrap: 'bg-[color:var(--hub-chrome-palette-amber-bg)]', icon: 'text-[color:var(--hub-chrome-palette-amber-fg)]' };
  }
  if (feat.title === 'Accesso Diretto') {
    return { wrap: 'bg-[color:var(--hub-chrome-palette-emerald-bg)]', icon: 'text-[color:var(--hub-chrome-palette-emerald-fg)]' };
  }
  return { wrap: 'bg-[color:var(--hub-chrome-palette-violet-bg)]', icon: 'text-[color:var(--hub-chrome-palette-violet-fg)]' };
};

const EmailIntroCard = ({ companies = [], value = '', onChange = null, embedded = false }) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';
  const showCenterSelect = showSelector && !embedded;

  return (
    <div
      className={
        embedded
          ? 'mb-0 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-6 transition-shadow duration-300 md:p-8'
          : 'mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-300 md:p-8'
      }
      style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
    >
      {/* Blocco 1: CTA (+ selettore solo fuori dall’Hub: in Hub c’è quello in header) */}
      <div
        className={`flex flex-col items-center text-center ${embedded ? 'mb-8 border-b border-[color:var(--hub-chrome-border-soft)] pb-8' : 'mb-8 border-b border-gray-200 pb-8'}`}
      >
        <p className={`mb-3 max-w-lg ${embedded ? 'text-sm text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}>
          {embedded
            ? "Seleziona un'azienda dal menu in alto per vedere le caselle di posta e i servizi attivi."
            : 'Seleziona la tua azienda nel menu per vedere le caselle di posta e i servizi attivi.'}
        </p>
        {showCenterSelect && (
          <div className="relative w-full max-w-sm">
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChange(v ? v : null);
              }}
              className="w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 text-gray-700 hover:border-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleziona Azienda...</option>
              {companies.filter(c => c.id != null).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.azienda || `ID ${c.id}`}</option>
              ))}
            </select>
            <Building size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
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

      <h2 className={`mb-3 text-2xl font-bold md:text-3xl ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>
        I tuoi accessi Email,{' '}
        <span className={embedded ? 'italic text-[color:var(--hub-accent)]' : 'italic text-blue-600'}>organizzati e sicuri.</span>
      </h2>

      <p className={`mb-8 max-w-3xl text-base leading-relaxed ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}>
        Questa sezione ti offre un riepilogo immediato delle tue caselle di posta e dei servizi attivi. Abbiamo semplificato la gestione tecnica per permetterti di trovare ciò che ti serve in pochi secondi, garantendo la continuità del tuo lavoro.
      </p>

      {/* Feature cards - 2x2 grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((feat) => {
          const Icon = feat.icon;
          const hi = hubFeatureIcon(feat);
          return (
            <div
              key={feat.title}
              className={
                embedded
                  ? 'flex cursor-default items-start gap-4 rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well-mid)] p-4 transition-all duration-200 hover:border-[color:var(--hub-accent-border)] hover:bg-[color:var(--hub-chrome-hover)]'
                  : `flex cursor-default items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 ${feat.cardHover}`
              }
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${embedded ? hi.wrap : feat.iconBg}`}
              >
                <Icon size={24} className={embedded ? hi.icon : feat.iconColor} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className={`mb-1 font-bold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>{feat.title}</h3>
                <p className={`text-sm leading-snug ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}>{feat.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sezione "Perché è utile" */}
      <div className={`mt-8 border-t pt-6 ${embedded ? 'border-[color:var(--hub-chrome-border-soft)]' : 'border-gray-200'}`}>
        <h3 className={`mb-2 font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-900'}`}>Perché è utile per te?</h3>
        <p className={`text-sm leading-relaxed italic ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-600'}`}>
          Non dovrai più cercare tra vecchie fatture o documenti cartacei: qui hai l&apos;elenco aggiornato delle tue risorse digitali, con la possibilità di richiedere intervento tecnico con un solo clic grazie al tasto <strong className={embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : ''}>Apri ticket</strong>.
        </p>
      </div>
    </div>
  );
};

export default EmailIntroCard;
