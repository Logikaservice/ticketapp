// src/hooks/useAuth.js
import { useState } from 'react';

export function useAuth(showNotification) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const login = async (loginData) => {
    if (!loginData.email || !loginData.password) {
      return showNotification('Inserisci email e password.', 'error');
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Credenziali non valide' }));
        throw new Error(errorData.error);
      }

      const user = await response.json();
      setCurrentUser(user);
      setIsLoggedIn(true);
      showNotification('Benvenuto ' + user.nome + '!', 'success');
      return true; // Ritorna true in caso di successo
    } catch (error) {
      console.error("Errore durante il login:", error);
      showNotification(error.message || 'Credenziali non valide o errore di rete.', 'error');
      return false; // Ritorna false in caso di fallimento
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    showNotification('Disconnessione effettuata.', 'info');
  };

  // Esponiamo solo lo stato e le funzioni necessarie all'esterno
  return {
    isLoggedIn,
    currentUser,
    login,
    logout
  };
}