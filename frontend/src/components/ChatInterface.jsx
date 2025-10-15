import React, { useState } from 'react';
import { X, MessageSquare, Check, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { formatDate, formatTimeLogDate } from '../utils/formatters';

const ChatInterface = ({ ticket, currentUser, setSelectedTicket, handleSendMessage, handleChangeStatus }) => {
  const [newMessage, setNewMessage] = useState('');

  const onSendMessage = (isReclamo) => {
    if (!isReclamo) isReclamo = false;
    handleSendMessage(ticket.id, newMessage, isReclamo);
    setNewMessage('');
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

            <div className={m.autore === ticket.nomerichiedente || m.autore === 'Cliente' ? 'text-left' : 'text-right'}>
              <div className={'inline-block max-w-[80%] rounded-xl shadow p-3 ' + (
                m.reclamo 
                  ? 'bg-red-50 border-2 border-red-500'
                  : m.autore === ticket.nomerichiedente || m.autore === 'Cliente'
                    ? 'bg-gray-100'
                    : 'bg-blue-600 text-white'
              )}>
                <div className={'flex items-center gap-1 text-xs mb-1 ' + (
                  m.autore === ticket.nomerichiedente || m.autore === 'Cliente' 
                    ? 'text-gray-600' 
                    : 'text-white/80'
                )}>
                  <span className={m.reclamo ? 'text-red-700 font-bold' : 'font-medium'}>
                    {m.reclamo ? '⚠️ RECLAMO - ' : ''}{m.autore}
                  </span>
                </div>
                <div className={'text-sm whitespace-pre-wrap ' + (m.reclamo ? 'text-red-900 font-medium' : '')}>
                  {m.contenuto}
                </div>
                <div className={'text-xs opacity-75 mt-1 ' + (
                  m.reclamo 
                    ? 'text-red-700'
                    : m.autore === ticket.nomerichiedente || m.autore === 'Cliente'
                      ? 'text-gray-500'
                      : 'text-white/60'
                )}>
                  {formatDate(m.data)}
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}
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
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onSendMessage(false)}
                  placeholder="Scrivi messaggio..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => onSendMessage(false)}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <MessageSquare size={18} />
                </button>
              </div>

              {currentUser.ruolo === 'tecnico' && (
                <div className="flex gap-2 mt-3">
                  {ticket.stato === 'aperto' && (
                    <button
                      onClick={() => handleChangeStatus(ticket.id, 'in_lavorazione')}
                      className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm"
                    >
                      Prendi in carico
                    </button>
                  )}
                  {ticket.stato === 'in_lavorazione' && (
                    <button
                      onClick={() => handleChangeStatus(ticket.id, 'risolto')}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm"
                    >
                      Segna come risolto
                    </button>
                  )}
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
