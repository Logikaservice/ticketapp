import { useState } from 'react';

export function useAuth(showNotification) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const login = async (loginData) => {
    // PUNTO DI CONTROLLO 2: Vediamo se la funzione viene chiamata e con quali dati.
    console.log('2. Funzione "login" nell\'hook ricevuta con:', loginData);

    if (!loginData || !loginData.email || !loginData.password) {
      showNotification('Inserisci email e password.', 'error');
      return false;
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Credenziali non valide' }));
        throw new Error(errorData.error || 'Errore del server');
      }

      const user = await response.json();
      setCurrentUser(user);
      setIsLoggedIn(true);
      showNotification('Benvenuto ' + user.nome + '!', 'success');
      return true;
    } catch (error) {
      console.error("Errore durante il login:", error);
      showNotification(error.message, 'error');
      return false;
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    // Potresti voler aggiungere una notifica anche qui
  };

  return {
    isLoggedIn,
    currentUser,
    login,
    logout
  };
}