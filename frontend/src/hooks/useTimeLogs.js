// src/hooks/useTimeLogs.js

import { useState } from 'react';
import { getInitialMaterial, getInitialTimeLog, getInitialOfferta } from '../utils/helpers';

export const useTimeLogs = (selectedTicket, setTickets, setSelectedTicket, showNotification, getAuthHeader, googleCalendarSync, setModalState) => {
  const [timeLogs, setTimeLogs] = useState([]);

  // Inizializza timeLogs da un ticket
  const initializeTimeLogs = (ticket) => {
    const logs = Array.isArray(ticket.timelogs) ? ticket.timelogs : [];
    const initialLogs = logs.length > 0 
      ? logs.map(lg => ({ 
          ...lg, 
          id: Date.now() + Math.random(), 
          materials: Array.isArray(lg.materials) 
            ? lg.materials.map(m => ({ 
                ...m, 
                id: Date.now() + Math.random(), 
                quantita: parseInt(m.quantita) || 0,
                costo: parseFloat(m.costo) || 0
              })) 
            : [getInitialMaterial()],
          offerte: Array.isArray(lg.offerte) 
            ? lg.offerte.map(o => ({ ...o, id: Date.now() + Math.random() })) 
            : []
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
            ? lg.materials.map(m => ({ 
                ...m, 
                id: Date.now() + Math.random(),
                quantita: parseInt(m.quantita) || 0,
                costo: parseFloat(m.costo) || 0
              })) 
            : [getInitialMaterial()],
          offerte: Array.isArray(lg.offerte) 
            ? lg.offerte.map(o => ({ ...o, id: Date.now() + Math.random() })) 
            : []
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
        if (fieldName === 'costoUnitario') return parseFloat(raw) || 0;
        if (fieldName === 'sconto') return parseFloat(raw) || 0;
        if (fieldName === 'totale') return parseFloat(raw) || 0;
        return raw;
      };

      const newOfferta = { ...log.offerte.find(o => o.id === offertaId), [field]: coerceValue(field, value) };
      
      // Calcola il totale automaticamente quando cambiano qta, sconto o costoUnitario
      if (['qta', 'sconto', 'costoUnitario'].includes(field)) {
        const qta = field === 'qta' ? coerceValue('qta', value) : (parseInt(newOfferta.qta) || 0);
        const sconto = field === 'sconto' ? coerceValue('sconto', value) : (parseFloat(newOfferta.sconto) || 0);
        const costoUnit = field === 'costoUnitario' ? coerceValue('costoUnitario', value) : (parseFloat(newOfferta.costoUnitario) || 0);
        const costoScontato = costoUnit * (1 - sconto / 100);
        newOfferta.totale = (costoScontato * qta);
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
        oraInizio: log.eventoGiornaliero ? '' : log.oraInizio,
        oraFine: log.eventoGiornaliero ? '' : log.oraFine,
        eventoGiornaliero: !!log.eventoGiornaliero,
        descrizione: log.descrizione,
        oreIntervento: parseFloat(log.oreIntervento) || 0,
        costoUnitario: parseFloat(log.costoUnitario) || 0,
        sconto: parseFloat(log.sconto) || 0,
        materials: log.materials.map(m => ({
          nome: m.nome,
          quantita: parseInt(m.quantita) || 0,
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

      // Parsa timelogs se sono una stringa JSON
      let parsedTimelogs = updatedTicket.timelogs;
      if (typeof parsedTimelogs === 'string') {
        try {
          parsedTimelogs = JSON.parse(parsedTimelogs);
        } catch (e) {
          console.error('[SAVE-TIMELOGS] Errore parsing timelogs:', e);
          parsedTimelogs = [];
        }
      }
      if (!Array.isArray(parsedTimelogs)) {
        parsedTimelogs = [];
      }
      
      // Crea ticket con timelogs parsati per la sincronizzazione
      const ticketForSync = {
        ...updatedTicket,
        timelogs: parsedTimelogs
      };

      // Aggiorna lo stato globale dei ticket
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? ticketForSync : t));
      setSelectedTicket(ticketForSync);
      
      // Aggiorna i timeLogs nel modal
      const updatedLogs = Array.isArray(parsedTimelogs) ? parsedTimelogs : [];
      const refreshedLogs = updatedLogs.length > 0 ? updatedLogs.map(lg => ({ 
        ...lg, 
        id: Date.now() + Math.random(), 
        materials: Array.isArray(lg.materials) ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) : [getInitialMaterial()],
        offerte: Array.isArray(lg.offerte) ? lg.offerte.map(o => ({ ...o, id: Date.now() + Math.random() })) : []
      })) : [];
      setTimeLogs(refreshedLogs);
      
      // Mostra notifica e modal IMMEDIATAMENTE (non aspettare la sincronizzazione Google Calendar)
      showNotification('Modifiche salvate con successo!', 'success');
      
      // Mostra modal per chiedere se inviare la mail IMMEDIATAMENTE
      if (setModalState) {
        setModalState({ type: 'sendEmailConfirm', data: updatedTicket });
      }
      
      // Sincronizzazione Google Calendar in background (NON blocca l'interfaccia)
      // Sincronizza sempre, anche se non ci sono interventi (per rimuovere eventi eliminati)
      if (googleCalendarSync && typeof googleCalendarSync === 'function') {
        googleCalendarSync(ticketForSync, 'update').catch(e => {
          console.error('[SAVE-TIMELOGS] Errore sincronizzazione Google Calendar:', e);
        });
      }
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
