// src/components/Dashboard.jsx

import React, { useMemo, useEffect } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2, X } from 'lucide-react';
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

const AlertsPanel = ({ alerts = [], onOpenTicket, onDelete, isEditable, onManageAlerts, currentUser }) => (
  <div className="bg-white rounded-xl border">
    <div className="p-4 border-b flex items-center justify-between">
      <h3 className="font-semibold">Avvisi Importanti</h3>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-xs font-bold">⚠ Avvisi</span>
        {currentUser?.ruolo === 'tecnico' && (
          <button
            onClick={onManageAlerts}
            className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Gestione Avvisi
          </button>
        )}
      </div>
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
  const [showManageAlerts, setShowManageAlerts] = React.useState(false);
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

  // Avvisi: ora da API backend
  const [alerts, setAlerts] = React.useState([]);
  const apiBase = process.env.REACT_APP_API_URL;
  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${apiBase}/api/alerts`);
      if (!res.ok) throw new Error('Errore caricamento avvisi');
      setAlerts(await res.json());
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => { fetchAlerts(); }, []);

  const [newAlert, setNewAlert] = React.useState({ title: '', body: '', level: 'warning' });
  const levelToColor = (level) => {
    if (level === 'danger') return 'border-red-300 bg-red-50 text-red-800';
    if (level === 'info') return 'border-blue-300 bg-blue-50 text-blue-800';
    return 'border-yellow-300 bg-yellow-50 text-yellow-800';
  };
  const addAlert = async () => {
    if (!newAlert.title || !newAlert.body) return;
    try {
      const res = await fetch(`${apiBase}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'tecnico' },
        body: JSON.stringify({ title: newAlert.title, body: newAlert.body, level: newAlert.level })
      });
      if (!res.ok) throw new Error('Errore creazione avviso');
      setNewAlert({ title: '', body: '', level: 'warning' });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };
  const deleteAlert = async (id) => {
    try {
      const res = await fetch(`${apiBase}/api/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'tecnico' }
      });
      if (!res.ok) throw new Error('Errore eliminazione avviso');
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
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
        <div className="lg:col-span-2">
          <AlertsPanel 
            alerts={alerts}
            onDelete={currentUser?.ruolo === 'tecnico' ? deleteAlert : undefined}
            isEditable={currentUser?.ruolo === 'tecnico'}
            onOpenTicket={(t) => {
              if (!t || !t.id) return;
              // Integrazione futura: handlers.handleSelectTicket
            }}
            onManageAlerts={() => setShowManageAlerts(true)}
            currentUser={currentUser}
          />

          {/* Qui possiamo aggiungere altri contenuti; la lista completa è nella vista Ticket */}
        </div>
        <div>
          <CalendarStub />
        </div>
      </div>

      {/* Modal Gestione Avvisi */}
      {showManageAlerts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Gestione Avvisi</h2>
                  <p className="text-sm text-gray-500">Crea e gestisci gli avvisi per i clienti</p>
                </div>
              </div>
              <button
                onClick={() => setShowManageAlerts(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Funzionalità in sviluppo</p>
                  <p className="text-sm">Il modal di gestione avvisi sarà implementato nel prossimo step</p>
                </div>
                <button
                  onClick={() => setShowManageAlerts(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
