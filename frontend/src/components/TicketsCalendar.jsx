import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ExternalLink } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { SYNC_STATES } from '../config/googleConfig';

const TicketsCalendar = ({ tickets, onTicketClick, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showGoogleEvents, setShowGoogleEvents] = useState(false);
  
  // Hook per Google Calendar
  const {
    isAuthenticated,
    events: googleEvents,
    loading: googleLoading,
    error: googleError,
    authenticate,
    signOut,
    loadEvents,
    syncTicketToCalendar,
    updateCalendarEvent,
    deleteCalendarEvent,
    autoSyncTicket,
    updateTicketInCalendar,
    checkExistingConnection
  } = useGoogleCalendar();

  // Controlla connessione Google esistente al caricamento
  useEffect(() => {
    if (currentUser?.ruolo === 'tecnico') {
      checkExistingConnection();
    }
  }, [currentUser, checkExistingConnection]);

  // Funzione per sincronizzare tutti i ticket
  const handleSyncAllTickets = async () => {
    try {
      const ticketsToSync = tickets.filter(ticket => 
        SYNC_STATES.includes(ticket.stato)
      );
      
      for (const ticket of ticketsToSync) {
        try {
          await syncTicketToCalendar(ticket);
          console.log(`Ticket #${ticket.id} sincronizzato con Google Calendar`);
        } catch (err) {
          console.error(`Errore sincronizzazione ticket #${ticket.id}:`, err);
        }
      }
      
      alert(`Sincronizzazione completata! ${ticketsToSync.length} ticket sincronizzati.`);
    } catch (err) {
      console.error('Errore sincronizzazione:', err);
      alert('Errore durante la sincronizzazione. Controlla la console per i dettagli.');
    }
  };

  // Solo per tecnici
  if (currentUser?.ruolo !== 'tecnico') {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Calendario</h3>
        <div className="text-sm text-gray-500">Calendario disponibile solo per i tecnici</div>
      </div>
    );
  }

  // Stati da considerare
  const relevantStates = SYNC_STATES;
  
  // Filtra i ticket per stati rilevanti
  const relevantTickets = tickets.filter(ticket => 
    relevantStates.includes(ticket.stato)
  );

  // Raggruppa i ticket per data e priorità
  const ticketsByDate = useMemo(() => {
    const grouped = {};
    
    // Aggiungi ticket
    relevantTickets.forEach(ticket => {
      if (!ticket.dataapertura) return;
      
      const date = new Date(ticket.dataapertura);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      if (!grouped[dateKey][ticket.priorita]) {
        grouped[dateKey][ticket.priorita] = [];
      }
      
      grouped[dateKey][ticket.priorita].push(ticket);
    });
    
    // Eventi Google Calendar non vengono mostrati nel calendario
    // Solo sincronizzazione ticket → Google Calendar
    
    return grouped;
  }, [relevantTickets, showGoogleEvents, googleEvents]);

  // Funzione per ottenere il colore della priorità
  const getPriorityColor = (priorita) => {
    switch (priorita) {
      case 'urgente': return 'bg-red-500';
      case 'alta': return 'bg-orange-500';
      case 'media': return 'bg-blue-500';
      case 'bassa': return 'bg-gray-500';
      case 'google': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Funzione per ottenere il nome della priorità
  const getPriorityName = (priorita) => {
    switch (priorita) {
      case 'urgente': return 'Urgente';
      case 'alta': return 'Alta';
      case 'media': return 'Media';
      case 'bassa': return 'Bassa';
      case 'google': return 'Google Calendar';
      default: return 'Sconosciuta';
    }
  };

  // Genera i giorni del mese
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    // Genera 42 giorni (6 settimane)
    for (let i = 0; i < 42; i++) {
      const dateKey = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === month;
      const isToday = current.toDateString() === new Date().toDateString();
      
      days.push({
        date: new Date(current),
        dateKey,
        isCurrentMonth,
        isToday,
        tickets: ticketsByDate[dateKey] || {}
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  // Navigazione mese
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Calendario Ticket</h3>
          <div className="flex items-center gap-2">
            {/* Controlli Google Calendar - Solo sincronizzazione */}
            <div className="flex items-center gap-2 mr-4">
              {!isAuthenticated ? (
                <button
                  onClick={authenticate}
                  disabled={googleLoading}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  <Calendar size={14} />
                  {googleLoading ? 'Caricamento...' : 'Connetti Google'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs rounded">
                    <Calendar size={14} />
                    Google Connesso
                  </div>
                  <button
                    onClick={signOut}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Disconnetti
                  </button>
                </div>
              )}
            </div>
            
            {/* Sincronizzazione Ticket */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 mr-4">
                <button 
                  onClick={handleSyncAllTickets} 
                  className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                >
                  <Calendar size={14} />
                  Sincronizza Ticket
                </button>
              </div>
            )}
            
            {/* Navigazione mese */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
        
            {/* Messaggi di errore Google Calendar */}
            {googleError && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                {googleError}
                {googleError.includes('non configurato') && (
                  <div className="mt-1 text-xs">
                    <strong>Soluzione:</strong> Configura le variabili d'ambiente su Render:
                    <br />• REACT_APP_GOOGLE_CLIENT_ID
                    <br />• REACT_APP_GOOGLE_CLIENT_SECRET  
                    <br />• REACT_APP_GOOGLE_PROJECT_ID
                    <br />• REACT_APP_GOOGLE_API_KEY
                  </div>
                )}
              </div>
            )}
            
            {/* Messaggio informativo */}
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
              📅 <strong>Sincronizzazione automatica:</strong> I ticket presi in carico vengono sincronizzati automaticamente con Google Calendar. Le modifiche ai ticket si riflettono automaticamente su Google Calendar. Gli eventi Google non vengono mostrati in questo calendario.
            </div>
      </div>

      <div className="p-4">
        {/* Header giorni settimana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 text-center py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Griglia calendario */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`min-h-[40px] p-1 border rounded ${
                day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } ${day.isToday ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className={`text-xs ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                {day.date.getDate()}
              </div>
              
              {/* Pallini per priorità */}
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(day.tickets).map(([priorita, tickets]) => (
                  <div
                    key={priorita}
                    className={`w-2 h-2 rounded-full ${getPriorityColor(priorita)} cursor-pointer hover:scale-125 transition-transform`}
                    title={`${getPriorityName(priorita)}: ${tickets.length} ticket`}
                    onClick={() => {
                      // Mostra tooltip con lista ticket
                      const ticketList = tickets.map(t => `${t.numero} - ${t.titolo}`).join('\n');
                      alert(`Ticket ${getPriorityName(priorita)}:\n${ticketList}`);
                    }}
                  />
                ))}
                
                {/* Eventi Google Calendar non vengono mostrati */}
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-gray-600 mb-2">Legenda:</div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>Urgente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>Alta</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Media</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span>Bassa</span>
            </div>
            {/* Google Calendar non viene mostrato nel calendario */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketsCalendar;
