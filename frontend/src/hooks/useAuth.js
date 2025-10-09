import { useState } from 'react';

// Questo console.log ci serve ancora per il debug
console.log('API URL in uso:', process.env.REACT_APP_API_URL);

export function useAuth(showNotification) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const login = async (loginData) => {
    console.log('2. Funzione "login" nell\'hook ricevuta con:', loginData);

    if (!loginData || !loginData.email || !loginData.password) {
      showNotification('Inserisci email e password.', 'error');
      return false;
    }

    try {
      // ======================= MODIFICA QUESTA RIGA =======================
      // Sostituisci la stringa 'INCOLLA_QUI_L_URL_DEL_TUO_BACKEND' con l'URL che hai copiato al Passo 1.
      // ESEMPIO: const apiUrl = 'https://ticketapp-backend-xxxx.onrender.com';
      const apiUrl = 'https://ticketapp-4eqb.onrender.com';
      // ===================================================================

      const response = await fetch(apiUrl + '/api/login', {
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
  };

  return {
    isLoggedIn,
    currentUser,
    login,
    logout
  };
}