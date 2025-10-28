// src/hooks/useTimeLogs.js

import { useState } from 'react';
import { getInitialMaterial, getInitialTimeLog, getInitialOfferta } from '../utils/helpers';

export const useTimeLogs = (selectedTicket, setTickets, setSelectedTicket, showNotification, getAuthHeader) => {
  const [timeLogs, setTimeLogs] = useState([]);

  // Inizializza timeLogs da un ticket
  const initializeTimeLogs = (ticket) => {
    const logs = Array.isArray(ticket.timelogs) ? ticket.timelogs : [];
    const initialLogs = logs.length > 0 
      ? logs.map(lg => ({ 
          ...lg, 
          id: Date.now() + Math.random(), 
          materials: Array.isArray(lg.materials) 
            ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) 
            : [getInitialMaterial()],
          offerte: Array.isArray(lg.offerte) 
            ? lg.offerte.map(o => ({ ...o, id: Date.now() + Math.random() })) 
            : [getInitialOfferta()]
        })) 
      : [getInitialTimeLog()];
    setTimeLogs(initialLogs);
  };

  // Inizializza timeLogs per visualizzazione (senza default se vuoto)
  const initializeTimeLogsForView = (ticket) => {
    const logs = Array.isArray(ticket.timelogs) ? ticket.timelogs : [];
    const initialLogs = logs.length > 0 
      ? logs.map(lg => ({ 
          ...lg, 
          id: Date.now() + Math.random(), 
          materials: Array.isArray(lg.materials) 
            ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) 
            : [getInitialMaterial()],
          offerte: Array.isArray(lg.offerte) 
            ? lg.offerte.map(o => ({ ...o, id: Date.now() + Math.random() })) 
            : [getInitialOfferta()]
        })) 
      : [];
    setTimeLogs(initialLogs);
  };

  // Modifica un campo di un timelog
  const handleTimeLogChange = (logId, field, value) => {
    setTimeLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, [field]: value } : log
    ));
  };

  // Aggiungi un nuovo timelog
  const handleAddTimeLog = () => {
    setTimeLogs(prev => [...prev, getInitialTimeLog()]);
  };

  // Duplica un timelog
  const handleDuplicateTimeLog = (log) => {
    const newLog = { ...log, id: Date.now() + Math.random() };
    setTimeLogs(prev => [...prev, newLog]);
  };

  // Rimuovi un timelog
  const handleRemoveTimeLog = (logId) => {
    setTimeLogs(prev => prev.filter(log => log.id !== logId));
  };

  // Modifica un materiale
  const handleMaterialChange = (logId, materialId, field, value) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id !== logId) return log;

      const coerceValue = (fieldName, raw) => {
        if (fieldName === 'nome') return raw; // testo libero
        if (fieldName === 'quantita') return parseInt(raw) || 0;
        if (fieldName === 'costo') return parseFloat(raw) || 0;
        return raw;
      };

      return {
        ...log,
        materials: log.materials.map(m =>
          m.id === materialId ? { ...m, [field]: coerceValue(field, value) } : m
        )
      };
    }));
  };

  // Aggiungi un materiale
  const handleAddMaterial = (logId) => {
    setTimeLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, materials: [...log.materials, getInitialMaterial()] } : log
    ));
  };

  // Rimuovi un materiale
  const handleRemoveMaterial = (logId, materialId) => {
    setTimeLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, materials: log.materials.filter(m => m.id !== materialId) } : log
    ));
  };

  // Modifica un'offerta
  const handleOffertaChange = (logId, offertaId, field, value) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id !== logId) return log;

      const coerceValue = (fieldName, raw) => {
        if (fieldName === 'descrizione' || fieldName === 'numeroOfferta') return raw; // testo libero
        if (fieldName === 'qta') return parseInt(raw) || 0;
        if (fieldName === 'sconto') return parseFloat(raw) || 0;
        if (fieldName === 'totale') return parseFloat(raw) || 0;
        return raw;
      };

      const newOfferta = { ...log.offerte.find(o => o.id === offertaId), [field]: coerceValue(field, value) };
      
      // Calcola il totale automaticamente se qta o sconto cambiano
      if (field === 'qta' || field === 'sconto') {
        const qta = field === 'qta' ? coerceValue('qta', value) : newOfferta.qta;
        const sconto = field === 'sconto' ? coerceValue('sconto', value) : newOfferta.sconto;
        // Assumendo che il costo base sia 1€ per ora (puoi modificare questa logica)
        const costoBase = 1;
        newOfferta.totale = (costoBase * qta * (1 - sconto / 100));
      }

      return {
        ...log,
        offerte: log.offerte.map(o =>
          o.id === offertaId ? newOfferta : o
        )
      };
    }));
  };

  // Aggiungi un'offerta
  const handleAddOfferta = (logId) => {
    setTimeLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, offerte: [...log.offerte, getInitialOfferta()] } : log
    ));
  };

  // Rimuovi un'offerta
  const handleRemoveOfferta = (logId, offertaId) => {
    setTimeLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, offerte: log.offerte.filter(o => o.id !== offertaId) } : log
    ));
  };

  // Salva le modifiche ai timeLogs
  const handleSaveTimeLogs = async () => {
    if (!selectedTicket) {
      console.error('[SAVE-TIMELOGS] Nessun ticket selezionato');
      return;
    }
    
    console.log('[SAVE-TIMELOGS] Inizio salvataggio per ticket:', selectedTicket.id);
    
    try {
      const logsToSave = timeLogs.map(log => ({
        modalita: log.modalita,
        data: log.data,
        oraInizio: log.oraInizio,
        oraFine: log.oraFine,
        descrizione: log.descrizione,
        oreIntervento: parseFloat(log.oreIntervento) || 0,
        costoUnitario: parseFloat(log.costoUnitario) || 0,
        sconto: parseFloat(log.sconto) || 0,
        materials: log.materials.map(m => ({
          nome: m.nome,
          quantita: parseInt(m.quantita) || 1,
          costo: parseFloat(m.costo) || 0
        })),
        offerte: log.offerte.map(o => ({
          numeroOfferta: o.numeroOfferta,
          dataOfferta: o.dataOfferta,
          qta: parseInt(o.qta) || 1,
          sconto: parseFloat(o.sconto) || 0,
          totale: parseFloat(o.totale) || 0,
          descrizione: o.descrizione
        }))
      }));

      console.log('[SAVE-TIMELOGS] Dati da inviare:', logsToSave);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${selectedTicket.id}/timelogs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ timeLogs: logsToSave })
      });

      console.log('[SAVE-TIMELOGS] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SAVE-TIMELOGS] Errore dal server:', errorText);
        throw new Error('Errore nel salvare le modifiche');
      }

      const updatedTicket = await response.json();
      console.log('[SAVE-TIMELOGS] Ticket aggiornato dal server:', updatedTicket);

      // Aggiorna lo stato globale dei ticket
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      
      // Aggiorna i timeLogs nel modal
      const updatedLogs = Array.isArray(updatedTicket.timelogs) ? updatedTicket.timelogs : [];
      const refreshedLogs = updatedLogs.length > 0 ? updatedLogs.map(lg => ({ 
        ...lg, 
        id: Date.now() + Math.random(), 
        materials: Array.isArray(lg.materials) ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) : [getInitialMaterial()],
        offerte: Array.isArray(lg.offerte) ? lg.offerte.map(o => ({ ...o, id: Date.now() + Math.random() })) : [getInitialOfferta()]
      })) : [];
      setTimeLogs(refreshedLogs);
      
      console.log('[SAVE-TIMELOGS] ✅ Salvataggio completato');
      showNotification('Modifiche salvate con successo!', 'success');
    } catch (error) {
      console.error('[SAVE-TIMELOGS] ❌ Errore:', error);
      showNotification(error.message || 'Errore nel salvare le modifiche.', 'error');
    }
  };

  return {
    timeLogs,
    setTimeLogs,
    initializeTimeLogs,
    initializeTimeLogsForView,
    handleTimeLogChange,
    handleAddTimeLog,
    handleDuplicateTimeLog,
    handleRemoveTimeLog,
    handleMaterialChange,
    handleAddMaterial,
    handleRemoveMaterial,
    handleOffertaChange,
    handleAddOfferta,
    handleRemoveOfferta,
    handleSaveTimeLogs
  };
};
