// Blocco introduttivo "Parco Macchine" per Dispositivi Aziendali
// Stessa struttura di AntiVirusIntroCard / EmailIntroCard

import React from 'react';
import { List, Monitor, Settings, Calendar, Building, AlertTriangle } from 'lucide-react';

const features = [
  {
    title: 'Inventario Completo',
    description: 'Visualizza l\'elenco aggiornato di tutti i dispositivi hardware, inclusi PC desktop, laptop e workstation, con le loro caratteristiche tecniche principali.',
    icon: List,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-sky-200'
  },
  {
    title: 'Dettaglio e Assegnazione',
    description: 'Identifica rapidamente ogni macchina, il suo utilizzatore principale, il dipartimento di appartenenza e l\'ubicazione fisica per una tracciabilità totale.',
    icon: Monitor,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-sky-200'
  },
  {
    title: 'Tipologie e Sistemi',
    description: 'Analizza la composizione del parco macchine per modello, produttore e sistema operativo installato per capire la distribuzione delle risorse.',
    icon: Settings,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-violet-200'
  },
  {
    title: 'Ciclo di Vita e Rinnovi',
    description: 'Tieni sotto controllo l\'età dei dispositivi e le scadenze delle garanzie per pianificare per tempo sostituzioni e aggiornamenti tecnologici.',
    icon: Calendar,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-violet-200'
  }
];

const DispositiviAziendaliIntroCard = ({ companies = [], value = '', onChange = null }) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8 transition-shadow duration-300">
      {/* Blocco 1: CTA + selettore azienda */}
      <div className="flex flex-col items-center text-center pb-8 mb-8 border-b border-gray-200">
        <p className="text-gray-600 mb-3">
          Seleziona la tua azienda nel menu per consultare l&apos;inventario e lo stato dei dispositivi aziendali.
        </p>
        {showSelector && (
          <div className="relative w-full max-w-sm">
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                onChange(v ? v : null);
              }}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none cursor-pointer"
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

      {/* Blocco 2: Progetto esclusivo (pill, titolo, descrizione) */}
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 mb-4">
        PROGETTO ESCLUSIVO & PERSONALIZZATO
      </span>

      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
        Panoramica Parco Macchine,{' '}
        <span className="text-teal-600 italic">gestione centralizzata.</span>
      </h2>

      <p className="text-gray-600 text-base leading-relaxed mb-8 max-w-3xl">
        In questa sezione puoi consultare l&apos;inventario completo e lo stato di ogni singolo computer e dispositivo facente parte del tuo parco informatico aziendale. Non si tratta di un semplice elenco, ma di una visione d&apos;insieme che permette di conoscere le specifiche, l&apos;ubicazione e l&apos;assegnazione di ogni macchina per una gestione efficiente e informata.
      </p>

      {/* Fattori Chiave della Gestione - 2x2 grid */}
      <h3 className="font-semibold text-gray-900 mb-4">Fattori Chiave della Gestione</h3>
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

      {/* Nota sulla precisione dei dati */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex gap-2 items-start p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Nota sulla precisione dei dati</h3>
            <p className="text-sm text-amber-800 leading-relaxed">
              Le informazioni riportate in questa finestra riflettono i dati registrati nei sistemi di gestione centralizzata. Qualora vengano effettuati spostamenti fisici, cambi di assegnazione o dimissioni senza darne comunicazione al reparto competente, potrebbero riscontrarsi delle discrepanze tra lo stato reale del parco macchine e i dati qui visualizzati.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispositiviAziendaliIntroCard;
