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
  quantita: 1,
  costo: 0.00
});

export const getInitialOfferta = () => ({
  id: Date.now() + Math.random(),
  dataOfferta: new Date().toISOString().substring(0, 10),
  qta: 1,
  sconto: 0,
  totale: 0,
  descrizione: ''
});

export const getInitialTimeLog = () => ({
  id: Date.now(),
  data: new Date().toISOString().substring(0, 10),
  oraInizio: '09:00',
  oraFine: '10:00',
  descrizione: '',
  modalita: 'Telefonica',
  materials: [getInitialMaterial()],
  offerte: [getInitialOfferta()],
  oreIntervento: 1.0,
  costoUnitario: 0,
  sconto: 0
});