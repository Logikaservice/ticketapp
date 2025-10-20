// src/components/Dashboard.jsx

import React, { useMemo, useEffect } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2 } from 'lucide-react';
import TicketListContainer from './TicketListContainer';
import { formatDate } from '../utils/formatters';

const StatCard = ({ title, value, icon, highlight = null, onClick, disabled, badge = null }) => {
  const ringClass = highlight
    ? highlight.type === 'up'
      ? 'ring-pulse-green'
      : highlight.type === 'down'
        ? 'ring-pulse-red'
        : 'ring-pulse-green'
    : '';
  return (
    <button onClick={onClick} disabled={disabled} className={`text-center w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className={`p-4 rounded-xl border bg-white relative ${ringClass}`}>
        {badge && (
          <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-green-600 text-white px-2 py-[2px] rounded-full shadow-sm animate-new-float">
            {badge}
          </span>
        )}
        <div className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-2">{icon}<span>{title}</span></div>
        <div className="text-5xl font-extrabold gradient-text animate-pulse-strong leading-none">{value}</div>
        {/* Frecce rimosse su richiesta */}
        {highlight && highlight.type === 'up' && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full bg-green-400 blur-md opacity-80`}></div>
        )}
        {highlight && highlight.type === 'down' && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full bg-red-400 blur-md opacity-80`}></div>
        )}
        {/* badge NEW ora gestito via prop 'badge' */}
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

const AlertsPanel = ({ alerts = [], onOpenTicket, onDelete, isEditable }) => (
  <div className="bg-white rounded-xl border">
    <div className="p-4 border-b flex items-center justify-between">
      <h3 className="font-semibold">Avvisi Importanti</h3>
      <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-xs font-bold">⚠ Avvisi</span>
    </div>
    <div className="p-4 space-y-3">
      {alerts.length === 0 && (
        <div className="text-sm text-gray-500">Nessun avviso presente.</div>
      )}
      {alerts.map(avv => (
        <div key={avv.id} className={`w-full p-3 rounded-lg border ${avv.color || 'border-yellow-300 bg-yellow-50 text-yellow-800'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle size={16} />
                {avv.title}
              </div>
              <div className="text-sm mt-1">{avv.body}</div>
            </div>
            {isEditable && (
              <button onClick={() => onDelete && onDelete(avv.id)} className="text-xs text-red-600 hover:underline">Rimuovi</button>
            )}
          </div>
          {avv.ticketId && (
            <div className="mt-2">
              <button onClick={() => onOpenTicket && onOpenTicket({ id: avv.ticketId })} className="text-xs text-blue-700 hover:underline">Apri ticket collegato</button>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const Dashboard = ({ currentUser, tickets, users, selectedTicket, setSelectedTicket, handlers, getUnreadCount, onOpenState, externalHighlights }) => {
  const visibleTickets = useMemo(() => {
    if (currentUser?.ruolo === 'cliente') {
      return tickets.filter(t => t.clienteid === currentUser.id);
    }
    return tickets;
  }, [tickets, currentUser]);

  const counts = useMemo(() => ({
    aperto: visibleTickets.filter(t => t.stato === 'aperto').length,
    in_lavorazione: visibleTickets.filter(t => t.stato === 'in_lavorazione').length,
    risolto: visibleTickets.filter(t => t.stato === 'risolto').length,
    chiuso: visibleTickets.filter(t => t.stato === 'chiuso').length,
    inviato: visibleTickets.filter(t => t.stato === 'inviato').length,
    fatturato: visibleTickets.filter(t => t.stato === 'fatturato').length
  }), [visibleTickets]);
  // Evidenzia spostamenti basati su segnali esterni (eventi dal polling/azioni)
  const [activeHighlights, setActiveHighlights] = React.useState({});
  useEffect(() => {
    if (!externalHighlights) return;
    setActiveHighlights(externalHighlights);
  }, [externalHighlights]);

  // Badge NEW elegante su 'Aperti' quando arriva evento 'dashboard-new'
  const [showNewBadge, setShowNewBadge] = React.useState(false);
  useEffect(() => {
    const handler = (e) => {
      const { state } = e.detail || {};
      if (state === 'aperto') {
        setShowNewBadge(true);
        setTimeout(() => setShowNewBadge(false), 4000);
      }
    };
    window.addEventListener('dashboard-new', handler);
    return () => window.removeEventListener('dashboard-new', handler);
  }, []);

  const roleLabel = currentUser?.ruolo === 'tecnico' ? 'Tecnico' : 'Cliente';

  // Avvisi: storage locale semplice per prima versione
  const [alerts, setAlerts] = React.useState(() => {
    try {
      const raw = localStorage.getItem('dashboard_alerts');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('dashboard_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const [newAlert, setNewAlert] = React.useState({ title: '', body: '', level: 'warning' });
  const levelToColor = (level) => {
    if (level === 'danger') return 'border-red-300 bg-red-50 text-red-800';
    if (level === 'info') return 'border-blue-300 bg-blue-50 text-blue-800';
    return 'border-yellow-300 bg-yellow-50 text-yellow-800';
  };
  const addAlert = () => {
    if (!newAlert.title || !newAlert.body) return;
    setAlerts(prev => [
      { id: Date.now(), title: newAlert.title, body: newAlert.body, color: levelToColor(newAlert.level) },
      ...prev
    ]);
    setNewAlert({ title: '', body: '', level: 'warning' });
  };
  const deleteAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const statCards = [
    { key: 'aperto', title: 'Aperti', value: counts.aperto, icon: <FileText size={14} /> },
    { key: 'in_lavorazione', title: 'In lavorazione', value: counts.in_lavorazione, icon: <PlayCircle size={14} /> },
    { key: 'risolto', title: 'Risolti', value: counts.risolto, icon: <CheckCircle size={14} /> },
    { key: 'chiuso', title: 'Chiusi', value: counts.chiuso, icon: <Archive size={14} /> },
    { key: 'inviato', title: 'Inviati', value: counts.inviato, icon: <Send size={14} /> },
    { key: 'fatturato', title: 'Fatturati', value: counts.fatturato, icon: <FileCheck2 size={14} /> }
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
            icon={sc.icon}
            value={sc.value}
            highlight={activeHighlights[sc.key]}
            disabled={sc.value === 0}
            badge={showNewBadge && sc.key === 'aperto' ? 'NEW' : null}
            onClick={() => sc.value > 0 && onOpenState && onOpenState(sc.key)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {currentUser?.ruolo === 'tecnico' && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Gestione Avvisi</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Titolo avviso"
                  value={newAlert.title}
                  onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Dettaglio avviso"
                  value={newAlert.body}
                  onChange={(e) => setNewAlert({ ...newAlert, body: e.target.value })}
                  className="px-3 py-2 border rounded-lg md:col-span-2"
                />
                <select
                  value={newAlert.level}
                  onChange={(e) => setNewAlert({ ...newAlert, level: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="warning">Avviso</option>
                  <option value="danger">Critico</option>
                  <option value="info">Info</option>
                </select>
              </div>
              <div className="mt-3">
                <button onClick={addAlert} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Aggiungi Avviso</button>
              </div>
            </div>
          )}

          <AlertsPanel 
            alerts={alerts}
            onDelete={currentUser?.ruolo === 'tecnico' ? deleteAlert : undefined}
            isEditable={currentUser?.ruolo === 'tecnico'}
            onOpenTicket={(t) => {
              if (!t || !t.id) return;
              // Integrazione futura: handlers.handleSelectTicket
            }}
          />

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
