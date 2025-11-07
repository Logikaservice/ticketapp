import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Check, AlertTriangle, Clock, Calendar, Trash2, Edit2, Save, X as XIcon, Crown } from 'lucide-react';
import { formatDate, formatTimeLogDate } from '../utils/formatters';

const ChatInterface = ({ ticket, currentUser, setSelectedTicket, handleSendMessage, handleDeleteMessage, handleUpdateMessage, handleChangeStatus, users = [] }) => {
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingWidth, setEditingWidth] = useState(null);
  const messagesEndRef = useRef(null);
  const editingTextareaRef = useRef(null);
  const messageContainerRef = useRef(null);
  const messageInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticket.messaggi]);

  // Auto-resize textarea quando si apre la modifica
  useEffect(() => {
    if (editingMessageId && editingTextareaRef.current) {
      editingTextareaRef.current.style.height = 'auto';
      editingTextareaRef.current.style.height = `${editingTextareaRef.current.scrollHeight}px`;
    }
  }, [editingMessageId, editingContent]);

  // Auto-resize textarea di inserimento nuovo messaggio
  useEffect(() => {
    if (messageInputRef.current) {
      const textarea = messageInputRef.current;
      const minHeight = 48;
      const maxHeight = 200;
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [newMessage]);

  const onSendMessage = (isReclamo) => {
    const messageToSend = newMessage.trim();
    if (!messageToSend) {
      return;
    }
    if (!isReclamo) isReclamo = false;
    handleSendMessage(ticket.id, messageToSend, isReclamo);
    setNewMessage('');
    if (messageInputRef.current) {
      const textarea = messageInputRef.current;
      textarea.style.height = 'auto';
    }
  };

  // Verifica se l'utente può modificare il messaggio
  const canEditMessage = (message) => {
    if (currentUser.ruolo === 'tecnico') {
      return true; // Il tecnico può modificare tutti i messaggi
    }
    if (currentUser.ruolo === 'cliente') {
      // Verifica se è amministratore
      const isAdmin = currentUser.admin_companies && 
                     Array.isArray(currentUser.admin_companies) && 
                     currentUser.admin_companies.length > 0;
      
      // Costruisci il nome completo dell'utente corrente
      const currentUserName = `${currentUser.nome} ${currentUser.cognome || ''}`.trim();
      
      if (isAdmin) {
        // L'amministratore può modificare solo i propri messaggi (confronta con il suo nome)
        return message.autore === currentUserName;
      } else {
        // Il cliente non amministratore può modificare solo i propri messaggi
        return message.autore === ticket.nomerichiedente || message.autore === 'Cliente' || message.autore === currentUserName;
      }
    }
    return false;
  };

  const handleStartEdit = (message, containerElement) => {
    setEditingMessageId(message.id);
    setEditingContent(message.contenuto);
    // Salva la larghezza del contenitore del messaggio originale
    if (containerElement) {
      const width = containerElement.offsetWidth;
      setEditingWidth(width);
    }
    // Auto-resize dopo un breve delay per assicurarsi che il DOM sia aggiornato
    setTimeout(() => {
      if (editingTextareaRef.current) {
        editingTextareaRef.current.style.height = 'auto';
        editingTextareaRef.current.style.height = `${editingTextareaRef.current.scrollHeight}px`;
      }
    }, 0);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
    setEditingWidth(null);
  };

  const handleSaveEdit = () => {
    if (editingContent.trim() && handleUpdateMessage) {
      handleUpdateMessage(ticket.id, editingMessageId, editingContent);
      setEditingMessageId(null);
      setEditingContent('');
      setEditingWidth(null);
    }
  };

  // Determina lo stato di lettura del messaggio (come WhatsApp)
  const getMessageReadStatus = (message) => {
    // Solo per i messaggi che ho inviato io
    const isMyMessage = (currentUser.ruolo === 'tecnico' && message.autore === 'Tecnico') ||
                        (currentUser.ruolo === 'cliente' && (message.autore === ticket.nomerichiedente || message.autore === 'Cliente'));
    
    if (!isMyMessage) {
      return null; // Non mostrare spunte per i messaggi dell'altro utente
    }

    const messageDate = new Date(message.data);
    let lastReadDate = null;

    // Determina quando l'altro utente ha letto i messaggi
    if (currentUser.ruolo === 'tecnico') {
      // Sono tecnico, controllo quando il cliente ha letto
      lastReadDate = ticket.last_read_by_client ? new Date(ticket.last_read_by_client) : null;
    } else {
      // Sono cliente, controllo quando il tecnico ha letto
      lastReadDate = ticket.last_read_by_tecnico ? new Date(ticket.last_read_by_tecnico) : null;
    }

    if (!lastReadDate) {
      // L'altro utente non ha ancora aperto la chat
      return 'sent'; // Una spunta grigia
    }

    if (lastReadDate >= messageDate) {
      // L'altro utente ha letto questo messaggio
      return 'read'; // Due spunte blu
    }

    // L'altro utente ha aperto la chat ma non ha ancora letto questo messaggio
    return 'delivered'; // Due spunte grigie
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border-t">
      <div className="p-4 border-b flex items-center justify-between bg-blue-50 rounded-t-xl">
        <h3 className="font-bold text-lg">Conversazione Ticket {ticket.numero}</h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTicket(null);
          }} 
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4 max-h-[50vh] overflow-y-auto space-y-3">
        {ticket.timeLogs && ticket.timeLogs.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mt-4 space-y-3">
            <h4 className="font-bold text-sm text-blue-800 flex items-center gap-2">
              <Clock size={16} />
              Log Interventi
            </h4>
            <div className="space-y-3">
              {ticket.timeLogs.map((log, index) => {
                let duration = '--';
                if (log.oraInizio && log.oraFine) {
                  const start = new Date('2000/01/01 ' + log.oraInizio);
                  const end = new Date('2000/01/01 ' + log.oraFine);
                  const minutes = Math.round((end - start) / 60000);
                  const hours = Math.floor(minutes / 60);
                  duration = hours + 'h ' + (minutes % 60) + 'm';
                }

                const materialsCost = log.materials ? log.materials.reduce((sum, m) => sum + (m.quantita * m.costo), 0) : 0;
                const hours = parseFloat(log.oreIntervento) || 0;
                const costPerHour = parseFloat(log.costoUnitario) || 0;
                const discount = parseFloat(log.sconto) || 0;
                const laborCost = (costPerHour * (1 - (discount / 100))) * hours;

                return (
                  <div key={index} className="bg-white p-3 rounded-lg border">
                    <div className="flex justify-between items-center text-sm mb-2 pb-1 border-b">
                      <span className="font-bold text-blue-600 flex items-center gap-1">
                        <Calendar size={14} />
                        {formatTimeLogDate(log.data)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold bg-gray-100 px-2 py-1 rounded-full text-sm">
                          {log.oraInizio}-{log.oraFine}
                        </span>
                        <span className="font-bold bg-gray-100 px-2 py-1 rounded-full text-sm">
                          Durata: {duration}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm mb-2">
                      {log.descrizione || "Nessuna descrizione."}
                    </div>

                    <div className="mt-3 pt-3 border-t text-xs space-y-1">
                      {log.materials && log.materials.some(m => m.nome) && (
                        <>
                          <div className="font-bold">Materiali:</div>
                          {log.materials.map((m, i) => (
                            <div key={i} className="flex justify-between pl-2">
                              <span>- {m.nome} (x{m.quantita})</span>
                              <span>{(m.quantita * m.costo).toFixed(2)}€</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="font-bold">Manodopera ({hours.toFixed(2)}h):</span>
                        <span>{laborCost.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t">
                        <span className="text-blue-800">Totale:</span>
                        <span className="text-blue-800">{(materialsCost + laborCost).toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ticket.messaggi && ticket.messaggi.map(m => (
          <React.Fragment key={m.id}>
            {m.reclamo && (m.autore === ticket.nomerichiedente || m.autore === 'Cliente') && (
              <div className="text-center my-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold text-red-800 bg-red-100 rounded-full border">
                  <AlertTriangle size={14} />
                  RECLAMO
                </span>
              </div>
            )}

            {(() => {
              // Determina il tipo di messaggio per il colore
              const isReclamo = m.reclamo;
              const isTecnico = m.autore === 'Tecnico';
              const isRichiedenteOriginale = m.autore === ticket.nomerichiedente || m.autore === 'Cliente';
              
              // Verifica se l'autore del messaggio è un amministratore
              const messageAuthor = users.find(u => {
                const fullName = `${u.nome} ${u.cognome || ''}`.trim();
                return fullName === m.autore;
              });
              const isAmministratore = messageAuthor && 
                                       messageAuthor.admin_companies && 
                                       Array.isArray(messageAuthor.admin_companies) && 
                                       messageAuthor.admin_companies.length > 0;
              
              // Determina il colore del messaggio
              let messageColorClass = '';
              let textColorClass = '';
              let alignmentClass = '';
              
              if (isReclamo) {
                messageColorClass = 'bg-red-50 border-2 border-red-500';
                textColorClass = 'text-red-900';
                alignmentClass = 'text-left';
              } else if (isTecnico) {
                messageColorClass = 'bg-green-600 text-white';
                textColorClass = 'text-white';
                alignmentClass = 'text-right';
              } else if (isRichiedenteOriginale) {
                messageColorClass = 'bg-gray-100';
                textColorClass = 'text-gray-800';
                alignmentClass = 'text-left';
              } else if (isAmministratore) {
                // Amministratore che scrive (non è il richiedente originale)
                messageColorClass = 'bg-blue-100 border-2 border-blue-300';
                textColorClass = 'text-blue-900';
                alignmentClass = 'text-left';
              } else {
                // Fallback
                messageColorClass = 'bg-gray-100';
                textColorClass = 'text-gray-800';
                alignmentClass = 'text-left';
              }
              
              return (
                <div className={alignmentClass}>
                  <div 
                    ref={editingMessageId === m.id ? messageContainerRef : null}
                    className={`inline-block max-w-[80%] rounded-xl shadow p-3 relative ${messageColorClass}`}
              >
                {/* Pulsanti modifica ed elimina */}
                {editingMessageId === m.id ? (
                  // Modalità modifica - mantiene la stessa larghezza del messaggio originale
                  <div className="space-y-3" style={{ width: editingWidth ? `${editingWidth}px` : '100%', minWidth: '300px' }}>
                    <textarea
                      ref={editingTextareaRef}
                      value={editingContent}
                      onChange={(e) => {
                        setEditingContent(e.target.value);
                        // Auto-resize textarea on input
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                      }}
                      onInput={(e) => {
                        // Ensure height adjusts also on paste/undo
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                      }}
                      className={`w-full px-4 py-3 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden whitespace-pre-wrap ${
                        m.reclamo 
                          ? 'bg-red-50 border-red-500 text-red-900'
                          : m.autore === ticket.nomerichiedente || m.autore === 'Cliente'
                            ? 'bg-gray-100 border-gray-300 text-gray-900'
                            : 'bg-blue-50 border-blue-300 text-gray-900'
                      }`}
                      rows={1}
                      autoFocus
                      style={{ height: 'auto', minHeight: '60px', width: '100%' }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors flex items-center gap-1"
                      >
                        <XIcon size={14} />
                        Annulla
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editingContent.trim()}
                        className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Save size={14} />
                        Salva
                      </button>
                    </div>
                  </div>
                ) : (
                  // Modalità visualizzazione
                  <>
                    {/* Pulsanti azioni - solo se l'utente può modificare/eliminare */}
                    {canEditMessage(m) && handleUpdateMessage && (
                      <button
                        onClick={(e) => {
                          const container = e.currentTarget.closest('.inline-block');
                          handleStartEdit(m, container);
                        }}
                        className="absolute top-2 right-2 p-1 rounded hover:bg-blue-200 transition-colors"
                        title="Modifica messaggio"
                      >
                        <Edit2 size={14} className={m.autore === ticket.nomerichiedente || m.autore === 'Cliente' ? 'text-blue-600' : 'text-white'} />
                      </button>
                    )}
                    {currentUser.ruolo === 'tecnico' && handleDeleteMessage && (
                      <button
                        onClick={() => {
                          if (window.confirm('Sei sicuro di voler eliminare questo messaggio?')) {
                            handleDeleteMessage(ticket.id, m.id);
                          }
                        }}
                        className={`absolute ${canEditMessage(m) && handleUpdateMessage ? 'top-2 right-10' : 'top-2 right-2'} p-1 rounded hover:bg-red-200 transition-colors`}
                        title="Elimina messaggio"
                      >
                        <Trash2 size={14} className={m.autore === ticket.nomerichiedente || m.autore === 'Cliente' ? 'text-red-600' : 'text-white'} />
                      </button>
                    )}
                    <div className={`flex items-center gap-1 text-xs mb-1 ${isTecnico ? 'text-white/80' : isAmministratore ? 'text-blue-700' : 'text-gray-600'} ${canEditMessage(m) && handleUpdateMessage ? 'pr-8' : ''}`}>
                      <span className={m.reclamo ? 'text-red-700 font-bold' : 'font-medium'}>
                        {m.reclamo ? '⚠️ RECLAMO - ' : ''}{m.autore}
                        {isAmministratore && <Crown size={12} className="inline-block ml-1 text-yellow-600" title="Amministratore" />}
                        {m.modificato && <span className="text-xs opacity-75 ml-1">(modificato)</span>}
                      </span>
                    </div>
                    <div className={`text-sm whitespace-pre-wrap ${m.reclamo ? 'text-red-900 font-medium' : textColorClass}`}>
                      {m.contenuto}
                    </div>
                    <div className={`text-xs opacity-75 mt-1 flex items-center gap-2 ${
                      m.reclamo 
                        ? 'text-red-700'
                        : isTecnico
                          ? 'text-white/60'
                          : isAmministratore
                            ? 'text-blue-600'
                            : 'text-gray-500'
                    }`}>
                      <span>{formatDate(m.data)}</span>
                      {/* Spunte di lettura (come WhatsApp) */}
                      {(() => {
                        const readStatus = getMessageReadStatus(m);
                        if (!readStatus) return null;
                        
                        if (readStatus === 'sent') {
                          // Una spunta grigia
                          return (
                            <span className="flex items-center ml-1">
                              <Check size={14} className={isTecnico ? 'text-white/60' : isAmministratore ? 'text-blue-600' : 'text-gray-500'} />
                            </span>
                          );
                        } else if (readStatus === 'delivered') {
                          // Una spunta grigia (consegnato ma non letto)
                          return (
                            <span className="flex items-center ml-1">
                              <Check size={14} className={isTecnico ? 'text-white/60' : isAmministratore ? 'text-blue-600' : 'text-gray-500'} />
                            </span>
                          );
                        } else if (readStatus === 'read') {
                          // Due spunte verdi
                          return (
                            <span className="flex items-center ml-1">
                              <Check size={14} className="text-green-500" />
                              <Check size={14} className="text-green-500" style={{ marginLeft: '-8px' }} />
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </>
                )}
              </div>
                </div>
              );
            })()}
          </React.Fragment>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {!['chiuso', 'fatturato', 'inviato'].includes(ticket.stato) && (
        <div className="p-4 border-t">
          {currentUser.ruolo === 'cliente' && ticket.stato === 'risolto' ? (
            <div className="space-y-3">
              <div className="bg-yellow-50 border p-3 text-sm">
                <p className="font-medium">Intervento risolto.</p>
                <p className="mt-1">Puoi Accettare o inviare un Reclamo.</p>
              </div>

              <button
                onClick={() => handleChangeStatus(ticket.id, 'chiuso')}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Accetta e Chiudi
              </button>

              <div className="relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Motivo del reclamo..."
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-red-500 bg-red-50 rounded-lg placeholder-red-400"
                />
                <div className="absolute top-2 right-2 bg-red-100 px-2 py-1 text-xs font-bold text-red-700 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  RECLAMO
                </div>
              </div>

              <button
                onClick={() => onSendMessage(true)}
                disabled={!newMessage.trim()}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                <AlertTriangle size={18} />
                Invia Reclamo
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <textarea
                  ref={messageInputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newMessage.trim()) {
                        onSendMessage(false);
                      }
                    }
                  }}
                  placeholder="Scrivi messaggio... (Invio per inviare, Shift+Invio per nuova riga)"
                  rows={1}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden text-sm whitespace-pre-wrap"
                  style={{ minHeight: '48px', maxHeight: '200px' }}
                />
                <button
                  onClick={() => onSendMessage(false)}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <MessageSquare size={18} />
                </button>
              </div>

              {currentUser.ruolo === 'tecnico' && ticket.stato === 'aperto' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleChangeStatus(ticket.id, 'in_lavorazione')}
                    className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm"
                  >
                    Prendi in carico
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {['chiuso', 'fatturato', 'inviato'].includes(ticket.stato) && (
        <div className="p-4 border-t bg-gray-50 text-center text-gray-600 font-medium rounded-b-xl">
          {ticket.stato === 'chiuso' && (
            <span>Ticket chiuso il {formatDate(ticket.datachiusura)}.</span>
          )}
          {ticket.stato === 'inviato' && (
            <span>Ticket inviato per fatturazione il {formatDate(ticket.datachiusura)}.</span>
          )}
          {ticket.stato === 'fatturato' && (
            <span>Ticket FATTURATO il {formatDate(ticket.datachiusura)}.</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
