// File temporaneo per compatibilità con commit vecchi
// Questo file non dovrebbe essere necessario, ma Render sta usando un commit vecchio
// che cerca questo file. Una volta che Render si aggiorna all'ultimo commit,
// questo file può essere rimosso.

// getAuthHeader viene passato come prop dai componenti padre, non importato
export const getAuthHeader = () => {
  // Questa funzione non dovrebbe essere usata direttamente
  // getAuthHeader viene passato come prop
  console.warn('getAuthHeader non dovrebbe essere importato da utils/auth. Usa la prop invece.');
  return {};
};

// Forza deploy Render - commit 0581307
