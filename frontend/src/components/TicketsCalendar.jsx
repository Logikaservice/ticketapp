import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ExternalLink, X } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useAvailability } from '../hooks/useAvailability';
import { SYNC_STATES } from '../config/googleConfig';

const TicketsCalendar = ({ tickets, onTicketClick, currentUser, getAuthHeader }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateTickets, setSelectedDateTickets] = useState([]);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState(null);
  const [availabilityReason, setAvailabilityReason] = useState('');
  
  // Hook per Google Calendar
  const { syncTicketToCalendarBackend } = useGoogleCalendar();
  
  // Hook per gestire i giorni non disponibili
  const { 
    unavailableDays, 
    isDateUnavailable, 
    getUnavailableReason, 
    setDayUnavailable, 
    setDayAvailable 
  } = useAvailability(getAuthHeader);


  // Funzione per gestire il click sui giorni
  const handleDayClick = (day, event) => {
    // Se si tiene premuto Ctrl/Cmd, gestisci la disponibilità invece dei ticket
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      handleAvailabilityClick(day);
      return;
    }
    
    const allTicketsForDay = [];
    
    // Raccoglie tutti i ticket del giorno selezionato
    Object.values(day.tickets).forEach(ticketsArray => {
      allTicketsForDay.push(...ticketsArray);
    });
    
    if (allTicketsForDay.length > 0) {
      setSelectedDate(day.date);
      setSelectedDateTickets(allTicketsForDay);
    } else {
      setSelectedDate(null);
      setSelectedDateTickets([]);
    }
  };

  // Funzione per gestire il click sui controlli di disponibilità
  const handleAvailabilityClick = (day) => {
    const dateString = day.dateKey;
    console.log('🔍 DEBUG AVAILABILITY CLICK: Data selezionata:', dateString, 'Giorno:', day.date.getDate());
    
    const isUnavailable = isDateUnavailable(dateString);
    
    if (isUnavailable) {
      // Se è già non disponibile, rimuovilo
      setDayAvailable(dateString);
    } else {
      // Se è disponibile, apri il modal per impostarlo come non disponibile
      setAvailabilityDate(dateString);
      setAvailabilityReason(getUnavailableReason(dateString) || '');
      setShowAvailabilityModal(true);
    }
  };

  // Funzione per salvare la disponibilità
  const handleSaveAvailability = async () => {
    if (!availabilityDate) return;
    
    console.log('🔍 DEBUG CALENDAR: Tentativo di salvare disponibilità per:', availabilityDate);
    const result = await setDayUnavailable(availabilityDate, availabilityReason);
    console.log('🔍 DEBUG CALENDAR: Risultato salvataggio:', result);
    
    if (result.success) {
      setShowAvailabilityModal(false);
      setAvailabilityDate(null);
      setAvailabilityReason('');
      console.log('✅ CALENDAR: Giorno non disponibile salvato con successo');
    } else {
      console.error('❌ CALENDAR: Errore nel salvare:', result.error);
      // Potresti aggiungere una notifica di errore qui
    }
  };

  // Funzione per chiudere il modal
  const handleCloseAvailabilityModal = () => {
    setShowAvailabilityModal(false);
    setAvailabilityDate(null);
    setAvailabilityReason('');
  };

  // Funzione per gestire il click sui ticket nella lista
  const handleTicketClick = (ticket) => {
    // Chiude la lista
    setSelectedDate(null);
    setSelectedDateTickets([]);
    
    // Naviga al ticket
    if (onTicketClick) {
      onTicketClick(ticket);
    }
  };

  // Calendario disponibile per tutti (tecnici e clienti)
  // I clienti vedranno solo i loro ticket

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
      if (!ticket.dataapertura) {
        return;
      }
      
      // SOLUZIONE FUSO ORARIO: Gestisci correttamente le date UTC
      let dateKey;
      
      if (ticket.dataapertura.includes('T')) {
        // Se è in formato ISO, estrai solo la parte data senza conversione fuso orario
        const dateOnly = ticket.dataapertura.split('T')[0];
        
        // Usa direttamente la data senza conversione per evitare problemi di fuso orario
        dateKey = dateOnly;
      } else {
        // Se è già solo data, usa direttamente
        dateKey = ticket.dataapertura;
      }
      
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
    
    // Corregge l'allineamento: getDay() restituisce 0=domenica, 1=lunedì, etc.
    // Ma il calendario inizia con lunedì, quindi dobbiamo aggiustare
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Domenica=6, Lunedì=0
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    const days = [];
    const current = new Date(startDate);
    
    // Genera 42 giorni (6 settimane)
    for (let i = 0; i < 42; i++) {
      // Usa la data locale per evitare problemi di fuso orario
      // IMPORTANTE: Calcola dateKey PRIMA di modificare current
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      const isCurrentMonth = current.getMonth() === currentDate.getMonth();
      const isToday = current.toDateString() === new Date().toDateString();
      
      days.push({
        date: new Date(current),
        dateKey,
        isCurrentMonth,
        isToday,
        tickets: ticketsByDate[dateKey] || {},
        isUnavailable: isDateUnavailable(dateKey),
        unavailableReason: getUnavailableReason(dateKey)
      });
      
      // Incrementa la data DOPO aver calcolato dateKey
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
          {calendarDays.map((day, index) => {
            const hasTickets = Object.values(day.tickets).flat().length > 0;
            const isSelected = selectedDate && selectedDate.toDateString() === day.date.toDateString();
            
            return (
              <div
                key={index}
                className={`min-h-[40px] p-1 border rounded cursor-pointer transition-all relative ${
                  day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${day.isToday ? 'ring-2 ring-blue-500' : ''} ${
                  isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
                } ${hasTickets ? 'hover:bg-blue-50 hover:border-blue-300' : ''} ${
                  day.isUnavailable ? 'bg-gray-800 text-white' : ''
                }`}
                onClick={(e) => handleDayClick(day, e)}
                title={
                  day.isUnavailable 
                    ? `Non disponibile${day.unavailableReason ? ': ' + day.unavailableReason : ''} • Ctrl+Click per gestire disponibilità`
                    : hasTickets 
                      ? `Click per vedere i ticket del ${day.date.toLocaleDateString('it-IT')} • Ctrl+Click per gestire disponibilità`
                      : `Ctrl+Click per gestire disponibilità`
                }
              >
                <div className={`text-xs ${day.isCurrentMonth ? (day.isUnavailable ? 'text-white' : 'text-gray-900') : 'text-gray-400'}`}>
                  {day.date.getDate()}
                </div>
                
                {/* Pallini per priorità */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(day.tickets).map(([priorita, tickets]) => (
                    <div
                      key={priorita}
                      className={`w-2 h-2 rounded-full ${getPriorityColor(priorita)}`}
                      title={`${getPriorityName(priorita)}: ${tickets.length} ticket`}
                    />
                  ))}
                </div>
                
                {/* Indicatore giorno non disponibile */}
                {day.isUnavailable && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" title="Non disponibile"></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Lista ticket del giorno selezionato */}
        {selectedDate && selectedDateTickets.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">
                Ticket del {selectedDate.toLocaleDateString('it-IT')} ({selectedDateTickets.length})
              </h4>
              <button
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedDateTickets([]);
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ✕ Chiudi
              </button>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDateTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    getPriorityColor(ticket.priorita).replace('bg-', 'border-l-4 border-l-')
                  }`}
                  onClick={() => handleTicketClick(ticket)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">#{ticket.numero}</span>
                        <span className={`px-2 py-1 text-xs rounded-full text-white ${getPriorityColor(ticket.priorita)}`}>
                          {getPriorityName(ticket.priorita)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{ticket.titolo}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Cliente: {ticket.cliente} • Stato: {ticket.stato}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Click per aprire
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controlli disponibilità */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-gray-600 mb-2">Gestione disponibilità (tutti i giorni visibili):</div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isUnavailable = day.isUnavailable;
              return (
                <div
                  key={index}
                  className={`min-h-[30px] p-1 border rounded cursor-pointer transition-all flex items-center justify-center relative ${
                    day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  } ${isUnavailable ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}
                  onClick={() => handleAvailabilityClick(day)}
                  title={
                    isUnavailable 
                      ? `Rimuovi come non disponibile${day.unavailableReason ? ': ' + day.unavailableReason : ''}`
                      : `Imposta come non disponibile - ${day.dateKey}`
                  }
                >
                  <div className={`text-xs ${day.isCurrentMonth ? (isUnavailable ? 'text-white' : 'text-gray-900') : (isUnavailable ? 'text-white' : 'text-gray-400')}`}>
                    {day.date.getDate()}
                  </div>
                  {isUnavailable && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <div>• Clicca sui giorni qui sotto per impostare/rimuovere la disponibilità</div>
            <div>• Oppure usa Ctrl+Click sui giorni del calendario principale</div>
            <div>• Funziona per tutti i mesi (passati, presenti e futuri)</div>
          </div>
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
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-800"></div>
              <span>Non disponibile</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal per gestire la disponibilità */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Imposta giorno non disponibile</h3>
              <button
                onClick={handleCloseAvailabilityModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data: {availabilityDate && new Date(availabilityDate).toLocaleDateString('it-IT')}
              </label>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo (opzionale)
              </label>
              <textarea
                value={availabilityReason}
                onChange={(e) => setAvailabilityReason(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Es: Vacanze, malattia, impegno personale..."
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseAvailabilityModal}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveAvailability}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Imposta non disponibile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsCalendar;
