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
  const [newUnavailableDaysInput, setNewUnavailableDaysInput] = useState('');
  
  // Hook per Google Calendar
  const { syncTicketToCalendarBackend } = useGoogleCalendar();
  
  // Hook per gestire i giorni non disponibili
  const { 
    unavailableDays, 
    isDateUnavailable, 
    getUnavailableReason, 
    setDayUnavailable, 
    setDayAvailable,
    loadUnavailableDays
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

  // Funzione per gestire il click sui giorni del calendario
  const handleCalendarDayClick = (day) => {
    // Converti la dataKey in formato italiano DD/MM/YYYY
    const date = new Date(day.dateKey);
    const dayStr = String(date.getDate()).padStart(2, '0');
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const yearStr = date.getFullYear();
    const italianDate = `${dayStr}/${monthStr}/${yearStr}`;
    
    // Pre-compila il campo con la data selezionata
    setNewUnavailableDaysInput(italianDate);
  };

  // Funzione per salvare la disponibilità (rimossa - non più necessaria)

  // Funzione per chiudere il modal (rimossa - non più necessaria)

  // Funzione per convertire formato italiano DD/MM/YYYY a YYYY-MM-DD
  const convertItalianDateToISO = (dateString) => {
    // Rimuovi spazi e controlla se è nel formato DD/MM/YYYY
    const cleanDate = dateString.trim();
    
    // Verifica se contiene le barre
    if (!cleanDate.includes('/')) {
      return null;
    }
    
    const parts = cleanDate.split('/');
    if (parts.length !== 3) {
      return null;
    }
    
    const [day, month, year] = parts;
    
    // Verifica che siano numeri
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return null;
    }
    
    // Verifica che il giorno sia tra 1-31, mese 1-12
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return null;
    }
    
    // Crea la data nel formato YYYY-MM-DD
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    // Verifica che la data sia valida
    const testDate = new Date(isoDate);
    if (isNaN(testDate.getTime())) {
      return null;
    }
    
    return isoDate;
  };

  // Funzione per salvare i giorni non disponibili dall'input
  const handleSaveNewUnavailableDays = async () => {
    if (!newUnavailableDaysInput.trim()) {
      alert('Inserisci almeno una data.');
      return;
    }

    const datesToProcess = newUnavailableDaysInput.split(',').map(s => s.trim()).filter(Boolean);
    let successCount = 0;
    let errorCount = 0;

    for (const dateString of datesToProcess) {
      try {
        // Converti dal formato italiano DD/MM/YYYY al formato ISO YYYY-MM-DD
        const isoDate = convertItalianDateToISO(dateString);
        
        if (!isoDate) {
          errorCount++;
          continue;
        }
        
        const result = await setDayUnavailable(isoDate, 'Indicato dall\'utente');
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (e) {
        errorCount++;
      }
    }

    if (successCount > 0) {
      alert(`✅ Operazione completata: ${successCount} date salvate${errorCount > 0 ? `, ${errorCount} errori` : ''}.`);
      setNewUnavailableDaysInput(''); // Pulisci l'input
      // Ricarica i giorni non disponibili per aggiornare la UI
      loadUnavailableDays();
    } else {
      alert(`❌ Nessuna data valida trovata. Usa il formato GG/MM/AAAA (es: 27/10/2025)`);
    }
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
  const ticketsByDate = (() => {
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
  })();

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
      // Crea una copia della data corrente per evitare problemi di riferimento
      const dayDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      
      // Calcola dateKey usando la data calcolata
      const year = dayDate.getFullYear();
      const month = String(dayDate.getMonth() + 1).padStart(2, '0');
      const day = String(dayDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      const isCurrentMonth = dayDate.getMonth() === currentDate.getMonth();
      const isToday = dayDate.toDateString() === new Date().toDateString();
      
      
      days.push({
        date: dayDate,
        dateKey,
        isCurrentMonth,
        isToday,
        tickets: ticketsByDate[dateKey] || {},
        isUnavailable: isDateUnavailable(dateKey),
        unavailableReason: getUnavailableReason(dateKey)
      });
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
                onClick={(e) => {
                  // Se si tiene premuto Ctrl/Cmd E l'utente è un tecnico, gestisci la disponibilità
                  if ((e.ctrlKey || e.metaKey) && currentUser?.ruolo === 'tecnico') {
                    e.preventDefault();
                    handleCalendarDayClick(day);
                    return;
                  }
                  // Altrimenti gestisci i ticket normalmente
                  handleDayClick(day, e);
                }}
                title={
                  day.isUnavailable 
                    ? `Non disponibile${day.unavailableReason ? ': ' + day.unavailableReason : ''}${currentUser?.ruolo === 'tecnico' ? ' • Ctrl+Click per impostare come disponibile' : ''}`
                    : hasTickets 
                      ? `Click per vedere i ticket del ${day.date.toLocaleDateString('it-IT')}${currentUser?.ruolo === 'tecnico' ? ' • Ctrl+Click per impostare come non disponibile' : ''}`
                      : currentUser?.ruolo === 'tecnico' ? `Ctrl+Click per impostare come non disponibile` : ''
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
                  {/* Punto nero per giorni non disponibili */}
                  {day.isUnavailable && (
                    <div
                      className="w-2 h-2 rounded-full bg-gray-800"
                      title={`Non disponibile${day.unavailableReason ? ': ' + day.unavailableReason : ''}`}
                    />
                  )}
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

        {/* Input per giorni non disponibili - Solo per tecnici */}
        {currentUser?.ruolo === 'tecnico' && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Giorni Non Disponibili</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Inserisci le date in cui non sarai presente (formato: GG/MM/AAAA)
                </label>
                <input
                  type="text"
                  className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Es: 27/10/2025, 05/11/2025, 25/12/2025"
                  value={newUnavailableDaysInput}
                  onChange={(e) => setNewUnavailableDaysInput(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNewUnavailableDays}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Salva Giorni Non Disponibili
                </button>
                <button
                  onClick={() => setNewUnavailableDaysInput('')}
                  className="px-3 py-1 bg-gray-500 text-white text-xs rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancella
                </button>
              </div>
              <div className="text-xs text-gray-500">
                <div>• <strong>Ctrl+Click</strong> su una data del calendario per pre-compilare il campo</div>
                <div>• Formato: GG/MM/AAAA (es: 27/10/2025)</div>
                <div>• Separa più date con virgola</div>
                <div>• I giorni non disponibili appariranno in grigio nel calendario</div>
              </div>
            </div>
          </div>
        )}

        {/* Informazione per clienti sui giorni non disponibili */}
        {currentUser?.ruolo === 'cliente' && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Giorni Non Disponibili</h3>
            <div className="text-xs text-gray-600">
              <div>• I giorni in grigio indicano quando il tecnico non è disponibile</div>
              <div>• Per informazioni sui giorni non disponibili, contatta il supporto</div>
            </div>
          </div>
        )}

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

    </div>
  );
};

export default TicketsCalendar;
