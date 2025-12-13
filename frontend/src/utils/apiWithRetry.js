// Utility per gestire chiamate API con retry automatico per errori 502
// Implementa exponential backoff e gestione intelligente degli errori

/**
 * Esegue una chiamata API con retry automatico per errori 502 (Bad Gateway)
 * @param {string} url - URL da chiamare
 * @param {object} options - Opzioni fetch (headers, method, body, ecc.)
 * @param {object} retryConfig - Configurazione retry (maxRetries, backoffMs, onRetry)
 * @returns {Promise<Response>} - Risposta fetch
 */
export const fetchWithRetry = async (
  url,
  options = {},
  retryConfig = {}
) => {
  const {
    maxRetries = 3,
    backoffMs = [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
    onRetry = null, // Callback chiamato ad ogni retry
    silent502 = true, // Non loggare errori 502 (spam nella console)
    timeout = 30000 // Timeout per singola richiesta (30s)
  } = retryConfig;

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Crea AbortController per timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Se la risposta è OK, restituiscila
        if (response.ok) {
          return response;
        }

        // Gestione errori 502 (Bad Gateway) - backend non raggiungibile
        if (response.status === 502) {
          lastError = new Error(`502 Bad Gateway - Backend non raggiungibile (tentativo ${attempt + 1}/${maxRetries})`);
          
          // Non loggare ogni singolo errore 502 per evitare spam nella console
          if (!silent502 && attempt === 0) {
            console.warn(`⚠️ [API] Backend non raggiungibile (502) - tentativo ${attempt + 1}/${maxRetries}`);
          }

          // Se non è l'ultimo tentativo, fai retry
          if (attempt < maxRetries - 1) {
            const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
            
            if (onRetry) {
              onRetry(attempt + 1, maxRetries, delay);
            }

            // Aspetta prima del prossimo tentativo
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Ultimo tentativo fallito
          return response; // Restituisci la risposta anche se è 502
        }

        // Per altri errori HTTP (400, 401, 403, 500, ecc.), restituisci direttamente
        // Non fare retry per errori logici (non di rete)
        return response;

      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (error) {
      lastError = error;

      // Se è un errore di rete (timeout, connection refused, ecc.), fai retry
      const isNetworkError = 
        error.name === 'AbortError' ||
        error.name === 'TypeError' ||
        error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError');

      // Se non è un errore di rete o è l'ultimo tentativo, lancia l'errore
      if (!isNetworkError || attempt === maxRetries - 1) {
        if (!silent502 || attempt === maxRetries - 1) {
          console.error(`❌ [API] Errore dopo ${attempt + 1} tentativi:`, error.message || error);
        }
        throw error;
      }

      // Retry per errori di rete
      const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
      
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delay);
      }

      if (!silent502) {
        console.warn(`⚠️ [API] Errore di rete (tentativo ${attempt + 1}/${maxRetries}) - riprovo tra ${delay}ms...`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Non dovrebbe mai arrivare qui, ma per sicurezza
  throw lastError || new Error('Tutti i tentativi falliti');
};

/**
 * Wrapper per fetch che gestisce automaticamente JSON parsing e errori
 */
export const fetchJsonWithRetry = async (
  url,
  options = {},
  retryConfig = {}
) => {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }, retryConfig);

  // Se la risposta non è OK, restituisci comunque il risultato per gestione errori
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      data: null,
      error: response.status === 502 
        ? 'Backend non raggiungibile. Riprova più tardi.' 
        : `Errore HTTP ${response.status}`
    };
  }

  try {
    const data = await response.json();
    return {
      ok: true,
      status: response.status,
      data,
      error: null
    };
  } catch (jsonError) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      data: null,
      error: 'Errore parsing risposta JSON'
    };
  }
};

/**
 * Verifica se il backend è raggiungibile
 */
export const checkBackendHealth = async (apiBase = '') => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5s per health check

    const response = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
};

