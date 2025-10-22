// Configurazione Google Calendar API
export const GOOGLE_CONFIG = {
  CLIENT_ID: process.env.REACT_APP_GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
  PROJECT_ID: process.env.REACT_APP_GOOGLE_PROJECT_ID,
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
  SCOPES: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.calendarlist.readonly'
};

// Colori per priorità ticket
export const PRIORITY_COLORS = {
  'urgente': '11', // Rosso
  'alta': '6',     // Arancione  
  'media': '9',    // Blu
  'bassa': '8'     // Grigio
};

// Stati ticket da sincronizzare
export const SYNC_STATES = [
  'in_lavorazione',
  'risolto', 
  'chiuso',
  'inviato',
  'fatturato'
];