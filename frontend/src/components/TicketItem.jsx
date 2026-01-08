import React from 'react';
import { User, Settings, Check, CornerDownLeft, Euro, Trash2, AlertCircle, Zap, Calendar as CalIcon, Package, Eye, Printer, Paperclip, Upload, Mail } from 'lucide-react';
import { getStatoColor, getPrioritaColor, getPrioritaBgClass, getPrioritySolidBgClass, getStatoIcon } from '../utils/colors';
import { formatDate } from '../utils/formatters';
import ChatInterface from './ChatInterface';
import { generateSingleTicketHTML } from '../utils/reportGenerator';

const TicketItem = ({ ticket, cliente, currentUser, selectedTicket, handlers, getUnreadCount, users = [] }) => {
  // console.log debug rimosso
  
  const {
    handleSelectTicket,
    handleOpenEditModal,
    handleViewTimeLog,
    handleOpenForniture,
    handleReopenInLavorazione,
    handleChangeStatus,
    handleReopenAsRisolto,
    handleSetInviato,
    handleArchiveTicket,
    handleInvoiceTicket,
    handleDeleteTicket,
    handleSendMessage,
    handleDeleteMessage,
    handleUpdateMessage,
    showNotification,
    handleUploadTicketPhotos,
    setPhotosModalTicket,
    handleResendEmail
  } = handlers;

  const isTicketOpen = ticket.stato === 'aperto';
  const canDelete = currentUser.ruolo === 'tecnico' || (currentUser.ruolo === 'cliente' && isTicketOpen);
  
  const unreadCount = getUnreadCount ? getUnreadCount(ticket) : 0;
  const hasUnread = unreadCount > 0;
  
  // Controlla se ci sono messaggi (anche se letti)
  const hasMessages = ticket.messaggi && Array.isArray(ticket.messaggi) && ticket.messaggi.length > 0;
  const messagesCount = hasMessages ? ticket.messaggi.length : 0;
  
  // Stati che permettono l'upload/visualizzazione foto
  const allowedPhotoStates = ['aperto', 'in_lavorazione', 'risolto'];
  const canManagePhotos = allowedPhotoStates.includes(ticket.stato);
  const photos = ticket.photos || [];
  const hasPhotos = photos.length > 0;
  
  // Icona graffetta sempre visibile quando ci sono file allegati (indipendentemente dallo stato)

  const handlePrint = (e) => {
    e.stopPropagation();
    const includeTimeLogs = ticket.stato === 'risolto' || ticket.stato === 'chiuso' || ticket.stato === 'inviato' || ticket.stato === 'fatturato';
    const clienteName = cliente?.azienda || `${cliente?.nome || ''} ${cliente?.cognome || ''}`.trim();
    const html = generateSingleTicketHTML(ticket, { includeTimeLogs, includeChat: true, clienteName });
    
    // Crea un blob URL per aprire l'HTML in una nuova scheda
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
    
    // Pulisci l'URL dopo che la finestra è stata aperta
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        URL.revokeObjectURL(url);
      });
      // Fallback: pulisci l'URL dopo 10 secondi anche se l'evento load non viene chiamato
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    }
  };

  return (
    <>
      <div
        data-ticket-id={ticket.id}
        onClick={() => handleSelectTicket(ticket)}
        className={'cursor-pointer border-b relative overflow-hidden transition-shadow transition-colors ' + 
  (ticket.isNew ? 'bg-yellow-50 border-yellow-300 animate-pulse-slow shadow-md hover:bg-yellow-100' : 
   selectedTicket?.id === ticket.id ? 'bg-blue-100 border-blue-300' : 'bg-white hover:bg-gray-50') + ' ' +
  (hasUnread && selectedTicket?.id !== ticket.id ? 'border-l-4 border-yellow-400 shadow-lg animate-pulse-slow bg-yellow-50' : '')}
      >
        <div className="p-4 pl-5 relative">
          <div className={'absolute top-0 left-0 h-full w-1 ' + getPrioritySolidBgClass(ticket.priorita)}></div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-mono text-gray-500 font-semibold">{ticket.numero}</span>
                
                {currentUser.ruolo === 'tecnico' && (
                  (cliente && cliente.azienda) || ticket.cliente_azienda
                ) && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
                    <User size={12} />
                    {cliente?.azienda || ticket.cliente_azienda || 'Senza azienda'}
                  </span>
                )}
                
                <span className={'px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 ' + getStatoColor(ticket.stato)}>
                  {getStatoIcon(ticket.stato, 12)}
                  {ticket.stato.replace('_', ' ')}
                </span>

                {hasUnread && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500 text-white font-bold flex items-center gap-1 animate-bounce">
                    💬 {unreadCount}
                  </span>
                )}
                
                {/* Badge per presenza di commenti (anche se letti) */}
                {hasMessages && !hasUnread && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1" title={`${messagesCount} commento${messagesCount !== 1 ? 'i' : ''}`}>
                    💬 {messagesCount}
                  </span>
                )}
                
                {/* Badge per presenza di file allegati (sempre visibile) */}
                {hasPhotos && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium flex items-center gap-1" title={`${photos.length} file allegato${photos.length !== 1 ? 'i' : ''}`}>
                    <Paperclip size={12} />
                    {photos.length}
                  </span>
                )}
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
                 ticket.timelogs && ticket.timelogs[0] && ticket.timelogs[0].modalita && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 font-bold flex items-center gap-1">
                    <Zap size={12} />
                    {ticket.timelogs[0].modalita}
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
              {/* Foto ticket - solo per stati consentiti */}
              {canManagePhotos && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPhotosModalTicket(ticket);
                  }}
                  title={hasPhotos ? `Visualizza file (${photos.length})` : 'Aggiungi file'}
                  className={`p-1 rounded-full relative ${
                    hasPhotos 
                      ? 'text-purple-600 hover:bg-purple-100' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Paperclip size={18} />
                  {hasPhotos && (
                    <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {photos.length}
                    </span>
                  )}
                </button>
              )}
              
              {/* Stampa ticket */}
              <button
                onClick={handlePrint}
                title="Stampa ticket"
                className="p-1 rounded-full text-gray-600 hover:bg-gray-100"
              >
                <Printer size={18} />
              </button>
              {currentUser.ruolo === 'tecnico' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(ticket); }}
                    title="Modifica ticket"
                    className="p-1 rounded-full text-blue-500 hover:bg-blue-100"
                  >
                    <Settings size={18} />
                  </button>

                  {/* ❌ RIMOSSO: Pulsante Clock "Modifica interventi" */}

                  {ticket.stato === 'risolto' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResendEmail && handleResendEmail(ticket); }}
                        title="Rinvia email"
                        className="p-1 rounded-full text-blue-500 hover:bg-blue-100"
                      >
                        <Mail size={18} />
                      </button>
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
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchiveTicket(ticket.id); }}
                        title="Archivia"
                        className="p-1 rounded-full text-yellow-500 hover:bg-yellow-100"
                      >
                        <CornerDownLeft size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleInvoiceTicket(ticket.id); }}
                        title="Fattura"
                        className="p-1 rounded-full text-indigo-500 hover:bg-indigo-100"
                      >
                        <Euro size={18} />
                      </button>
                    </>
                  )}

                  {ticket.stato === 'fatturato' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSetInviato(ticket.id); }}
                      title="Riporta a Inviato"
                      className="p-1 rounded-full text-yellow-500 hover:bg-yellow-100"
                    >
                      <CornerDownLeft size={18} />
                    </button>
                  )}

                  {ticket.stato === 'chiuso' && (
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

          {/* Badge Forniture Temporanee (non mostrare su "Aperto") */}
          {ticket.stato !== 'aperto' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('🔍 DEBUG FORNITURE: Pulsante cliccato per ticket:', ticket.id, ticket.numero);
                handleOpenForniture(ticket);
              }}
              className={`absolute bottom-2 right-2 p-2 rounded-full shadow-lg transition-all ${
                ticket.fornitureCount > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
              }`}
              title="Forniture Temporanee"
            >
              <Package size={18} />
              {ticket.fornitureCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {ticket.fornitureCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Banner Visualizza Intervento */}
        {['risolto', 'chiuso', 'inviato', 'fatturato'].includes(ticket.stato) && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // non aprire/chiudere la chat
              handleViewTimeLog(ticket);
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100 hover:from-yellow-200 hover:via-yellow-100 hover:to-yellow-200 border-t border-yellow-200 flex items-center justify-center gap-2 text-yellow-800 font-semibold text-sm transition-all duration-200 hover:shadow-md"
          >
            <Eye size={18} />
            Visualizza Registro Intervento
          </button>
        )}

        {/* Banner Segna come risolto (solo tecnico, in lavorazione) */}
        {currentUser?.ruolo === 'tecnico' && ticket.stato === 'in_lavorazione' && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // non aprire/chiudere la chat
              handleChangeStatus(ticket.id, 'risolto');
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-green-100 via-green-50 to-green-100 hover:from-green-200 hover:via-green-100 hover:to-green-200 border-t border-green-200 flex items-center justify-center gap-2 text-green-800 font-semibold text-sm transition-all duration-200 hover:shadow-md"
          >
            <Check size={18} />
            Segna come risolto
          </button>
        )}
      </div>

      {selectedTicket?.id === ticket.id && (
        <div className="bg-gray-50">
          <ChatInterface
            ticket={ticket}
            currentUser={currentUser}
            setSelectedTicket={handleSelectTicket}
            handleSendMessage={handleSendMessage}
            handleDeleteMessage={handleDeleteMessage}
            handleUpdateMessage={handleUpdateMessage}
            handleChangeStatus={handleChangeStatus}
            users={users}
          />
        </div>
      )}
    </>
  );
};

export default TicketItem;
