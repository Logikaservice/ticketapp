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

const EmailIntroCard = ({ companies = [], value = '', onChange = null }) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8 transition-shadow duration-300">
      {/* Blocco 1: CTA + selettore azienda */}
      <div className="flex flex-col items-center text-center pb-8 mb-8 border-b border-gray-200">
        <p className="text-gray-600 mb-3">
          Seleziona la tua azienda nel menu per vedere le caselle di posta e i servizi attivi.
        </p>
        {showSelector && (
          <div className="relative w-full max-w-sm">
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChange(v ? v : null);
              }}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="">Seleziona Azienda...</option>
              {companies.filter(c => c.id != null).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.azienda || `ID ${c.id}`}</option>
              ))}
            </select>
            <Building size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Blocco 2: Progetto esclusivo (pill, titolo, descrizione, card) */}
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 mb-4">
        PROGETTO ESCLUSIVO & PERSONALIZZATO
      </span>

      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
        I tuoi accessi Email,{' '}
        <span className="text-blue-600 italic">organizzati e sicuri.</span>
      </h2>

      <p className="text-gray-600 text-base leading-relaxed mb-8 max-w-3xl">
        Questa sezione ti offre un riepilogo immediato delle tue caselle di posta e dei servizi attivi. Abbiamo semplificato la gestione tecnica per permetterti di trovare ciò che ti serve in pochi secondi, garantendo la continuità del tuo lavoro.
      </p>

      {/* Feature cards - 2x2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className={`bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4 transition-all duration-200 cursor-default ${feat.cardHover}`}
            >
              <div className={`shrink-0 w-12 h-12 rounded-xl ${feat.iconBg} flex items-center justify-center`}>
                <Icon size={24} className={feat.iconColor} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 mb-1">{feat.title}</h3>
                <p className="text-sm text-gray-600 leading-snug">{feat.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sezione "Perché è utile" */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">Perché è utile per te?</h3>
        <p className="text-gray-600 text-sm leading-relaxed italic">
          Non dovrai più cercare tra vecchie fatture o documenti cartacei: qui hai l&apos;elenco aggiornato delle tue risorse digitali, con la possibilità di richiedere intervento tecnico con un solo clic grazie al tasto <strong>Apri ticket</strong>.
        </p>
      </div>
    </div>
  );
};

export default EmailIntroCard;
