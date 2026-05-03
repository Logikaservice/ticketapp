import React from 'react';
import { User, Settings, Check, CornerDownLeft, Euro, Trash2, AlertCircle, Zap, Calendar as CalIcon, Package, Eye, Printer, Paperclip, Upload, Mail } from 'lucide-react';
import { getStatoColor, getPrioritaColor, getPrioritaBgClass, getPrioritySolidBgClass, getStatoIcon } from '../utils/colors';
import { formatDate } from '../utils/formatters';
import ChatInterface from './ChatInterface';
import { generateSingleTicketHTML } from '../utils/reportGenerator';

const TicketItem = ({
  ticket,
  cliente,
  currentUser,
  selectedTicket,
  handlers,
  getUnreadCount,
  users = [],
  hubEmbed = false,
  hubEmbedLight = false
}) => {
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
  const hubDarkChrome = hubEmbed && !hubEmbedLight;
  const ib = {
    mute: `rounded-full p-1 ${hubDarkChrome ? 'text-white/65 hover:bg-white/[0.1]' : 'text-gray-600 hover:bg-gray-100'}`,
    blue: `rounded-full p-1 ${hubDarkChrome ? 'text-sky-400 hover:bg-white/[0.1]' : 'text-blue-500 hover:bg-blue-100'}`,
    yellow: `rounded-full p-1 ${hubDarkChrome ? 'text-amber-300 hover:bg-white/[0.1]' : 'text-yellow-500 hover:bg-yellow-100'}`,
    green: `rounded-full p-1 ${hubDarkChrome ? 'text-emerald-400 hover:bg-white/[0.1]' : 'text-green-500 hover:bg-green-100'}`,
    indigo: `rounded-full p-1 ${hubDarkChrome ? 'text-indigo-300 hover:bg-white/[0.1]' : 'text-indigo-500 hover:bg-indigo-100'}`,
    red: `rounded-full p-1 ${hubDarkChrome ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'}`,
    dis: `cursor-not-allowed rounded-full p-1 ${hubDarkChrome ? 'text-white/30' : 'text-gray-400'}`
  };

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

  const rowBase = `relative cursor-pointer overflow-hidden border-b transition-colors transition-shadow ${
    hubDarkChrome ? 'border-white/[0.07]' : 'border-gray-200'
  } `;
  let rowTone = '';
  if (ticket.isNew) {
    rowTone = hubDarkChrome
      ? 'border-amber-500/35 bg-amber-500/15 shadow-md animate-pulse-slow hover:bg-amber-500/22'
      : 'border-yellow-300 bg-yellow-50 shadow-md animate-pulse-slow hover:bg-yellow-100';
  } else if (selectedTicket?.id === ticket.id) {
    rowTone = hubDarkChrome
      ? 'border-[color:var(--hub-accent-border)] bg-white/[0.1]'
      : hubEmbedLight
        ? 'border-[color:var(--hub-accent-border)] bg-[color:var(--hub-chrome-row-nested-bg)]'
        : 'border-blue-300 bg-blue-100';
  } else {
    rowTone = hubDarkChrome
      ? 'border-transparent bg-black/20 hover:bg-white/[0.06]'
      : hubEmbedLight
        ? 'border-transparent bg-[color:var(--hub-chrome-muted-fill)] hover:bg-[color:var(--hub-chrome-hover)]'
        : 'border-transparent bg-white hover:bg-gray-50';
  }
  const rowUnread =
    hasUnread && selectedTicket?.id !== ticket.id
      ? hubDarkChrome
        ? 'animate-pulse-slow border-l-4 border-yellow-400 bg-amber-500/12 shadow-lg'
        : 'animate-pulse-slow border-l-4 border-yellow-400 bg-yellow-50 shadow-lg'
      : '';

  return (
    <>
      <div
        data-ticket-id={ticket.id}
        onClick={() => handleSelectTicket(ticket)}
        className={`${rowBase} ${rowTone} ${rowUnread}`}
      >
        <div className="p-4 pl-5 relative">
          <div className={'absolute top-0 left-0 h-full w-1 ' + getPrioritySolidBgClass(ticket.priorita)}></div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`text-sm font-mono font-semibold ${hubDarkChrome ? 'text-white/45' : 'text-gray-500'}`}
                >
                  {ticket.numero}
                </span>
                
                {currentUser.ruolo === 'tecnico' && (
                  (cliente && cliente.azienda) || ticket.cliente_azienda
                ) && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      hubDarkChrome ? 'bg-purple-500/25 text-purple-100' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    <User size={12} />
                    {cliente?.azienda || ticket.cliente_azienda || 'Senza azienda'}
                  </span>
                )}
                
                <span className={'px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 ' + getStatoColor(ticket.stato)}>
                  {getStatoIcon(ticket.stato, 12)}
                  {ticket.stato.replace('_', ' ')}
                </span>

                {hasUnread && (
                  <span className="flex animate-bounce items-center gap-1 rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white">
                    💬 {unreadCount}
                  </span>
                )}
                
                {/* Badge per presenza di commenti (anche se letti) */}
                {hasMessages && !hasUnread && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      hubDarkChrome ? 'bg-sky-500/20 text-sky-100' : 'bg-blue-100 text-blue-700'
                    }`}
                    title={`${messagesCount} commento${messagesCount !== 1 ? 'i' : ''}`}
                  >
                    💬 {messagesCount}
                  </span>
                )}
                
                {/* Badge per presenza di file allegati (sempre visibile) */}
                {hasPhotos && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      hubDarkChrome ? 'bg-fuchsia-500/20 text-fuchsia-100' : 'bg-purple-100 text-purple-700'
                    }`}
                    title={`${photos.length} file allegato${photos.length !== 1 ? 'i' : ''}`}
                  >
                    <Paperclip size={12} />
                    {photos.length}
                  </span>
                )}
              </div>

              <h3 className={`text-lg font-bold ${hubDarkChrome ? 'text-white/95' : hubEmbedLight ? 'text-[color:var(--hub-chrome-text)]' : ''}`}>{ticket.titolo}</h3>

              <p className={`mt-1 line-clamp-2 text-sm ${hubDarkChrome ? 'text-white/58' : 'text-gray-600'}`}>
                Richiedente: <span className="font-semibold">{ticket.nomerichiedente}</span> - {ticket.descrizione}
              </p>

              <div className={`mt-2 flex flex-wrap items-center gap-3 text-xs ${hubDarkChrome ? 'text-white/45' : 'text-gray-500'}`}>
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
              {/* Foto ticket - visibile per stati consentiti o se ci sono foto */}
              {(canManagePhotos || hasPhotos) && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPhotosModalTicket(ticket);
                  }}
                  title={hasPhotos ? `Visualizza file (${photos.length})` : 'Aggiungi file'}
                  className={`relative ${hasPhotos ? (hubDarkChrome ? 'rounded-full p-1 text-fuchsia-300 hover:bg-white/10' : 'rounded-full p-1 text-purple-600 hover:bg-purple-100') : ib.mute}`}
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
                className={ib.mute}
              >
                <Printer size={18} />
              </button>
              {currentUser.ruolo === 'tecnico' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(ticket); }}
                    title="Modifica ticket"
                    className={ib.blue}
                  >
                    <Settings size={18} />
                  </button>

                  {/* ❌ RIMOSSO: Pulsante Clock "Modifica interventi" */}

                  {ticket.stato === 'risolto' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResendEmail && handleResendEmail(ticket); }}
                        title="Rinvia email"
                        className={ib.blue}
                      >
                        <Mail size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReopenInLavorazione(ticket.id); }}
                        title="Riapri"
                        className={ib.yellow}
                      >
                        <CornerDownLeft size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleChangeStatus(ticket.id, 'chiuso'); }}
                        title="Chiudi"
                        className={ib.green}
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
                        className={ib.yellow}
                      >
                        <CornerDownLeft size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetInviato(ticket.id); }}
                        title="Invia"
                        className={ib.green}
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
                        className={ib.yellow}
                      >
                        <CornerDownLeft size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleInvoiceTicket(ticket.id); }}
                        title="Fattura"
                        className={ib.indigo}
                      >
                        <Euro size={18} />
                      </button>
                    </>
                  )}

                  {ticket.stato === 'fatturato' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSetInviato(ticket.id); }}
                      title="Riporta a Inviato"
                      className={ib.yellow}
                    >
                      <CornerDownLeft size={18} />
                    </button>
                  )}

                  {ticket.stato === 'chiuso' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleInvoiceTicket(ticket.id); }}
                      title="Fattura"
                      className={ib.indigo}
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
                  className={canDelete ? ib.red : ib.dis}
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
              className={`absolute bottom-2 right-2 rounded-full p-2 shadow-lg transition-all ${
                ticket.fornitureCount > 0
                  ? hubDarkChrome || hubEmbedLight
                    ? 'bg-[color:var(--hub-accent)] text-[#121212] hover:brightness-110'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  : hubDarkChrome
                    ? 'bg-white/15 text-white/75 hover:bg-white/25'
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

        {/* Banner Visualizza Intervento (hub: sfondo tutto tinta accento — Tailwind opacity su var(--hub-accent) spesso non genera fill visibile) */}
        {['risolto', 'chiuso', 'inviato', 'fatturato'].includes(ticket.stato) && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // non aprire/chiudere la chat
              handleViewTimeLog(ticket);
            }}
            className={
              hubDarkChrome
                ? 'flex w-full cursor-pointer items-center justify-center gap-2 border-t border-[color:var(--hub-accent-border)] px-4 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 active:brightness-95'
                : hubEmbedLight
                  ? 'flex w-full cursor-pointer items-center justify-center gap-2 border-t border-[color:var(--hub-accent-border)] px-4 py-3.5 text-sm font-semibold text-[color:var(--hub-chrome-text)] transition hover:brightness-[1.02] active:brightness-[0.98]'
                  : 'flex w-full cursor-pointer items-center justify-center gap-2 border-t border-yellow-200 bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100 px-4 py-3 text-sm font-semibold text-yellow-800 transition duration-200 hover:bg-gradient-to-r hover:from-yellow-200 hover:via-yellow-100 hover:to-yellow-200 hover:shadow-md'
            }
            style={
              hubDarkChrome
                ? {
                    backgroundColor: 'color-mix(in srgb, var(--hub-accent) 72%, rgb(22 22 22))'
                  }
                : hubEmbedLight
                  ? { backgroundColor: 'color-mix(in srgb, var(--hub-accent) 22%, white)' }
                  : undefined
            }
          >
            <Eye
              size={18}
              className={
                hubDarkChrome ? 'text-white opacity-95' : hubEmbedLight ? 'text-[color:var(--hub-accent)]' : undefined
              }
              strokeWidth={2.25}
              aria-hidden
            />
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
            className={
              hubDarkChrome
                ? 'flex w-full items-center justify-center gap-2 border-t border-emerald-500/35 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25'
                : 'flex w-full items-center justify-center gap-2 border-t border-green-200 bg-gradient-to-r from-green-100 via-green-50 to-green-100 px-4 py-3 text-sm font-semibold text-green-800 transition duration-200 hover:bg-gradient-to-r hover:from-green-200 hover:via-green-100 hover:to-green-200 hover:shadow-md'
            }
          >
            <Check size={18} />
            Segna come risolto
          </button>
        )}
      </div>

      {selectedTicket?.id === ticket.id && (
        <div
          className={
            hubDarkChrome
              ? 'border-t border-white/[0.08] bg-black/35'
              : hubEmbedLight
                ? 'border-t border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well)]'
                : 'bg-gray-50'
          }
        >
          <ChatInterface
            hubEmbed={hubEmbed}
            hubEmbedLight={hubEmbedLight}
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
