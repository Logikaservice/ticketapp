import { useState, useEffect } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

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
        console.log('🔄 Token rinnovato automaticamente');
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
      const response = await fetch(buildApiUrl('/api/login'), {
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
      
      // Salva sessionId se presente
      if (loginResponse.sessionId) {
        localStorage.setItem('sessionId', loginResponse.sessionId);
      }
      
      setCurrentUser(loginResponse.user);
      setIsLoggedIn(true);
      setLoginData({ email: '', password: '' });
      showNotification(`Benvenuto ${loginResponse.user.nome}!`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleLogout = async () => {
    // Chiama l'endpoint logout per registrare la disconnessione
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      try {
        await fetch(buildApiUrl('/api/logout'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      } catch (err) {
        console.error('Errore registrazione logout:', err);
      }
    }
    
    setIsLoggedIn(false);
    setCurrentUser(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('sessionId');
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
