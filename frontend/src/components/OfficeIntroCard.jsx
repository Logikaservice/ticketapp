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

const OfficeIntroCard = ({ companies = [], value = '', onChange = null }) => {
  const showSelector = Array.isArray(companies) && companies.length > 0 && typeof onChange === 'function';
  const selectValue = value != null ? String(value) : '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8 transition-shadow duration-300">
      {/* Blocco 1: CTA + selettore azienda */}
      <div className="flex flex-col items-center text-center pb-8 mb-8 border-b border-gray-200">
        <p className="text-gray-600 mb-3">
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
        Gestione Licenze Office,{' '}
        <span className="text-blue-600 italic">sotto controllo.</span>
      </h2>

      <p className="text-gray-600 text-base leading-relaxed mb-8 max-w-3xl">
        Questa sezione ti permette di monitorare la distribuzione delle licenze Microsoft Office all&apos;interno della tua organizzazione. Grazie a questa vista, puoi verificare come vengono utilizzati i software e su quali dispositivi o utenti sono attive le licenze, ottimizzando le risorse digitali della tua azienda.
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

      {/* Nota sulla precisione dei dati */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex gap-2 items-start p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Nota sulla precisione dei dati</h3>
            <p className="text-sm text-amber-800 leading-relaxed">
              Le informazioni riportate in questa finestra riflettono esclusivamente le analisi eseguite e documentate da Logika Service. Qualora venissero eseguite attività, installazioni o spostamenti di licenza che <strong>non vengono comunicati</strong> alla Logika Service (e quindi non riportati ufficialmente in questo documento), potrebbero riscontrarsi delle discrepanze tra lo stato reale dei dispositivi e i dati qui visualizzati.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficeIntroCard;
