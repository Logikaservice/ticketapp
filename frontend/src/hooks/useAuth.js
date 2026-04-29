import { useState, useEffect, useCallback } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

export const useAuth = (showNotification) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));

  // Mantieni il token React sincronizzato quando viene aggiornato globalmente
  useEffect(() => {
    const handleTokenUpdated = (event) => {
      const updatedToken = event?.detail?.token;
      if (updatedToken) {
        setToken(updatedToken);
      }
    };

    window.addEventListener('auth-token-updated', handleTokenUpdated);
    return () => window.removeEventListener('auth-token-updated', handleTokenUpdated);
  }, []);

  // Verifica token al caricamento
  useEffect(() => {
    // Verifica se c'è un monitor autorizzato (bypass login per monitor)
    const monitorAuth = localStorage.getItem('packvision_monitor_auth');
    const monitorId = localStorage.getItem('packvision_monitor_id');
    if (monitorAuth === 'true' && monitorId) {
      // C'è un monitor autorizzato, bypassa il login creando un utente fittizio per monitor
      setCurrentUser({
        id: `monitor_${monitorId}`,
        email: `monitor${monitorId}@packvision.local`,
        ruolo: 'monitor',
        nome: `Monitor`,
        cognome: monitorId,
        telefono: null,
        azienda: null
      });
      setIsLoggedIn(true);
      return; // Non verificare il token JWT normale
    }

    if (token) {
      try {
        // Verifica se il token è valido
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          console.error('❌ Token JWT malformato');
          handleLogout();
          return;
        }

        const tokenData = JSON.parse(atob(tokenParts[1]));
        const now = Date.now() / 1000;

        if (tokenData.exp > now) {
          // Token valido, imposta l'utente
          setCurrentUser({
            id: tokenData.id,
            email: tokenData.email,
            ruolo: tokenData.ruolo,
            nome: tokenData.nome,
            cognome: tokenData.cognome,
            telefono: tokenData.telefono,
            azienda: tokenData.azienda
          });
          setIsLoggedIn(true);
        } else {
          // Token scaduto, prova a rinnovarlo
          handleRefreshToken();
        }
      } catch (error) {
        console.error('❌ Errore decodifica token:', error);
        handleLogout();
      }
    }
  }, []);

  const handleRefreshToken = async () => {
    if (!refreshToken) {
      handleLogout();
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/api/refresh-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
        window.dispatchEvent(new CustomEvent('auth-token-updated', { detail: { token: data.token } }));
        console.log('🔄 Token rinnovato automaticamente');
      } else {
        handleLogout();
      }
    } catch (error) {
      console.error('Errore rinnovo token:', error);
      handleLogout();
    }
  };

  const handleLogin = async (overrideEmail = null, overridePassword = null) => {
    // Usa i valori passati come parametri se disponibili, altrimenti usa lo state
    const email = overrideEmail !== null ? overrideEmail : loginData.email;
    const password = overridePassword !== null ? overridePassword : loginData.password;

    if (!email || !password) return showNotification('Inserisci email e password.', 'error');
    try {
      // Aggiungi il parametro domain se presente nell'URL o in localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const domainParam = urlParams.get('domain') || localStorage.getItem('requestedDomain');
      const loginUrl = domainParam
        ? `${buildApiUrl('/api/login')}?domain=${domainParam}`
        : buildApiUrl('/api/login');

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Credenziali non valide');
      }

      const loginResponse = await response.json();

      // Verifica che la risposta contenga i token
      if (!loginResponse.token || !loginResponse.refreshToken) {
        console.error('❌ Risposta login senza token');
        throw new Error('Risposta login non valida');
      }

      // Salva token e refresh token
      setToken(loginResponse.token);
      setRefreshToken(loginResponse.refreshToken);
      localStorage.setItem('authToken', loginResponse.token);
      localStorage.setItem('refreshToken', loginResponse.refreshToken);

      // Salva sessionId se presente
      if (loginResponse.sessionId) {
        localStorage.setItem('sessionId', loginResponse.sessionId);
        console.log('✅ [LOGIN] sessionId salvato:', loginResponse.sessionId);
      } else {
        console.warn('⚠️ [LOGIN] sessionId non presente nella risposta');
      }

      setCurrentUser(loginResponse.user);
      setIsLoggedIn(true);

      // NON svuotare i campi - lascia che il browser salvi le credenziali
      // Il browser Chrome richiede che i campi mantengano i valori per poter salvare
      // Svuoteremo i campi solo quando necessario (logout o nuovo login)
      // NOTA: I campi verranno comunque nascosti quando l'utente è loggato

      localStorage.removeItem('sessionExpiredReason');

      // Carica il timeout di inattività dal database; fallback per ruolo
      const dbTimeout = loginResponse.user.inactivity_timeout_minutes;
      if (dbTimeout !== undefined && dbTimeout !== null) {
        localStorage.setItem('inactivityTimeout', dbTimeout.toString());
      } else {
        const defaultTimeout = loginResponse.user.ruolo === 'tecnico' ? 30 : 3;
        localStorage.setItem('inactivityTimeout', defaultTimeout.toString());
      }

      showNotification(`Benvenuto ${loginResponse.user.nome}!`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleLogout = async () => {
    // Chiama l'endpoint logout per registrare la disconnessione
    const sessionId = localStorage.getItem('sessionId');
    console.log('🔍 [LOGOUT] sessionId trovato:', sessionId);

    if (sessionId) {
      try {
        console.log('🔍 [LOGOUT] Invio richiesta logout al backend...');
        const response = await fetch(buildApiUrl('/api/logout'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ sessionId })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ [LOGOUT] Logout registrato con successo:', data);
        } else {
          console.warn('⚠️ [LOGOUT] Risposta non OK:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('❌ [LOGOUT] Errore registrazione logout:', err);
      }
    } else {
      console.warn('⚠️ [LOGOUT] Nessun sessionId trovato in localStorage');
    }

    setIsLoggedIn(false);
    setCurrentUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('openTicketId');

    // Pulisci requestedDomain se non siamo su un dominio orari
    const hostname = window.location.hostname;
    const isOrariHostname = hostname === 'orari.logikaservice.it' ||
      hostname === 'turni.logikaservice.it' ||
      (hostname.includes('orari') && !hostname.includes('ticket')) ||
      (hostname.includes('turni') && !hostname.includes('ticket'));

    if (!isOrariHostname) {
      localStorage.removeItem('requestedDomain');
      console.log('🧹 Pulito requestedDomain da localStorage (logout da dominio ticket)');
    }

    showNotification('Disconnessione effettuata.', 'info');
  };

  // Funzione per ottenere l'header Authorization
  const getAuthHeader = useCallback(() => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, [token]);


  return {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    loginData,
    setLoginData,
    handleLogin,
    handleLogout,
    getAuthHeader,
    token
  };
};
