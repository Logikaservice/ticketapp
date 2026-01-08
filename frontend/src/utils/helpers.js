export const calculateDurationHours = (start, end) => {
  if (!start || !end) return 0;
  try {
    const startDate = new Date('1970-01-01T' + start);
    const endDate = new Date('1970-01-01T' + end);
    if (isNaN(startDate) || isNaN(endDate) || endDate <= startDate) return 0;
    return (endDate - startDate) / 3600000;
  } catch (err) {
    return 0;
  }
};

export const getInitialMaterial = () => ({
  id: Date.now() + Math.random(),
  nome: '',
  quantita: '',
  costo: ''
});

export const getInitialOfferta = () => ({
  id: Date.now() + Math.random(),
  numeroOfferta: '',
  dataOfferta: new Date().toISOString().substring(0, 10),
  qta: 1,
  costoUnitario: 0,
  sconto: 0,
  totale: 0,
  descrizione: '',
  allegati: []
});

// Normalizza un timelog per supportare timeIntervals (retrocompatibilità)
export const normalizeTimeLog = (log) => {
  // Se ha già timeIntervals, restituiscilo così com'è
  if (log.timeIntervals && Array.isArray(log.timeIntervals) && log.timeIntervals.length > 0) {
    return log;
  }
  
  // Altrimenti, converti oraInizio/oraFine in timeIntervals
  const intervals = [];
  if (log.oraInizio && log.oraFine) {
    intervals.push({
      id: Date.now(),
      start: log.oraInizio,
      end: log.oraFine
    });
  } else if (log.oraInizio || log.oraFine) {
    // Se ha solo uno dei due, crea comunque un intervallo
    intervals.push({
      id: Date.now(),
      start: log.oraInizio || '09:00',
      end: log.oraFine || '10:00'
    });
  }
  
  // Se non ha intervalli, crea uno vuoto
  if (intervals.length === 0) {
    intervals.push({
      id: Date.now(),
      start: '09:00',
      end: '10:00'
    });
  }
  
  return {
    ...log,
    timeIntervals: intervals
  };
};

// Calcola le ore totali da tutti gli intervalli
export const calculateTotalHoursFromIntervals = (intervals) => {
  if (!intervals || !Array.isArray(intervals)) return 0;
  
  let totalHours = 0;
  intervals.forEach(interval => {
    if (interval.start && interval.end) {
      totalHours += calculateDurationHours(interval.start, interval.end);
    }
  });
  
  return totalHours;
};

export const getInitialTimeLog = () => ({
  id: Date.now(),
  data: new Date().toISOString().substring(0, 10),
  timeIntervals: [{
    id: Date.now(),
    start: '09:00',
    end: '10:00'
  }],
  // Manteniamo oraInizio/oraFine per retrocompatibilità (saranno sincronizzati con il primo intervallo)
  oraInizio: '09:00',
  oraFine: '10:00',
  descrizione: '',
  modalita: 'Telefonica',
  eventoGiornaliero: false,
  materials: [getInitialMaterial()],
  offerte: [],
  oreIntervento: 1.0,
  costoUnitario: 0,
  sconto: 0
});