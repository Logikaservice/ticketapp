// File temporaneo per compatibilità
// getAuthHeader viene passato come prop dai componenti padre, non importato
export const getAuthHeader = () => {
  // Questa funzione non dovrebbe essere usata direttamente
  // getAuthHeader viene passato come prop
  console.warn('getAuthHeader non dovrebbe essere importato da utils/auth. Usa la prop invece.');
  return {};
};

