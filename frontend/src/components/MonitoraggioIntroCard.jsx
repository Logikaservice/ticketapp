// Blocco introduttivo "Progetto esclusivo" per clienti in Monitoraggio Rete / Mappatura
// Mostrato prima del selettore azienda, con effetti hover sulle card

import React from 'react';
import { Zap, ShieldCheck, Monitor, Map } from 'lucide-react';

const features = [
  {
    title: 'Tempo Reale',
    description: 'Ogni pacchetto e ogni stato è monitorato istantaneamente.',
    icon: Zap,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-green-200'
  },
  {
    title: 'Sicurezza Attiva',
    description: 'Rilevamento immediato di anomalie o intrusioni.',
    icon: ShieldCheck,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-purple-200'
  },
  {
    title: 'Inventario Dispositivi',
    description: 'Vedi esattamente chi e cosa è connesso alla tua rete aziendale.',
    icon: Monitor,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-sky-200'
  },
  {
    title: 'Mappatura Logica',
    description: 'Visualizza graficamente l\'intera architettura della tua infrastruttura.',
    icon: Map,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    cardHover: 'hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-violet-200'
  }
];

const MonitoraggioIntroCard = () => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8 transition-shadow duration-300">
      {/* Pill label */}
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 mb-4">
        PROGETTO ESCLUSIVO & PERSONALIZZATO
      </span>

      {/* Title */}
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
        L'infrastruttura della tua azienda,{' '}
        <span className="text-blue-600 italic">sotto controllo assoluto.</span>
      </h2>

      {/* Description */}
      <p className="text-gray-600 text-base leading-relaxed mb-8 max-w-3xl">
        Questo non è un semplice pannello di controllo. È un ecosistema su misura progettato per garantirti trasparenza totale sulla tua rete. Abbiamo unito precisione tecnica e semplicità visiva per permetterti di decidere in tempo reale.
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
    </div>
  );
};

export default MonitoraggioIntroCard;
