import React, { useEffect } from 'react'; // Aggiunto useEffect
import AppNotification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { useAuth } from './hooks/useAuth';
import { useTickets } from './hooks/useTickets';

function useNotification() {
  const [notification, setNotification] = React.useState({ show: false, message: '', type: 'success' });
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(p => ({ ...p, show: false })), 4000);
  };
  return { notification, setNotification, showNotification };
}

export default function TicketApp() {
  const { notification, setNotification, showNotification } = useNotification();
  const { isLoggedIn, currentUser, login, logout } = useAuth(showNotification);
  const { tickets, selectedTicket, selectTicket, changeStatus, deleteTicket, resetTickets } = useTickets(currentUser, showNotification);
  
  const [users, setUsers] = React.useState([]);
  const [modalState, setModalState] = React.useState({ type: null, data: null });
  const [loginData, setLoginData] = React.useState({ email: '', password: '' });

  // ===== INIZIO DELLA CORREZIONE =====
  // Questo useEffect carica la lista degli utenti quando l'utente fa il login.
  // Era la logica mancante.
  useEffect(() => {
    const fetchUsers = async () => {
      // Carichiamo gli utenti solo se l'utente è loggato ed è un tecnico
      if (currentUser && currentUser.ruolo === 'tecnico') {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`);
          if (!response.ok) throw new Error('Errore di rete');
          const data = await response.json();
          setUsers(data);
        } catch (error) {
          showNotification('Impossibile caricare la lista utenti.', 'error');
        }
      }
    };

    fetchUsers();
  }, [currentUser, showNotification]); // Si attiva quando 'currentUser' cambia
  // ===== FINE DELLA CORREZIONE =====

  const openNewTicketModal = () => {
    setModalState({ type: 'newTicket', data: null });
  };

  const handleAutoFillLogin = (ruolo) => {
    if (ruolo === 'cliente') {
      setLoginData({ email: 'cliente@example.com', password: 'cliente123' });
    } else if (ruolo === 'tecnico') {
      setLoginData({ email: 'tecnico@example.com', password: 'tecnico123' });
    }
  };

  const handleLogout = () => {
    logout();
    resetTickets();
    setUsers([]);
    setModalState({ type: null, data: null });
  };

  const handleLogin = async () => {
    const success = await login(loginData);
    if (success) {
      setLoginData({ email: '', password: '' });
    }
  };
  
  if (!isLoggedIn) {
    return (
      <>
        <AppNotification notification={notification} setNotification={setNotification} />
        <LoginScreen 
          loginData={loginData}
          setLoginData={setLoginData}
          handleLogin={handleLogin}
          handleAutoFillLogin={handleAutoFillLogin} 
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNotification notification={notification} setNotification={setNotification} />
      
      <Header 
        currentUser={currentUser} 
        handleLogout={handleLogout}
        openNewTicketModal={openNewTicketModal} 
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <TicketListContainer
          currentUser={currentUser}
          tickets={tickets}
          users={users}
          selectedTicket={selectedTicket}
          handlers={{
            handleSelectTicket: selectTicket,
            handleChangeStatus: changeStatus,
            handleDeleteTicket: deleteTicket,
          }}
        />
      </main>
      <AllModals
        modalState={modalState}
        closeModal={() => setModalState({ type: null, data: null })}
        currentUser={currentUser}
        clientiAttivi={users.filter(u => u.ruolo === 'cliente')} // Passiamo anche i clienti attivi ai modali
        // ... altre props
      />
    </div>
  );
}