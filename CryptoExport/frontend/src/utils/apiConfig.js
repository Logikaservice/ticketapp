// Configurazione URL API
// Se REACT_APP_API_URL è vuoto o non definito, usa URL relativo (per nginx proxy)
// Altrimenti usa l'URL specificato
export const getApiUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL;
  
  // Se è vuoto, undefined, o null, usa stringa vuota (URL relativo)
  if (!apiUrl || apiUrl.trim() === '') {
    return '';
  }
  
  return apiUrl;
};

// Ottieni la base URL dell'API (senza endpoint)
export const getApiBase = () => {
  return getApiUrl();
};

// Helper per costruire URL API completi
export const buildApiUrl = (endpoint) => {
  const baseUrl = getApiUrl();
  // Rimuovi lo slash iniziale dall'endpoint se presente
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (!baseUrl) {
    // URL relativo - nginx farà il proxy
    return cleanEndpoint;
  }
  
  // Assicurati che baseUrl non finisca con /
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}${cleanEndpoint}`;
};

