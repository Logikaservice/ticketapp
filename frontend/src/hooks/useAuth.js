import { useState, useEffect } from 'react';

export const useAuth = (showNotification) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));

  // Verifica token al caricamento
  useEffect(() => {
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
          // Token valido, carica i dati completi dell'utente dal backend
          // (incluso admin_companies che non è nel token)
          loadCurrentUserData();
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

  // Carica i dati completi dell'utente dal backend (incluso admin_companies)
  const loadCurrentUserData = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        console.log('✅ Dati utente completi caricati (incluso admin_companies)');
      } else {
        // Se l'endpoint non esiste, usa i dati dal token come fallback
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const tokenData = JSON.parse(atob(tokenParts[1]));
          setCurrentUser({
            id: tokenData.id,
            email: tokenData.email,
            ruolo: tokenData.ruolo,
            nome: tokenData.nome,
            cognome: tokenData.cognome,
            telefono: tokenData.telefono,
            azienda: tokenData.azienda,
            admin_companies: [] // Default vuoto se non disponibile
          });
        }
      }
    } catch (error) {
      console.error('Errore caricamento dati utente:', error);
      // Fallback ai dati del token
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const tokenData = JSON.parse(atob(tokenParts[1]));
        setCurrentUser({
          id: tokenData.id,
          email: tokenData.email,
          ruolo: tokenData.ruolo,
          nome: tokenData.nome,
          cognome: tokenData.cognome,
          telefono: tokenData.telefono,
          azienda: tokenData.azienda,
          admin_companies: [] // Default vuoto se non disponibile
        });
      }
    }
  };

  const handleRefreshToken = async () => {
    if (!refreshToken) {
      handleLogout();
      return;
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem('authToken', data.token);
        console.log('🔄 Token rinnovato automaticamente');
        // Carica i dati completi dopo il refresh
        await loadCurrentUserData();
      } else {
        handleLogout();
      }
    } catch (error) {
      console.error('Errore rinnovo token:', error);
      handleLogout();
    }
  };

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) return showNotification('Inserisci email e password.', 'error');
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
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
      
      setCurrentUser(loginResponse.user);
      setIsLoggedIn(true);
      setLoginData({ email: '', password: '' });
      showNotification(`Benvenuto ${loginResponse.user.nome}!`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('openTicketId');
    showNotification('Disconnessione effettuata.', 'info');
  };

  // Funzione per ottenere l'header Authorization
  const getAuthHeader = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };


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
