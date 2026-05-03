import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ExternalLink, X, Paperclip } from 'lucide-react';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useAvailability } from '../hooks/useAvailability';
import { SYNC_STATES } from '../config/googleConfig';

const TicketsCalendar = ({
  tickets,
  onTicketClick,
  currentUser,
  getAuthHeader,
  users = [],
  contracts = [],
  /** Calendario compatto nell’aside hub: tema scuro, griglia più stretta, blocco unico calendario + giorni non disponibili */
  sidebarHubEmbed = false
}) => {
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
    // TODO: Implementare handleAvailabilityClick quando necessario
    // if (event.ctrlKey || event.metaKey) {
    //   event.preventDefault();
    //   handleAvailabilityClick(day);
    //   return;
    // }
    
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

  // Funzione per rendere disponibili (rimuovere lo sfondo scuro) i giorni indicati nell'input
  const handleUnsetUnavailableDays = async () => {
    if (!newUnavailableDaysInput.trim()) {
      alert('Seleziona una data con Ctrl+Click o inseriscila nel campo.');
      return;
    }

    const datesToProcess = newUnavailableDaysInput.split(',').map(s => s.trim()).filter(Boolean);
    let successCount = 0;
    let errorCount = 0;

    for (const dateString of datesToProcess) {
      try {
        const isoDate = convertItalianDateToISO(dateString);
        if (!isoDate) {
          errorCount++;
          continue;
        }

        const result = await setDayAvailable(isoDate);
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
      alert(`✅ Operazione completata: ${successCount} date rese disponibili${errorCount > 0 ? `, ${errorCount} errori` : ''}.`);
      // Non puliamo l'input: richiesta esplicita di non cancellare il campo compilato
      loadUnavailableDays();
    } else {
      alert('❌ Nessuna data valida trovata da rendere disponibile. Usa il formato GG/MM/AAAA');
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

  // Funzione helper per ottenere il nome dell'azienda dal ticket
  const getTicketAzienda = (ticket) => {
    // Prima prova a usare l'azienda dal ticket (se è stata aggiunta dal backend)
    if (ticket.cliente_azienda) {
      return ticket.cliente_azienda;
    }
    
    // Altrimenti cerca in users
    if (ticket.clienteid && users && users.length > 0) {
      const ticketClienteId = Number(ticket.clienteid);
      const ticketClient = users.find(u => Number(u.id) === ticketClienteId);
      if (ticketClient && ticketClient.azienda) {
        return ticketClient.azienda;
      }
    }
    
    // Fallback: usa "Senza azienda" se non trovato
    return 'Senza azienda';
  };

  // Funzione helper per verificare se un ticket è visibile all'utente
  const getAppliesToUser = (ticket) => {
    if (currentUser.ruolo === 'tecnico') {
      return true; // I tecnici vedono tutti i ticket
    }
    
    if (currentUser.ruolo === 'cliente') {
      // Se è il proprio ticket, sempre visibile (confronta come numeri)
      const ticketClienteId = Number(ticket.clienteid);
      const currentUserId = Number(currentUser.id);
      if (ticketClienteId === currentUserId) {
        return true;
      }
      
      // Se è amministratore, controlla se il ticket appartiene a un cliente della sua azienda
      const isAdmin = currentUser.admin_companies && 
                     Array.isArray(currentUser.admin_companies) && 
                     currentUser.admin_companies.length > 0;
      
      if (isAdmin) {
        // Usa la funzione helper per ottenere l'azienda
        const ticketAzienda = getTicketAzienda(ticket);
        
        if (ticketAzienda && ticketAzienda !== 'Senza azienda') {
          // Verifica se l'azienda del ticket è tra quelle di cui è amministratore
          return currentUser.admin_companies.includes(ticketAzienda);
        }
      }
      
      return false;
    }
    
    return false;
  };

  // Stati da considerare
  const relevantStates = SYNC_STATES;
  
  // Filtra i ticket per stati rilevanti E visibilità per l'utente corrente
  const relevantTickets = tickets.filter(ticket => 
    relevantStates.includes(ticket.stato) && getAppliesToUser(ticket)
  );

  // Raggruppa i ticket per data e priorità, e gli interventi per data
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
    
    // Aggiungi interventi (timelogs) per data
    relevantTickets.forEach(ticket => {
      if (!ticket.timelogs || !Array.isArray(ticket.timelogs)) {
        return;
      }
      
      ticket.timelogs.forEach(timelog => {
        if (!timelog.data) {
          return;
        }
        
        // Estrai la data dall'intervento
        let dateKey;
        
        if (timelog.data.includes('T')) {
          const dateOnly = timelog.data.split('T')[0];
          dateKey = dateOnly;
        } else {
          dateKey = timelog.data;
        }
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = {};
        }
        
        // Usa una priorità speciale per gli interventi
        const interventiKey = 'intervento';
        if (!grouped[dateKey][interventiKey]) {
          grouped[dateKey][interventiKey] = [];
        }
        
        // Aggiungi il ticket con riferimento all'intervento
        // Evita duplicati: controlla se il ticket è già presente
        const existingTicket = grouped[dateKey][interventiKey].find(t => t.id === ticket.id);
        if (!existingTicket) {
          grouped[dateKey][interventiKey].push({
            ...ticket,
            isIntervento: true,
            timelogData: timelog.data,
            timelogModalita: timelog.modalita
          });
        }
      });
    });
    
    // Aggiungi eventi contratti per data
    contracts.forEach(contract => {
      if (!contract.events || !Array.isArray(contract.events)) {
        return;
      }
      
      contract.events.forEach(event => {
        if (!event.event_date) {
          return;
        }
        
        // Estrai la data dall'evento
        let dateKey;
        
        if (event.event_date.includes('T')) {
          const dateOnly = event.event_date.split('T')[0];
          dateKey = dateOnly;
        } else {
          dateKey = event.event_date;
        }
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = {};
        }
        
        // Usa una priorità speciale per i contratti
        const contrattoKey = 'contratto';
        if (!grouped[dateKey][contrattoKey]) {
          grouped[dateKey][contrattoKey] = [];
        }
        
        // Aggiungi l'evento contratto con riferimento al contratto
        grouped[dateKey][contrattoKey].push({
          ...event,
          isContratto: true,
          contract_id: contract.id,
          contract_title: contract.title,
          contract_client_name: contract.client_name
        });
      });
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
      case 'intervento': return 'bg-purple-500';
      case 'contratto': return 'bg-amber-500';
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
      case 'intervento': return 'Intervento';
      case 'contratto': return 'Contratto';
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

  const HS = sidebarHubEmbed === true;

  const shellCls = HS
    ? 'flex min-h-0 w-full min-w-0 flex-col bg-transparent text-[13px] text-white/90'
    : 'rounded-xl border bg-white';

  return (
    <div className={shellCls}>
      <div className={`${HS ? 'border-b border-white/[0.08] px-0 py-2' : 'border-b p-4'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className={HS ? 'text-xs font-semibold uppercase tracking-wide text-white/45' : 'font-semibold'}>
            Calendario ticket
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className={
                HS
                  ? 'rounded-lg p-1 text-white/60 transition hover:bg-white/[0.08]'
                  : 'rounded p-1 hover:bg-gray-100'
              }
              aria-label="Mese precedente"
            >
              <ChevronLeft size={HS ? 15 : 16} />
            </button>
            <span className={`min-w-[96px] text-center font-medium ${HS ? 'text-[11px] text-white/78' : 'min-w-[120px] text-sm'}`}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className={
                HS ? 'rounded-lg p-1 text-white/60 transition hover:bg-white/[0.08]' : 'rounded p-1 hover:bg-gray-100'
              }
              aria-label="Mese successivo"
            >
              <ChevronRight size={HS ? 15 : 16} />
            </button>
          </div>
        </div>
      </div>

      <div className={`${HS ? 'min-h-0 flex-1 px-0 py-1' : 'p-4'}`}>
        <div className="space-y-2">
        {/* Header giorni settimana */}
        <div className={`grid grid-cols-7 ${HS ? 'mb-1 gap-px' : 'mb-2 gap-1'}`}>
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
            <div
              key={day}
              className={`text-center font-medium ${
                HS ? 'py-0.5 text-[9px] uppercase tracking-tighter text-white/45' : 'py-2 text-xs text-gray-500'
              }`}
            >
              {HS ? day.charAt(0) : day}
            </div>
          ))}
        </div>

        {/* Griglia calendario */}
        <div className={HS ? 'grid grid-cols-7 gap-px' : 'grid grid-cols-7 gap-1'}>
          {calendarDays.map((day, index) => {
            const hasTickets = Object.values(day.tickets).flat().length > 0;
            const hasContracts = day.tickets.contratto && day.tickets.contratto.length > 0;
            const isSelected = selectedDate && selectedDate.toDateString() === day.date.toDateString();
            
            return (
              <div
                key={index}
                className={`cursor-pointer rounded border transition-all relative ${
                  HS ? 'min-h-[26px] p-0.5' : 'min-h-[40px] p-1'
                } ${
                  HS
                    ? day.isCurrentMonth
                      ? day.isUnavailable
                        ? 'border-white/14 bg-neutral-600 text-white/95'
                        : hasContracts
                          ? 'border-amber-400/35 bg-amber-500/20'
                          : 'border-white/10 bg-white/[0.06]'
                      : 'border-transparent bg-black/35 text-white/28'
                    : `${
                  day.isCurrentMonth ? (day.isUnavailable ? 'bg-gray-300 text-gray-800' : hasContracts ? 'bg-amber-50' : 'bg-white') : 'bg-gray-50'
                }`
                } ${day.isToday ? (HS ? 'ring-2 ring-[color:var(--hub-accent)]' : 'ring-2 ring-blue-500') : ''} ${
                  isSelected ? (HS ? 'ring-1 ring-green-400/70 bg-green-500/25' : 'ring-2 ring-green-500 bg-green-50') : ''
                } ${hasTickets ? (HS ? 'hover:border-[color:var(--hub-accent-border)]' : 'hover:bg-blue-50 hover:border-blue-300') : ''} ${
                  day.isUnavailable ? (HS ? 'hover:bg-neutral-600' : 'hover:bg-gray-400') : ''
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
                <div
                  className={`font-medium leading-none ${
                    HS
                      ? `text-[10px] ${day.isCurrentMonth ? (day.isUnavailable ? 'text-white' : 'text-white/88') : 'text-white/28'}`
                      : `text-xs ${day.isCurrentMonth ? (day.isUnavailable ? 'text-gray-800' : 'text-gray-900') : 'text-gray-400'}`
                  }`}
                >
                  {day.date.getDate()}
                </div>
                
                {/* Pallini per priorità */}
                <div className={`flex flex-wrap ${HS ? 'mt-px gap-px' : 'mt-1 gap-1'}`}>
                  {Object.entries(day.tickets).map(([priorita, tk]) => (
                    <div
                      key={priorita}
                      className={`rounded-full ${getPriorityColor(priorita)} ${HS ? 'h-1 w-1' : 'w-2 h-2'}`}
                      title={`${getPriorityName(priorita)}: ${tk.length} ticket`}
                    />
                  ))}
                </div>
                
              </div>
            );
          })}
        </div>

        {/* Lista ticket del giorno selezionato (sidebar hub e vista piena) */}
        {selectedDate && selectedDateTickets.length > 0 && (
          <div
            className={
              HS ? 'mt-2 border-t border-white/[0.08] pt-2' : 'mt-4 border-t pt-4'
            }
          >
            <div className={`flex items-center justify-between ${HS ? 'mb-2' : 'mb-3'}`}>
              <h4
                className={
                  HS
                    ? 'text-[11px] font-semibold leading-snug text-white/88'
                    : 'text-sm font-semibold'
                }
              >
                Ticket del {selectedDate.toLocaleDateString('it-IT')} ({selectedDateTickets.length})
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedDateTickets([]);
                }}
                className={
                  HS
                    ? 'shrink-0 text-[11px] text-white/45 transition hover:text-white'
                    : 'text-xs text-gray-500 hover:text-gray-700'
                }
              >
                ✕ Chiudi
              </button>
            </div>

            <div
              className={
                HS
                  ? 'custom-scrollbar max-h-48 space-y-1.5 overflow-y-auto pr-0.5'
                  : 'max-h-60 space-y-2 overflow-y-auto'
              }
            >
              {selectedDateTickets.map((ticket) => {
                // Gestisci eventi contratto diversamente dai ticket normali
                if (ticket.isContratto) {
                  return (
                    <div
                      key={`contract-${ticket.contract_id}-${ticket.id}`}
                      className={
                        HS
                          ? `cursor-pointer rounded-lg border border-white/[0.1] bg-black/35 p-2.5 transition-colors hover:bg-white/[0.06] ${getPriorityColor('contratto').replace('bg-', 'border-l-[3px] border-l-')}`
                          : `cursor-pointer rounded-lg border p-3 transition-colors hover:bg-gray-50 ${getPriorityColor('contratto').replace('bg-', 'border-l-4 border-l-')}`
                      }
                      onClick={() => {
                        // Per i contratti, non apriamo un ticket ma potremmo aprire il contratto
                        // Per ora, non facciamo nulla o possiamo navigare al contratto
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={HS ? 'text-xs font-semibold text-white/92' : 'text-sm font-medium'}>
                              Contratto
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white sm:text-xs ${getPriorityColor('contratto')}`}
                            >
                              Contratto
                            </span>
                          </div>
                          <div
                            className={
                              HS ? 'mt-1 text-[11px] leading-snug text-white/75' : 'mt-1 text-sm text-gray-700'
                            }
                          >
                            {ticket.contract_title || ticket.description || 'Evento contratto'}
                          </div>
                          <div
                            className={
                              HS ? 'mt-0.5 text-[10px] leading-snug text-white/45' : 'mt-1 text-xs text-gray-500'
                            }
                          >
                            {ticket.contract_client_name ? `Cliente: ${ticket.contract_client_name}` : 'Cliente: N/D'} •{' '}
                            {ticket.description || 'Fatturazione'}
                            {ticket.amount &&
                              ` • Importo: € ${parseFloat(ticket.amount).toLocaleString('it-IT', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}`}
                          </div>
                        </div>
                        <div
                          className={
                            HS ? 'shrink-0 text-[9px] text-white/38' : 'text-xs text-gray-400'
                          }
                        >
                          Evento contratto
                        </div>
                      </div>
                    </div>
                  );
                }

                // Gestisci ticket normali e interventi
                return (
                  <div
                    key={`${ticket.id}-${ticket.isIntervento ? 'intervento' : 'ticket'}`}
                    className={
                      HS
                        ? `cursor-pointer rounded-lg border border-white/[0.1] bg-black/35 p-2.5 transition-colors hover:bg-white/[0.06] ${getPriorityColor(ticket.isIntervento ? 'intervento' : ticket.priorita).replace('bg-', 'border-l-[3px] border-l-')}`
                        : `cursor-pointer rounded-lg border p-3 transition-colors hover:bg-gray-50 ${getPriorityColor(ticket.isIntervento ? 'intervento' : ticket.priorita).replace('bg-', 'border-l-4 border-l-')}`
                    }
                    onClick={() => handleTicketClick(ticket)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={HS ? 'text-xs font-semibold text-white/92' : 'text-sm font-medium'}>
                            #{ticket.numero}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white sm:text-xs ${getPriorityColor(ticket.isIntervento ? 'intervento' : ticket.priorita)}`}
                          >
                            {ticket.isIntervento ? 'Intervento' : getPriorityName(ticket.priorita)}
                          </span>
                          {ticket.isIntervento && ticket.timelogModalita && (
                            <span
                              className={
                                HS ? 'text-[10px] italic text-white/45' : 'text-xs italic text-gray-600'
                              }
                            >
                              ({ticket.timelogModalita})
                            </span>
                          )}
                          {ticket.photos && ticket.photos.length > 0 && (
                            <span
                              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                HS
                                  ? 'bg-purple-500/25 text-purple-200'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                              title={`${ticket.photos.length} file allegato${ticket.photos.length !== 1 ? 'i' : ''}`}
                            >
                              <Paperclip size={11} />
                              {ticket.photos.length}
                            </span>
                          )}
                        </div>
                        <div
                          className={
                            HS ? 'mt-1 text-[11px] leading-snug text-white/75' : 'mt-1 text-sm text-gray-700'
                          }
                        >
                          {ticket.titolo}
                        </div>
                        <div
                          className={
                            HS ? 'mt-0.5 text-[10px] leading-snug text-white/45' : 'mt-1 text-xs text-gray-500'
                          }
                        >
                          {ticket.isIntervento
                            ? `Azienda: ${getTicketAzienda(ticket)} • Intervento eseguito`
                            : `Azienda: ${getTicketAzienda(ticket)} • Stato: ${ticket.stato}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Input per giorni non disponibili - Solo per tecnici */}
        {currentUser?.ruolo === 'tecnico' && (
          <div className={HS ? 'mt-2 border-t border-white/[0.08] pt-2' : 'mt-4 border-t pt-4'}>
            <h3 className={`mb-2 font-semibold ${HS ? 'text-[11px] text-white/70' : 'mb-3 text-sm text-gray-700'}`}>
              Giorni non disponibili
            </h3>
            <div className="space-y-2">
              <div>
                <label className={`mb-1 block ${HS ? 'text-[10px] text-white/45' : 'text-xs text-gray-600'}`}>
                  Date (GG/MM/AAAA), separate da virgola
                </label>
                <input
                  type="text"
                  className={`w-full rounded-md text-xs focus:outline-none focus:ring-2 ${
                    HS
                      ? 'border border-white/[0.12] bg-black/35 p-2 text-white placeholder:text-white/35 focus:ring-[color:var(--hub-accent)]'
                      : 'border border-gray-300 p-2 text-sm focus:ring-blue-500'
                  }`}
                  placeholder="Es: 27/10/2025, 05/11/2025"
                  value={newUnavailableDaysInput}
                  onChange={(e) => setNewUnavailableDaysInput(e.target.value)}
                />
              </div>
              <div className={`flex flex-wrap gap-1.5 ${HS ? '' : 'gap-2'}`}>
                <button
                  type="button"
                  onClick={handleSaveNewUnavailableDays}
                  className={`rounded-md text-[11px] font-medium text-white ${
                    HS
                      ? 'bg-red-500/85 px-2 py-1.5 hover:bg-red-500'
                      : 'bg-red-600 px-3 py-1 text-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
                  }`}
                >
                  Salva non disp.
                </button>
                <button
                  type="button"
                  onClick={handleUnsetUnavailableDays}
                  className={`rounded-md text-[11px] font-medium text-white ${
                    HS
                      ? 'border border-white/[0.12] bg-white/10 px-2 py-1.5 hover:bg-white/[0.14]'
                      : 'bg-gray-500 px-3 py-1 text-xs hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500'
                  }`}
                >
                  Rendi disp.
                </button>
              </div>
              <p className={`${HS ? 'text-[9px] leading-snug text-white/38' : 'text-xs text-gray-500'}`}>
                {HS ? (
                  <>
                    <strong>Ctrl+Click</strong> su un giorno per precompilare. Grigio = non disponibile.
                  </>
                ) : (
                  <>
                    <div>
                      • <strong>Ctrl+Click</strong> su una data del calendario per pre-compilare il campo
                    </div>
                    <div>• Formato: GG/MM/AAAA (es: 27/10/2025)</div>
                    <div>• Separa più date con virgola</div>
                    <div>• I giorni non disponibili appariranno in grigio nel calendario</div>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Informazione per clienti sui giorni non disponibili */}
        {currentUser?.ruolo === 'cliente' && (
          <div className={HS ? 'mt-2 border-t border-white/[0.08] pt-2' : 'mt-4 border-t pt-4'}>
            <h3 className={`font-semibold ${HS ? 'mb-1 text-[11px] text-white/70' : 'mb-3 text-sm text-gray-700'}`}>
              Giorni non disponibili
            </h3>
            <div className={HS ? 'text-[10px] leading-snug text-white/45' : 'text-xs text-gray-600'}>
              <div>• Il grigio indica giorni senza tecnico disponibile.</div>
              {!HS && <div>• Per dubbi contatta il supporto.</div>}
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className={HS ? 'mt-2 border-t border-white/[0.08] pt-2' : 'mt-4 border-t pt-4'}>
          <div className={`mb-1 ${HS ? 'text-[9px] text-white/42' : 'mb-2 text-xs text-gray-600'}`}>
            Legenda{HS ? ':' : ':'}
          </div>
          <div
            className={`flex flex-wrap gap-x-2 gap-y-1 text-xs ${HS ? 'text-[9px] leading-relaxed text-white/55' : 'gap-3'}`}
          >
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
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Intervento</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span>Contratto</span>
            </div>
            {!HS && (
              <div className="flex items-center gap-1">
                <div className="h-4 w-4 rounded border border-gray-400 bg-gray-300" />
                <span>Non disponibile (sfondo scuro)</span>
              </div>
            )}
            {HS && (
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded border border-white/14 bg-neutral-600" />
                <span>No disp.</span>
              </div>
            )}
          </div>
        </div>
        </div>

      </div>

    </div>
  );
};

export default TicketsCalendar;
