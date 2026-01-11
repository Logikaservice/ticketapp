import React, { useState, useEffect } from 'react';
import { X, Clock, Check, Plus, Copy, Trash2, Users, Eye, Edit, Save, Wrench, Minus } from 'lucide-react';
import { calculateDurationHours, normalizeTimeLog, calculateTotalHoursFromIntervals } from '../../utils/helpers';
import { buildApiUrl } from '../../utils/apiConfig';

const TimeLoggerModal = ({
  selectedTicket,
  setSelectedTicket,
  setTickets,
  timeLogs,
  setTimeLogs,
  handleTimeLogChange,
  handleAddTimeLog,
  handleRemoveTimeLog,
  handleDuplicateTimeLog,
  handleMaterialChange,
  handleAddMaterial,
  handleRemoveMaterial,
  handleOffertaChange,
  handleAddOfferta,
  handleRemoveOfferta,
  handleConfirmTimeLogs,
  handleSaveTimeLogs,
  closeModal,
  readOnly = false,
  currentUser,
  getAuthHeader
}) => {
  // Stato locale per gestire la modalità editing
  const [isEditing, setIsEditing] = useState(false);
  
  // Stato per gestire la visibilità delle sezioni collassabili per ogni intervento
  const [expandedSections, setExpandedSections] = useState({});

  // console.debug: rimosso per evitare rumore in console

  // Determina se i campi sono modificabili
  const fieldsDisabled = readOnly && !isEditing;
  
  // Funzione per gestire l'espansione/collasso delle sezioni
  const toggleSection = (logId, section) => {
    setExpandedSections(prev => ({
      ...prev,
      [`${logId}-${section}`]: !prev[`${logId}-${section}`]
    }));
  };
  
  // Verifica se una sezione è espansa
  const isSectionExpanded = (logId, section) => {
    const key = `${logId}-${section}`;
    return expandedSections[key] || false;
  };
  
  // Verifica se una sezione ha dati (per mostrare i dati anche se collassata)
  const hasSectionData = (log, section) => {
    if (section === 'manodopera') {
      const hours = parseFloat(log.oreIntervento) || 0;
      const costPerHour = parseFloat(log.costoUnitario) || 0;
      const discount = parseFloat(log.sconto) || 0;
      return hours > 0 || costPerHour > 0 || discount > 0;
    }
    if (section === 'materiali') {
      return log.materials && log.materials.length > 0;
    }
    return false;
  };

  // Normalizza i timelogs quando vengono caricati (retrocompatibilità)
  useEffect(() => {
    if (timeLogs && Array.isArray(timeLogs)) {
      const normalized = timeLogs.map(log => {
        const normalizedLog = normalizeTimeLog(log);
        
        // Inizializza workPhases se non esiste
        if (!normalizedLog.workPhases || !Array.isArray(normalizedLog.workPhases) || normalizedLog.workPhases.length === 0) {
          const intervals = normalizedLog.timeIntervals || [];
          normalizedLog.workPhases = [{
            id: Date.now() + Math.random(),
            modalita: normalizedLog.modalita || 'Telefonica',
            data: normalizedLog.data || new Date().toISOString().substring(0, 10),
            oraInizio: intervals[0]?.start || normalizedLog.oraInizio || '09:00',
            oraFine: intervals[0]?.end || normalizedLog.oraFine || '10:00'
          }];
        }
        
        return normalizedLog;
      });
      
      // Controlla se ci sono differenze
      const hasChanges = normalized.some((log, idx) => {
        const original = timeLogs[idx];
        return !original.workPhases || JSON.stringify(log.workPhases) !== JSON.stringify(original.workPhases);
      });
      
      if (hasChanges) {
        setTimeLogs(normalized);
      }
    }
  }, [timeLogs?.length]); // Solo quando cambia il numero di log (non ad ogni render)

  // Funzione per aggiungere una nuova fase lavorativa (riga con Modalità, Data, Ora Inizio, Ora Fine)
  const handleAddWorkPhase = (logId) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id === logId) {
        // Se non esiste workPhases, crealo dal primo intervallo o dai dati esistenti
        if (!log.workPhases || !Array.isArray(log.workPhases)) {
          const firstPhase = {
            id: Date.now() + Math.random(),
            modalita: log.modalita || 'Telefonica',
            data: log.data || new Date().toISOString().substring(0, 10),
            oraInizio: intervals[0]?.start || log.oraInizio || '09:00',
            oraFine: intervals[0]?.end || log.oraFine || '10:00'
          };
          log.workPhases = [firstPhase];
        }
        
        // Aggiungi una nuova fase con i valori della fase precedente (o default)
        const lastPhase = log.workPhases[log.workPhases.length - 1];
        const newPhase = {
          id: Date.now() + Math.random(),
          modalita: lastPhase?.modalita || log.modalita || 'Telefonica',
          data: lastPhase?.data || log.data || new Date().toISOString().substring(0, 10),
          oraInizio: '09:00',
          oraFine: '10:00'
        };
        
        const updatedPhases = [...log.workPhases, newPhase];
        
        // Calcola ore totali da tutte le fasi
        const totalHours = updatedPhases.reduce((sum, phase) => {
          if (phase.oraInizio && phase.oraFine) {
            return sum + calculateDurationHours(phase.oraInizio, phase.oraFine);
          }
          return sum;
        }, 0);
        
        return {
          ...log,
          workPhases: updatedPhases,
          oreIntervento: totalHours.toFixed(2),
          // Mantieni retrocompatibilità con il primo intervallo
          modalita: updatedPhases[0]?.modalita || log.modalita,
          data: updatedPhases[0]?.data || log.data,
          oraInizio: updatedPhases[0]?.oraInizio || '',
          oraFine: updatedPhases[0]?.oraFine || ''
        };
      }
      return log;
    }));
  };

  // Funzione per rimuovere una fase lavorativa
  const handleRemoveWorkPhase = (logId, phaseId) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id === logId && log.workPhases && Array.isArray(log.workPhases)) {
        const updatedPhases = log.workPhases.filter(phase => phase.id !== phaseId);
        
        // Non permettere di rimuovere l'ultima fase
        if (updatedPhases.length === 0) {
          return log;
        }
        
        // Calcola ore totali
        const totalHours = updatedPhases.reduce((sum, phase) => {
          if (phase.oraInizio && phase.oraFine) {
            return sum + calculateDurationHours(phase.oraInizio, phase.oraFine);
          }
          return sum;
        }, 0);
        
        return {
          ...log,
          workPhases: updatedPhases,
          oreIntervento: totalHours.toFixed(2),
          // Aggiorna retrocompatibilità
          modalita: updatedPhases[0]?.modalita || log.modalita,
          data: updatedPhases[0]?.data || log.data,
          oraInizio: updatedPhases[0]?.oraInizio || '',
          oraFine: updatedPhases[0]?.oraFine || ''
        };
      }
      return log;
    }));
  };

  // Funzione per aggiornare una fase lavorativa
  const handleUpdateWorkPhase = (logId, phaseId, field, value) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id === logId && log.workPhases && Array.isArray(log.workPhases)) {
        const updatedPhases = log.workPhases.map(phase => {
          if (phase.id === phaseId) {
            return { ...phase, [field]: value };
          }
          return phase;
        });
        
        // Calcola ore totali
        const totalHours = updatedPhases.reduce((sum, phase) => {
          if (phase.oraInizio && phase.oraFine) {
            return sum + calculateDurationHours(phase.oraInizio, phase.oraFine);
          }
          return sum;
        }, 0);
        
        return {
          ...log,
          workPhases: updatedPhases,
          oreIntervento: totalHours.toFixed(2),
          // Aggiorna retrocompatibilità con la prima fase
          modalita: updatedPhases[0]?.modalita || log.modalita,
          data: updatedPhases[0]?.data || log.data,
          oraInizio: updatedPhases[0]?.oraInizio || '',
          oraFine: updatedPhases[0]?.oraFine || ''
        };
      }
      return log;
    }));
  };

  // Funzione per rimuovere un intervallo di tempo
  const handleRemoveTimeInterval = (logId, intervalId) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id === logId) {
        const updatedIntervals = (log.timeIntervals || []).filter(interval => interval.id !== intervalId);
        
        // Non permettere di rimuovere l'ultimo intervallo
        if (updatedIntervals.length === 0) {
          return log;
        }
        
        const totalHours = calculateTotalHoursFromIntervals(updatedIntervals);
        
        return {
          ...log,
          timeIntervals: updatedIntervals,
          oreIntervento: totalHours.toFixed(2),
          // Sincronizza il primo intervallo con oraInizio/oraFine per retrocompatibilità
          oraInizio: updatedIntervals[0]?.start || '',
          oraFine: updatedIntervals[updatedIntervals.length - 1]?.end || ''
        };
      }
      return log;
    }));
  };

  // Funzione per aggiornare un intervallo di tempo
  const handleUpdateTimeInterval = (logId, intervalId, field, value) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id === logId) {
        const updatedIntervals = (log.timeIntervals || []).map(interval => {
          if (interval.id === intervalId) {
            const updated = { ...interval, [field]: value };
            
            // Se si aggiorna start o end, ricalcola la durata dell'intervallo
            if (field === 'start' || field === 'end') {
              const start = field === 'start' ? value : interval.start;
              const end = field === 'end' ? value : interval.end;
              if (start && end) {
                // Verifica che end sia dopo start
                const duration = calculateDurationHours(start, end);
                if (duration < 0) {
                  // Se end è prima di start, non aggiornare
                  return interval;
                }
              }
            }
            
            return updated;
          }
          return interval;
        });
        
        const totalHours = calculateTotalHoursFromIntervals(updatedIntervals);
        
        return {
          ...log,
          timeIntervals: updatedIntervals,
          oreIntervento: totalHours.toFixed(2),
          // Sincronizza il primo intervallo con oraInizio/oraFine per retrocompatibilità
          oraInizio: updatedIntervals[0]?.start || '',
          oraFine: updatedIntervals[updatedIntervals.length - 1]?.end || ''
        };
      }
      return log;
    }));
  };

  return (
    <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
          {readOnly ? (
            isEditing ? <Edit size={24} /> : <Eye size={24} />
          ) : (
            <Clock size={24} />
          )}
          {readOnly ? (isEditing ? 'Modifica Intervento' : 'Visualizza Intervento') : 'Registra Intervento'}
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 p-3 rounded-lg text-sm">
          Ticket: {selectedTicket.numero} - {selectedTicket.titolo}
        </div>

        {Array.isArray(timeLogs) && timeLogs.map((log, index) => {
          // Assicurati che il log abbia timeIntervals normalizzati
          const normalizedLog = normalizeTimeLog(log);
          const intervals = normalizedLog.timeIntervals || [];
          
          // Inizializza workPhases se non esiste (migrazione da struttura vecchia)
          if (!normalizedLog.workPhases || !Array.isArray(normalizedLog.workPhases)) {
            normalizedLog.workPhases = [{
              id: Date.now() + Math.random(),
              modalita: normalizedLog.modalita || 'Telefonica',
              data: normalizedLog.data || new Date().toISOString().substring(0, 10),
              oraInizio: intervals[0]?.start || normalizedLog.oraInizio || '09:00',
              oraFine: intervals[0]?.end || normalizedLog.oraFine || '10:00'
            }];
          }
          
          const workPhases = normalizedLog.workPhases || [];
          
          const hours = parseFloat(normalizedLog.oreIntervento) || 0;
          const costPerHour = parseFloat(normalizedLog.costoUnitario) || 0;
          const discount = parseFloat(normalizedLog.sconto) || 0;
          const total = (costPerHour * (1 - (discount / 100))) * hours;

          return (
            <div key={log.id} className="p-4 border-2 border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 relative shadow-sm">
              <h3 className="mb-4 flex justify-between text-blue-800 font-bold items-center">
                <span className="flex items-center gap-2">
                  <Wrench size={20} />
                  Intervento #{index + 1}
                </span>
                {!fieldsDisabled && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm('Sei sicuro di voler eliminare questo intervento?')) {
                          handleRemoveTimeLog(log.id);
                        }
                      }}
                      className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                      title="Elimina intervento"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDuplicateTimeLog(log)}
                      className="text-blue-500 p-1 hover:bg-blue-50 rounded transition-colors"
                      title="Duplica intervento"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                )}
              </h3>

              {/* Sezione Intervento racchiusa */}
              <div className="p-4 bg-white rounded-lg border border-blue-200">

                {/* Fasi lavorative */}
                <div className="mb-4 space-y-3">
                  {workPhases.map((phase, phaseIndex) => (
                    <div key={phase.id} className="grid md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs mb-1">Modalità</label>
                    <select
                          value={phase.modalita || 'Telefonica'}
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'modalita', e.target.value)}
                      disabled={fieldsDisabled}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option>Telefonica</option>
                      <option>Teleassistenza</option>
                      <option>Presso il Cliente</option>
                      <option>In laboratorio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Data</label>
                    <input
                      type="date"
                          value={phase.data || ''}
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'data', e.target.value)}
                      disabled={fieldsDisabled}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Ora Inizio</label>
                    <input
                      type="time"
                          value={phase.oraInizio || ''}
                      step="900"
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'oraInizio', e.target.value)}
                          disabled={fieldsDisabled || normalizedLog.eventoGiornaliero}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Ora Fine</label>
                    <input
                      type="time"
                          value={phase.oraFine || ''}
                      step="900"
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'oraFine', e.target.value)}
                          disabled={fieldsDisabled || normalizedLog.eventoGiornaliero}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-600 mb-1">Durata</div>
                          <div className="text-sm font-semibold text-gray-700">
                            {phase.oraInizio && phase.oraFine 
                              ? `${calculateDurationHours(phase.oraInizio, phase.oraFine).toFixed(2)} ore`
                              : '0.00 ore'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!fieldsDisabled && !normalizedLog.eventoGiornaliero && workPhases.length > 1 && (
                            <button
                              onClick={() => handleRemoveWorkPhase(normalizedLog.id, phase.id)}
                              className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                              title="Rimuovi fase"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                          {!fieldsDisabled && !normalizedLog.eventoGiornaliero && phaseIndex === workPhases.length - 1 && (
                            <button
                              onClick={() => handleAddWorkPhase(normalizedLog.id)}
                              className="text-blue-500 p-1 hover:bg-blue-50 rounded transition-colors"
                              title="Aggiungi fase"
                            >
                              <Plus size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totale ore di tutte le fasi */}
                <div className="mb-4 text-sm font-semibold text-gray-700 text-right">
                  Totale: {hours.toFixed(2)} ore
                </div>

                {/* Evento giornaliero */}
                <div className="mb-4">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                      checked={!!normalizedLog.eventoGiornaliero}
                      onChange={(e) => setTimeLogs(p => p.map(l => l.id === normalizedLog.id ? {
                          ...l,
                          eventoGiornaliero: e.target.checked,
                          // se diventa giornaliero, azzero gli orari per non inviarli
                        ...(e.target.checked ? { 
                          timeIntervals: l.timeIntervals?.map(interval => ({ ...interval, start: '', end: '' })) || [],
                          oraInizio: '', 
                          oraFine: '', 
                          oreIntervento: 0 
                        } : {})
                        } : l))}
                        className="accent-blue-600"
                      />
                      Evento giornaliero
                    </label>
                </div>

                <textarea
                  rows="3"
                  value={normalizedLog.descrizione}
                  onChange={(e) => {
                    // Auto-resize textarea on input
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                    handleTimeLogChange(normalizedLog.id, 'descrizione', e.target.value);
                  }}
                  onInput={(e) => {
                    // Ensure height adjusts also on paste/undo
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  placeholder="Descrizione"
                  disabled={fieldsDisabled}
                  className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden"
                  style={{ height: 'auto' }}
                />

                <div className="mt-5 border-t pt-4">
                  {isSectionExpanded(log.id, 'manodopera') ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold">Costo Manodopera</h4>
                        {!fieldsDisabled && (
                          <button
                            onClick={() => toggleSection(normalizedLog.id, 'manodopera')}
                            className="text-gray-500 hover:text-gray-700 text-xs"
                          >
                            Nascondi
                          </button>
                        )}
                      </div>
                  <div className="grid sm:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-xs mb-1">Ore</label>
                      <input
                        type="number"
                        step="0.25"
                            value={normalizedLog.oreIntervento}
                            onChange={(e) => handleTimeLogChange(normalizedLog.id, 'oreIntervento', e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Costo Unit.(€)</label>
                      <input
                        type="number"
                        step="0.01"
                            value={normalizedLog.costoUnitario}
                            onChange={(e) => handleTimeLogChange(normalizedLog.id, 'costoUnitario', e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Sconto(%)</label>
                      <input
                        type="number"
                            value={normalizedLog.sconto}
                            onChange={(e) => handleTimeLogChange(normalizedLog.id, 'sconto', e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Costo Scontato</label>
                      <div className="p-2.5 bg-gray-100 rounded-lg font-bold">
                        {(costPerHour * (1 - (discount / 100))).toFixed(2)}€
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Totale</label>
                      <div className="p-2.5 bg-blue-100 rounded-lg font-bold text-blue-800">
                        {total.toFixed(2)}€
                      </div>
                    </div>
                  </div>
                    </>
                  ) : (
                    <>
                      {!fieldsDisabled && (
                        <button
                          onClick={() => toggleSection(normalizedLog.id, 'manodopera')}
                          className="w-full text-blue-500 text-sm font-medium flex items-center justify-center gap-2 p-2 border border-blue-300 rounded-lg hover:bg-blue-50"
                        >
                          <Plus size={16} />
                          Aggiungi Costo Manodopera
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-5 border-t pt-4">
                  {isSectionExpanded(normalizedLog.id, 'materiali') ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                    <Users size={16} />
                    Materiali
                  </h4>
                        {!fieldsDisabled && (
                          <button
                            onClick={() => toggleSection(normalizedLog.id, 'materiali')}
                            className="text-gray-500 hover:text-gray-700 text-xs"
                          >
                            Nascondi
                          </button>
                        )}
                      </div>
                  <div className="space-y-3">
                        {normalizedLog.materials && normalizedLog.materials.map(m => (
                      <div key={m.id} className="grid grid-cols-6 gap-3 items-center p-2 bg-gray-50 rounded-lg border">
                        <div className="col-span-2">
                          <label className="block text-xs mb-1">Materiale</label>
                          <input
                            type="text"
                            value={m.nome}
                                onChange={(e) => handleMaterialChange(normalizedLog.id, m.id, 'nome', e.target.value)}
                            disabled={fieldsDisabled}
                            className="w-full px-2 py-1 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs mb-1">Qta</label>
                          <input
                            type="number"
                            min="0"
                            value={m.quantita === 0 || m.quantita === '0' ? '' : (m.quantita || '')}
                                onChange={(e) => handleMaterialChange(normalizedLog.id, m.id, 'quantita', e.target.value)}
                            disabled={fieldsDisabled}
                            className="w-full px-2 py-1 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder=""
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs mb-1">Costo (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={m.costo === 0 || m.costo === '0' || m.costo === 0.00 ? '' : (m.costo || '')}
                                onChange={(e) => handleMaterialChange(normalizedLog.id, m.id, 'costo', e.target.value)}
                            disabled={fieldsDisabled}
                            className="w-full px-2 py-1 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder=""
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs mb-1">Totale (€)</label>
                          <div className="p-2 bg-purple-100 rounded-lg font-bold text-purple-800 text-right">
                            {(() => {
                              const qta = m.quantita === '' || m.quantita === null || m.quantita === undefined ? 0 : parseFloat(m.quantita) || 0;
                              const costo = m.costo === '' || m.costo === null || m.costo === undefined ? 0 : parseFloat(m.costo) || 0;
                              return (qta * costo).toFixed(2);
                            })()}
                          </div>
                        </div>

                        <div className="col-span-1 pt-4 text-right">
                              {!fieldsDisabled && normalizedLog.materials.length > 1 && (
                            <button
                                  onClick={() => handleRemoveMaterial(normalizedLog.id, m.id)}
                              className="text-red-500 p-1"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {!fieldsDisabled && (
                      <button
                            onClick={() => handleAddMaterial(normalizedLog.id)}
                        className="w-full text-blue-500 text-xs font-medium flex items-center justify-center gap-1 mt-2 p-1"
                      >
                        <Plus size={14} />
                        Aggiungi Materiale
                      </button>
                    )}
                  </div>
                    </>
                  ) : (
                    !fieldsDisabled && (
                      <button
                        onClick={() => {
                          toggleSection(normalizedLog.id, 'materiali');
                          // Se non ci sono materiali, aggiungine uno automaticamente
                          if (!normalizedLog.materials || normalizedLog.materials.length === 0) {
                            handleAddMaterial(normalizedLog.id);
                          }
                        }}
                        className="w-full text-blue-500 text-sm font-medium flex items-center justify-center gap-2 p-2 border border-blue-300 rounded-lg hover:bg-blue-50"
                      >
                        <Plus size={16} />
                        Aggiungi Materiale
                      </button>
                    )
                  )}
                </div>

                {/* Sezione Come da Offerta - LEGATA A QUESTO INTERVENTO */}
                {normalizedLog.offerte && normalizedLog.offerte.length > 0 && (
                  <div className="mt-5 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
                  <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                    <Users size={20} />
                    Come da Offerta
                  </h3>

                  <div className="space-y-4">
                    {normalizedLog.offerte.map((offerta, offertaIndex) => (
                      <div key={offerta.id} className="p-4 bg-white rounded-lg border border-purple-200">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-purple-700">Offerta #{offertaIndex + 1}</h4>
                          {!fieldsDisabled && (
                            <button
                              onClick={() => handleRemoveOfferta(normalizedLog.id, offerta.id)}
                              className="text-red-500 p-1 hover:bg-red-50 rounded"
                              title="Elimina offerta"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-3 mb-4">
                          <div className="w-full md:w-auto" style={{ minWidth: 140 }}>
                            <label className="block text-xs mb-1 text-gray-600 whitespace-nowrap">Offerta n°</label>
                            <input
                              type="text"
                              value={offerta.numeroOfferta}
                              onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'numeroOfferta', e.target.value)}
                              placeholder="OFF-001"
                              disabled={fieldsDisabled}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>

                          <div className="w-full md:w-auto" style={{ minWidth: 125 }}>
                            <label className="block text-xs mb-1 text-gray-600 whitespace-nowrap">Data</label>
                            <input
                              type="date"
                              value={offerta.dataOfferta}
                              onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'dataOfferta', e.target.value)}
                              disabled={fieldsDisabled}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>

                          <div className="w-full md:w-auto" style={{ minWidth: 70 }}>
                            <label className="block text-xs mb-1 text-gray-600 whitespace-nowrap">Qta</label>
                            <input
                              type="number"
                              min="1"
                              step="0.25"
                              value={offerta.qta}
                              onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'qta', e.target.value)}
                              disabled={fieldsDisabled}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>

                          <div className="w-full md:w-auto" style={{ minWidth: 120 }}>
                            <label className="block text-xs mb-1 text-gray-600 whitespace-nowrap">Costo Unit.</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={offerta.costoUnitario || 0}
                              onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'costoUnitario', e.target.value)}
                              disabled={fieldsDisabled}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>

                          <div className="w-full md:w-auto" style={{ minWidth: 80 }}>
                            <label className="block text-xs mb-1 text-gray-600 whitespace-nowrap">Sconto %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={offerta.sconto}
                              onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'sconto', e.target.value)}
                              disabled={fieldsDisabled}
                              className="w-full px-2 py-1.5 border rounded-lg text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </div>

                          <div className="w-full md:w-auto md:ml-auto" style={{ minWidth: 120 }}>
                            <label className="block text-xs mb-1 text-gray-600 whitespace-nowrap">Totale</label>
                            <div className="px-2 py-1.5 bg-purple-100 rounded-lg font-bold text-purple-800 text-sm">
                              {offerta.totale.toFixed(2)}€
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs mb-1 text-gray-600">Descrizione</label>
                          <textarea
                            rows="2"
                            value={offerta.descrizione}
                            onChange={(e) => {
                              e.currentTarget.style.height = 'auto';
                              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                              handleOffertaChange(log.id, offerta.id, 'descrizione', e.target.value);
                            }}
                            onInput={(e) => {
                              e.currentTarget.style.height = 'auto';
                              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                            placeholder="Descrizione dell'offerta..."
                            disabled={fieldsDisabled}
                            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden"
                            style={{ height: 'auto' }}
                          />
                        </div>
                      </div>
                    ))}

                    {!fieldsDisabled && (
                      <button
                        onClick={() => handleAddOfferta(normalizedLog.id)}
                        className="w-full text-purple-600 text-sm font-medium flex items-center justify-center gap-2 p-2 border border-purple-300 rounded-lg hover:bg-purple-50"
                      >
                        <Plus size={16} />
                        Aggiungi Offerta
                      </button>
                    )}
                  </div>
                  </div>
                )}

                {!fieldsDisabled && (!log.offerte || log.offerte.length === 0) && (
                  <button
                    onClick={() => handleAddOfferta(log.id)}
                    className="mt-5 w-full text-purple-600 text-sm font-medium flex items-center justify-center gap-2 p-2 border border-purple-300 rounded-lg hover:bg-purple-50"
                  >
                    <Plus size={16} />
                    Aggiungi Offerta
                  </button>
                )}
              </div> {/* Chiusura sezione Intervento racchiusa */}
            </div>
          );
        })}

        {!fieldsDisabled && (
          <button
            onClick={handleAddTimeLog}
            className="w-full px-4 py-2 border border-blue-500 text-blue-600 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Aggiungi Intervento
          </button>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg">
            {readOnly && !isEditing ? 'Chiudi' : 'Annulla'}
          </button>

          {/* Pulsante Modifica - Solo per TECNICO in modalità readOnly */}
          {readOnly && !isEditing && currentUser?.ruolo === 'tecnico' && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Edit size={18} />
              Modifica
            </button>
          )}

          {/* Pulsante Salva - Quando in modalità editing */}
          {readOnly && isEditing && (
            <button
              onClick={() => {
                handleSaveTimeLogs();
                setIsEditing(false);
              }}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salva Modifiche
            </button>
          )}

          {/* Pulsante Conferma e Risolvi - Solo quando NON è readOnly */}
          {!readOnly && (
            <button
              onClick={handleConfirmTimeLogs}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Conferma e Risolvi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeLoggerModal;
