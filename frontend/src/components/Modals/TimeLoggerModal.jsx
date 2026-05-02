import React, { useState, useEffect } from 'react';
import { Clock, Check, Plus, Copy, Trash2, Users, Eye, Edit, Save, Wrench, Minus } from 'lucide-react';
import { calculateDurationHours, normalizeTimeLog, calculateTotalHoursFromIntervals } from '../../utils/helpers';
import { buildApiUrl } from '../../utils/apiConfig';
import { HUB_MODAL_FIELD_CLS, HUB_MODAL_TEXTAREA_CLS } from '../../utils/techHubAccent';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton,
} from './HubModalChrome';

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
  const isSectionExpanded = (logId, section, log) => {
    // In modalità visualizzazione (readOnly), mostrare solo se ci sono dati SIGNIFICATIVI
    if (readOnly && log) {
      if (section === 'manodopera') {
        // Mostra solo se esiste un costo orario o uno sconto reale (le ore auto-calcolate non bastano)
        const costPerHour = parseFloat(log.costoUnitario) || 0;
        const discount = parseFloat(log.sconto) || 0;
        if (costPerHour > 0 || discount > 0) return true;
        return false;
      }
      if (section === 'materiali') {
        // Mostra solo se c'è almeno un materiale con un nome
        const hasRealMaterial = log.materials && log.materials.some(m => (m.nome || '').trim() !== '');
        return !!hasRealMaterial;
      }
    }
    const key = `${logId}-${section}`;
    return expandedSections[key] || false;
  };

  // Verifica se una sezione ha dati (per mostrare i dati anche se collassata)
  const hasSectionData = (log, section) => {
    if (section === 'manodopera') {
      const costPerHour = parseFloat(log.costoUnitario) || 0;
      const discount = parseFloat(log.sconto) || 0;
      return costPerHour > 0 || discount > 0;
    }
    if (section === 'materiali') {
      return log.materials && log.materials.some(m => (m.nome || '').trim() !== '');
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

  const HeaderIcon = readOnly ? (isEditing ? Edit : Eye) : Clock;
  const headerTitle = readOnly
    ? isEditing
      ? 'Modifica Intervento'
      : 'Visualizza Intervento'
    : 'Registra Intervento';

  return (
    <HubModalInnerCard maxWidthClass="max-w-4xl" className="flex max-h-[90vh] w-full flex-col overflow-hidden">
      <HubModalChromeHeader
        icon={HeaderIcon}
        title={headerTitle}
        subtitle={
          selectedTicket
            ? `Ticket ${selectedTicket.numero} — ${selectedTicket.titolo}`
            : undefined
        }
        onClose={closeModal}
      />
      <HubModalBody className="space-y-6">
        <div className="rounded-lg border border-sky-500/35 bg-sky-500/12 p-3 text-sm text-sky-50">
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
            <div
              key={log.id}
              className="relative rounded-lg border border-white/10 bg-black/20 p-4 shadow-sm"
            >
              <h3 className="mb-4 flex items-center justify-between font-bold text-white">
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
                      className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/15"
                      title="Elimina intervento"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDuplicateTimeLog(log)}
                      className="rounded p-1 text-[color:var(--hub-accent)] transition-colors hover:bg-white/10"
                      title="Duplica intervento"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                )}
              </h3>

              {/* Sezione Intervento racchiusa */}
              <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">

                {/* Fasi lavorative */}
                <div className="mb-4 space-y-3">
                  {workPhases.map((phase, phaseIndex) => (
                    <div key={phase.id} className="grid md:grid-cols-5 gap-4 items-end">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/70">Modalità</label>
                        <select
                          value={phase.modalita || 'Telefonica'}
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'modalita', e.target.value)}
                          disabled={fieldsDisabled}
                          className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <option>Telefonica</option>
                          <option>Teleassistenza</option>
                          <option>Presso il Cliente</option>
                          <option>In laboratorio</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/70">Data</label>
                        <input
                          type="date"
                          value={phase.data || ''}
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'data', e.target.value)}
                          disabled={fieldsDisabled}
                          className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/70">Ora Inizio</label>
                        <input
                          type="time"
                          value={phase.oraInizio || ''}
                          step="900"
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'oraInizio', e.target.value)}
                          disabled={fieldsDisabled || normalizedLog.eventoGiornaliero}
                          className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/70">Ora Fine</label>
                        <input
                          type="time"
                          value={phase.oraFine || ''}
                          step="900"
                          onChange={(e) => handleUpdateWorkPhase(normalizedLog.id, phase.id, 'oraFine', e.target.value)}
                          disabled={fieldsDisabled || normalizedLog.eventoGiornaliero}
                          className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-white/55 mb-1">Durata</div>
                          <div className="text-sm font-semibold text-white">
                            {phase.oraInizio && phase.oraFine
                              ? `${calculateDurationHours(phase.oraInizio, phase.oraFine).toFixed(2)} ore`
                              : '0.00 ore'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!fieldsDisabled && !normalizedLog.eventoGiornaliero && workPhases.length > 1 && (
                            <button
                              onClick={() => handleRemoveWorkPhase(normalizedLog.id, phase.id)}
                              className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/15"
                              title="Rimuovi fase"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                          {!fieldsDisabled && !normalizedLog.eventoGiornaliero && phaseIndex === workPhases.length - 1 && (
                            <button
                              onClick={() => handleAddWorkPhase(normalizedLog.id)}
                              className="rounded p-1 text-[color:var(--hub-accent)] transition-colors hover:bg-white/10"
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
                <div className="mb-4 text-right text-sm font-semibold text-white">
                  Totale: {hours.toFixed(2)} ore
                </div>

                {/* Evento giornaliero */}
                <div className="mb-4">
                  <label className="inline-flex items-center gap-2 text-sm text-white/85">
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
                      className="rounded border-white/20 bg-black/30 accent-[color:var(--hub-accent)]"
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
                  className={`${HUB_MODAL_TEXTAREA_CLS} disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden`}
                  style={{ height: 'auto' }}
                />

                <div className="mt-5 border-t pt-4">
                  {isSectionExpanded(log.id, 'manodopera', normalizedLog) ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-white">Costo Manodopera</h4>
                        {!fieldsDisabled && (
                          <button
                            onClick={() => toggleSection(normalizedLog.id, 'manodopera')}
                            className="text-xs text-white/50 transition hover:text-white/80"
                          >
                            Nascondi
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-5 gap-4 items-end">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-white/70">Ore</label>
                          <input
                            type="number"
                            step="0.25"
                            value={normalizedLog.oreIntervento}
                            onChange={(e) => handleTimeLogChange(normalizedLog.id, 'oreIntervento', e.target.value)}
                            disabled={fieldsDisabled}
                            className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-white/70">Costo Unit.(€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={normalizedLog.costoUnitario}
                            onChange={(e) => handleTimeLogChange(normalizedLog.id, 'costoUnitario', e.target.value)}
                            disabled={fieldsDisabled}
                            className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-white/70">Sconto(%)</label>
                          <input
                            type="number"
                            value={normalizedLog.sconto}
                            onChange={(e) => handleTimeLogChange(normalizedLog.id, 'sconto', e.target.value)}
                            disabled={fieldsDisabled}
                            className={`${HUB_MODAL_FIELD_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-white/70">Costo Scontato</label>
                          <div className="rounded-lg bg-black/30 p-2.5 font-bold text-white">
                            {(costPerHour * (1 - (discount / 100))).toFixed(2)}€
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-white/70">Totale</label>
                          <div className="rounded-lg border border-[color:var(--hub-accent-border)] bg-[color:var(--hub-accent)]/15 p-2.5 font-bold text-white">
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
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 p-2 text-sm font-medium text-[color:var(--hub-accent)] transition hover:bg-white/5"
                        >
                          <Plus size={16} />
                          Aggiungi Costo Manodopera
                        </button>
                      )}
                      {/* In readOnly senza dati, non mostrare nulla */}
                    </>
                  )}
                </div>

                <div className="mt-5 border-t pt-4">
                  {isSectionExpanded(normalizedLog.id, 'materiali', normalizedLog) ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                          <Users size={16} />
                          Materiali
                        </h4>
                        {!fieldsDisabled && (
                          <button
                            onClick={() => toggleSection(normalizedLog.id, 'materiali')}
                            className="text-xs text-white/50 transition hover:text-white/80"
                          >
                            Nascondi
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {normalizedLog.materials && normalizedLog.materials.map(m => (
                          <div key={m.id} className="grid grid-cols-6 items-center gap-3 rounded-lg border border-white/10 bg-black/25 p-2">
                            <div className="col-span-2">
                              <label className="mb-1 block text-xs font-medium text-white/70">Materiale</label>
                              <input
                                type="text"
                                value={m.nome}
                                onChange={(e) => handleMaterialChange(normalizedLog.id, m.id, 'nome', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                              />
                            </div>

                            <div className="col-span-1">
                              <label className="mb-1 block text-xs font-medium text-white/70">Qta</label>
                              <input
                                type="number"
                                min="0"
                                value={m.quantita === 0 || m.quantita === '0' ? '' : (m.quantita || '')}
                                onChange={(e) => handleMaterialChange(normalizedLog.id, m.id, 'quantita', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                                placeholder=""
                              />
                            </div>

                            <div className="col-span-1">
                              <label className="mb-1 block text-xs font-medium text-white/70">Costo (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={m.costo === 0 || m.costo === '0' || m.costo === 0.00 ? '' : (m.costo || '')}
                                onChange={(e) => handleMaterialChange(normalizedLog.id, m.id, 'costo', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                                placeholder=""
                              />
                            </div>

                            <div className="col-span-1">
                              <label className="mb-1 block text-xs font-medium text-white/70">Totale (€)</label>
                              <div className="rounded-lg bg-violet-500/20 p-2 text-right font-bold text-violet-100">
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
                                  className="p-1 text-red-400"
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
                            className="mt-2 flex w-full items-center justify-center gap-1 p-1 text-xs font-medium text-[color:var(--hub-accent)]"
                          >
                            <Plus size={14} />
                            Aggiungi Materiale
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {!fieldsDisabled && (
                        <button
                          onClick={() => {
                            toggleSection(normalizedLog.id, 'materiali');
                            // Se non ci sono materiali, aggiungine uno automaticamente
                            if (!normalizedLog.materials || normalizedLog.materials.length === 0) {
                              handleAddMaterial(normalizedLog.id);
                            }
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 p-2 text-sm font-medium text-[color:var(--hub-accent)] transition hover:bg-white/5"
                        >
                          <Plus size={16} />
                          Aggiungi Materiale
                        </button>
                      )}
                      {/* In readOnly senza dati, non mostrare nulla */}
                    </>
                  )}
                </div>

                {/* Sezione Come da Offerta - LEGATA A QUESTO INTERVENTO */}
                {normalizedLog.offerte && normalizedLog.offerte.length > 0 && (
                  <div className="mt-5 rounded-lg border border-violet-400/30 bg-violet-500/10 p-4">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-violet-100">
                      <Users size={20} />
                      Come da Offerta
                    </h3>

                    <div className="space-y-4">
                      {normalizedLog.offerte.map((offerta, offertaIndex) => (
                        <div key={offerta.id} className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold text-violet-100">Offerta #{offertaIndex + 1}</h4>
                            {!fieldsDisabled && (
                              <button
                                onClick={() => handleRemoveOfferta(normalizedLog.id, offerta.id)}
                                className="rounded p-1 text-red-400 hover:bg-red-500/15"
                                title="Elimina offerta"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-3 mb-4">
                            <div className="w-full md:w-auto" style={{ minWidth: 140 }}>
                              <label className="mb-1 block whitespace-nowrap text-xs font-medium text-white/65">Offerta n°</label>
                              <input
                                type="text"
                                value={offerta.numeroOfferta}
                                onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'numeroOfferta', e.target.value)}
                                placeholder="OFF-001"
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                              />
                            </div>

                            <div className="w-full md:w-auto" style={{ minWidth: 125 }}>
                              <label className="mb-1 block whitespace-nowrap text-xs font-medium text-white/65">Data</label>
                              <input
                                type="date"
                                value={offerta.dataOfferta}
                                onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'dataOfferta', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                              />
                            </div>

                            <div className="w-full md:w-auto" style={{ minWidth: 70 }}>
                              <label className="mb-1 block whitespace-nowrap text-xs font-medium text-white/65">Qta</label>
                              <input
                                type="number"
                                min="1"
                                step="0.25"
                                value={offerta.qta}
                                onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'qta', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                              />
                            </div>

                            <div className="w-full md:w-auto" style={{ minWidth: 120 }}>
                              <label className="mb-1 block whitespace-nowrap text-xs font-medium text-white/65">Costo Unit.</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={offerta.costoUnitario || 0}
                                onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'costoUnitario', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                              />
                            </div>

                            <div className="w-full md:w-auto" style={{ minWidth: 80 }}>
                              <label className="mb-1 block whitespace-nowrap text-xs font-medium text-white/65">Sconto %</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={offerta.sconto}
                                onChange={(e) => handleOffertaChange(normalizedLog.id, offerta.id, 'sconto', e.target.value)}
                                disabled={fieldsDisabled}
                                className={`${HUB_MODAL_FIELD_CLS} px-2 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                              />
                            </div>

                            <div className="w-full md:w-auto md:ml-auto" style={{ minWidth: 120 }}>
                              <label className="mb-1 block whitespace-nowrap text-xs font-medium text-white/65">Totale</label>
                              <div className="rounded-lg bg-violet-500/20 px-2 py-1.5 text-sm font-bold text-violet-100">
                                {offerta.totale.toFixed(2)}€
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-white/65">Descrizione</label>
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
                              className={`${HUB_MODAL_TEXTAREA_CLS} disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden`}
                              style={{ height: 'auto' }}
                            />
                          </div>
                        </div>
                      ))}

                      {!fieldsDisabled && (
                        <button
                          onClick={() => handleAddOfferta(normalizedLog.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/40 p-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
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
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/40 p-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"
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
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--hub-accent)] px-4 py-2 text-[color:var(--hub-accent)] transition hover:bg-white/5"
          >
            <Plus size={18} />
            Aggiungi Intervento
          </button>
        )}
      </HubModalBody>
      <HubModalChromeFooter className="justify-end gap-2">
        <HubModalSecondaryButton className="min-w-[8rem] flex-1 sm:flex-none" onClick={closeModal}>
          {readOnly && !isEditing ? 'Chiudi' : 'Annulla'}
        </HubModalSecondaryButton>
        {readOnly && !isEditing && currentUser?.ruolo === 'tecnico' && (
          <HubModalPrimaryButton className="min-w-[8rem] flex-1 sm:flex-none" onClick={() => setIsEditing(true)}>
            <span className="flex items-center justify-center gap-2">
              <Edit size={18} />
              Modifica
            </span>
          </HubModalPrimaryButton>
        )}
        {readOnly && isEditing && (
          <HubModalPrimaryButton
            className="min-w-[8rem] flex-1 sm:flex-none"
            onClick={() => {
              handleSaveTimeLogs();
              setIsEditing(false);
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Save size={18} />
              Salva Modifiche
            </span>
          </HubModalPrimaryButton>
        )}
        {!readOnly && (
          <HubModalPrimaryButton className="min-w-[8rem] flex-1 sm:flex-none" onClick={handleConfirmTimeLogs}>
            <span className="flex items-center justify-center gap-2">
              <Check size={18} />
              Conferma e Risolvi
            </span>
          </HubModalPrimaryButton>
        )}
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default TimeLoggerModal;
