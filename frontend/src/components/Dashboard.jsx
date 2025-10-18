// src/components/Dashboard.jsx

import React, { useMemo, useEffect, useRef } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2, ChevronsRight, ChevronsLeft } from 'lucide-react';
import TicketListContainer from './TicketListContainer';
import { formatDate } from '../utils/formatters';

const StatCard = ({ title, value, highlight = null, onClick }) => {
  const ringClass = highlight ? (highlight.type === 'up' ? 'ring-pulse-green' : 'ring-pulse-red') : '';
  return (
    <button onClick={onClick} className={`text-center w-full`}>
      <div className={`p-4 rounded-xl border bg-white relative ${ringClass}`}>
        <div className="text-sm text-gray-500 mb-1">{title}</div>
        <div className="text-5xl font-extrabold gradient-text animate-pulse-strong leading-none">{value}</div>
        {highlight && (
          <div className={`absolute bottom-2 right-2 flex items-center gap-1 ${highlight.type === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {highlight.type === 'up' ? (
              <>
                <span className="animate-arrow-slide"><ChevronsRight size={18} /></span>
                <span className="animate-arrow-slide" style={{ animationDelay: '0.2s' }}><ChevronsRight size={18} /></span>
              </>
            ) : (
              <>
                <span className="animate-arrow-slide"><ChevronsLeft size={18} /></span>
                <span className="animate-arrow-slide" style={{ animationDelay: '0.2s' }}><ChevronsLeft size={18} /></span>
              </>
            )}
          </div>
        )}
        {highlight && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full ${highlight.type === 'up' ? 'bg-green-400' : 'bg-red-400'} blur-md opacity-80`}></div>
        )}
      </div>
    </button>
  );
};

const CalendarStub = () => (
  <div className="bg-white rounded-xl border p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold">Ottobre 2025</h3>
      <div className="flex gap-2 text-gray-400">
        <button>&lt;</button>
        <button>&gt;</button>
      </div>
    </div>
    <div className="grid grid-cols-7 gap-2 text-center text-xs">
      {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
        <div key={d} className="text-gray-500">{d}</div>
      ))}
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg border flex items-center justify-center text-sm bg-gray-50" />
      ))}
    </div>
    <div className="mt-3 text-xs text-gray-500">Legenda Impegni: Priorità base/Media/Alta/Urgente</div>
  </div>
);

const AlertsPanel = ({ onOpenTicket }) => (
  <div className="bg-white rounded-xl border">
    <div className="p-4 border-b flex items-center justify-between">
      <h3 className="font-semibold">Avvisi Importanti</h3>
      <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-xs font-bold">⚠ Avvisi</span>
    </div>
    <div className="p-4 space-y-3">
      {[ 
        { id: 1, title: 'Sospensione Backup!', body: 'Servizio sospeso per manutenzione urgente. Ritorno previsto: 19/10/2025.', color: 'border-red-300 bg-red-50 text-red-800' },
        { id: 2, title: 'Anomalia Server Riscontrata', body: 'Picco I/O su server principale. Monitorare CPU prossime 2 ore.', color: 'border-yellow-300 bg-yellow-50 text-yellow-800' },
        { id: 3, title: 'Nuova Minaccia Zero-Day', body: 'Rilasciata patch urgente di sicurezza. Collegarsi al sito per scaricare.', color: 'border-blue-300 bg-blue-50 text-blue-800' }
      ].map(avv => (
        <button key={avv.id} onClick={() => onOpenTicket && onOpenTicket({ id: avv.id })} className={`w-full text-left p-3 rounded-lg border ${avv.color}`}>
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle size={16} />
            {avv.title}
          </div>
          <div className="text-sm mt-1">{avv.body}</div>
        </button>
      ))}
    </div>
  </div>
);

const Dashboard = ({ currentUser, tickets, users, selectedTicket, setSelectedTicket, handlers, getUnreadCount, onOpenState }) => {
  const counts = useMemo(() => ({
    aperto: tickets.filter(t => t.stato === 'aperto').length,
    in_lavorazione: tickets.filter(t => t.stato === 'in_lavorazione').length,
    risolto: tickets.filter(t => t.stato === 'risolto').length,
    chiuso: tickets.filter(t => t.stato === 'chiuso').length,
    inviato: tickets.filter(t => t.stato === 'inviato').length,
    fatturato: tickets.filter(t => t.stato === 'fatturato').length
  }), [tickets]);

  // Evidenzia spostamenti tra stati (approssimazione: confronta conteggi consecutivi)
  const prevCountsRef = useRef(counts);
  useEffect(() => { prevCountsRef.current = counts; }, [counts]);
  const prev = prevCountsRef.current;
  const order = ['aperto','in_lavorazione','risolto','chiuso','inviato','fatturato'];
  const deltas = Object.fromEntries(order.map(k => [k, (counts[k] || 0) - (prev[k] || 0)]));
  const highlights = Object.fromEntries(order.map(k => [k, null]));
  order.forEach((k, idx) => {
    const d = deltas[k];
    const prevKey = order[idx - 1];
    const nextKey = order[idx + 1];
    if (d > 0 && prevKey && deltas[prevKey] < 0) highlights[k] = { type: 'up' };
    if (d < 0 && nextKey && deltas[nextKey] > 0) highlights[k] = { type: 'down' };
  });

  const roleLabel = currentUser?.ruolo === 'tecnico' ? 'Tecnico' : 'Cliente';

  const statCards = [
    { key: 'aperto', title: 'Aperti', value: counts.aperto },
    { key: 'in_lavorazione', title: 'In lavorazione', value: counts.in_lavorazione },
    { key: 'risolto', title: 'Risolti', value: counts.risolto },
    { key: 'chiuso', title: 'Chiusi', value: counts.chiuso },
    { key: 'inviato', title: 'Inviati', value: counts.inviato },
    { key: 'fatturato', title: 'Fatturati', value: counts.fatturato }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Dashboard Riepilogo ({roleLabel})</h2>
        <div className="text-sm text-gray-500">Oggi: {formatDate(new Date().toISOString())}</div>
      </div>

      {/* Stat menu style */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        {statCards.map(sc => (
          <StatCard
            key={sc.key}
            title={sc.title}
            value={sc.value}
            highlight={highlights[sc.key]}
            onClick={() => onOpenState && onOpenState(sc.key)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertsPanel onOpenTicket={(t) => {
            if (!t || !t.id) return;
            // Collegabile al ticket: per ora esempio
            // Potremmo usare handlers.handleSelectTicket quando disponibile
          }} />
          {/* Qui possiamo aggiungere altri contenuti; la lista completa è nella vista Ticket */}
        </div>
        <div>
          <CalendarStub />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
