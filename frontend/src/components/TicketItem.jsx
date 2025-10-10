import React from 'react';
import { User, Settings, Clock, Check, CornerDownLeft, Euro, Trash2, AlertCircle, Zap, Calendar as CalIcon } from 'lucide-react';
import { getStatoColor, getPrioritaColor, getPrioritaBgClass, getPrioritySolidBgClass, getStatoIcon } from '../utils/colors';
import { formatDate } from '../utils/formatters';
import ChatInterface from './ChatInterface';

const TicketItem = ({ ticket, cliente, currentUser, selectedTicket, handlers }) => {
  const {
    handleSelectTicket,
    handleOpenEditModal,
    handleOpenTimeLogger,
    handleReopenInLavorazione,
    handleChangeStatus,
    handleReopenAsRisolto,
    handleSetInviato,
    handleArchiveTicket,
    handleInvoiceTicket,
    handleDeleteTicket,
    handleSendMessage,
    showNotification
  } = handlers;

  const isTicketOpen = ticket.stato === 'aperto';
  const canDelete = currentUser.ruolo === 'tecnico' || (currentUser.ruolo === 'cliente' && isTicketOpen);

  return (
    <>
      <div
        onClick={() => handleSelectTicket(ticket)}
        className={'cursor-pointer hover:bg-gray-50 border-b relative overflow-hidden p-4 pl-5 ' + 
  (ticket.isNew ? getPrioritaBgClass(ticket.priorita) + ' animate-pulse shadow-md' : 
   selectedTicket && selectedTicket.id === ticket.id ? 'bg-blue-50' : 'bg-white')}
      >
        <div className={'absolute top-0 left-0 h-full w-1 ' + getPrioritySolidBgClass(ticket.priorita)}></div>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-mono text-gray-500 font-semibold">{ticket.numero}</span>
              
              {currentUser.ruolo === 'tecnico' && cliente && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
                  <User size={12} />
                  {cliente.azienda}
                </span>
              )}
              
              <span className={'px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 ' + getStatoColor(ticket.stato)}>
                {getStatoIcon(ticket.stato, 12)}
                {ticket.stato.replace('_', ' ')}
              </span>
            </div>

            <h3 className="text-lg font-bold">{ticket.titolo}</h3>
            
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              Richiedente: <span className="font-semibold">{ticket.nomerichiedente}</span> - {ticket.descrizione}
            </p>

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              <span className={'flex items-center gap-1 font-medium ' + getPrioritaColor(ticket.priorita)}>
                <AlertCircle size={14} />
                {ticket.priorita.toUpperCase()}
              </span>
              
              <span>{ticket.categoria}</span>
              
              {['risolto', 'chiuso', 'inviato', 'fatturato'].includes(ticket.stato) && 
               ticket.timeLogs && ticket.timeLogs[0] && ticket.timeLogs[0].modalita && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 font-bold flex items-center gap-1">
                  <Zap size={12} />
                  {ticket.timeLogs[0].modalita}
                </span>
              )}
              
              <span className="flex items-center gap-1">
                <CalIcon size={14} />
                {formatDate(ticket.dataapertura)}
              </span>
              
              {ticket.datachiusura && (
                <span className="text-green-600 flex items-center gap-1 font-medium">
                  <Check size={14} />
                  Chiuso: {formatDate(ticket.datachiusura)}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1">
            {currentUser.ruolo === 'tecnico' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(ticket); }}
                  title="Modifica ticket"
                  className="p-1 rounded-full text-blue-500 hover:bg-blue-100"
                >
                  <Settings size={18} />
                </button>

                {ticket.timeLogs && ticket.timeLogs.length > 0 && 
                 ['risolto', 'chiuso', 'inviato'].includes(ticket.stato) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenTimeLogger(ticket); }}
                    title="Modifica interventi"
                    className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    <Clock size={18} />
                  </button>
                )}

                {ticket.stato === 'risolto' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReopenInLavorazione(ticket.id); }}
                      title="Riapri"
                      className="p-1 rounded-full text-yellow-500 hover:bg-yellow-100"
                    >
                      <CornerDownLeft size={18} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleChangeStatus(ticket.id, 'chiuso'); }}
                      title="Chiudi"
                      className="p-1 rounded-full text-green-500 hover:bg-green-100"
                    >
                      <Check size={18} />
                    </button>
                  </>
                )}

                {ticket.stato === 'chiuso' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReopenAsRisolto(ticket.id); }}
                      title="Sposta in Risolto"
                      className="p-1 rounded-full text-yellow-500 hover:bg-yellow-100"
                    >
                      <CornerDownLeft size={18} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSetInviato(ticket.id); }}
                      title="Invia"
                      className="p-1 rounded-full text-green-500 hover:bg-green-100"
                    >
                      <Check size={18} />
                    </button>
                  </>
                )}

                {ticket.stato === 'inviato' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleArchiveTicket(ticket.id); }}
                    title="Archivia"
                    className="p-1 rounded-full text-yellow-500 hover:bg-yellow-100"
                  >
                    <CornerDownLeft size={18} />
                  </button>
                )}

                {['chiuso', 'inviato'].includes(ticket.stato) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleInvoiceTicket(ticket.id); }}
                    title="Fattura"
                    className="p-1 rounded-full text-indigo-500 hover:bg-indigo-100"
                  >
                    <Euro size={18} />
                  </button>
                )}
              </>
            )}

            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (canDelete) {
                    handleDeleteTicket(ticket.id);
                  } else {
                    showNotification('Non puoi eliminare un ticket in lavorazione.', 'info');
                  }
                }}
                title={!canDelete && currentUser.ruolo === 'cliente' ? 'Non eliminabile' : 'Elimina'}
                className={'p-1 rounded-full ' + (canDelete ? 'text-red-500 hover:bg-red-100' : 'text-gray-400 cursor-not-allowed')}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedTicket && selectedTicket.id === ticket.id && (
        <div className="bg-gray-50">
          <ChatInterface
            ticket={ticket}
            currentUser={currentUser}
            setSelectedTicket={handleSelectTicket}
            handleSendMessage={handleSendMessage}
            handleChangeStatus={handleChangeStatus}
          />
        </div>
      )}
    </>
  );
};

export default TicketItem;
