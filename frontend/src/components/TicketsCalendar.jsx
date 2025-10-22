import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TicketsCalendar = ({ tickets, onTicketClick, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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
  const relevantStates = ['in_lavorazione', 'risolto', 'chiuso', 'inviato', 'fatturato'];
  
  // Filtra i ticket per stati rilevanti
  const relevantTickets = tickets.filter(ticket => 
    relevantStates.includes(ticket.stato)
  );

  // Raggruppa i ticket per data e priorità
  const ticketsByDate = useMemo(() => {
    const grouped = {};
    
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
    
    return grouped;
  }, [relevantTickets]);

  // Funzione per ottenere il colore della priorità
  const getPriorityColor = (priorita) => {
    switch (priorita) {
      case 'urgente': return 'bg-red-500';
      case 'alta': return 'bg-orange-500';
      case 'media': return 'bg-blue-500';
      case 'bassa': return 'bg-gray-500';
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
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-gray-600 mb-2">Legenda priorità:</div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketsCalendar;
