import React, { useState, useEffect } from 'react';
import Notification from './components/Notification';
import LoginScreen from './components/LoginScreen';

export default function TicketApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newTicketData, setNewTicketData] = useState({ 
    titolo: '', 
    descrizione: '', 
    categoria: 'assistenza', 
    priorita: 'media', 
    nomerichiedente: '' 
  });
  const [settingsData, setSettingsData] = useState({ 
    nome: '', 
    email: '', 
    vecchiaPassword: '', 
    nuovaPassword: '', 
    confermaNuovaPassword: '' 
  });
  const [newClientData, setNewClientData] = useState({ 
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [timeLogs, setTimeLogs] = useState([]);
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!process.env.REACT_APP_API_URL || !currentUser) return;

      try {
        const ticketsResponse = await fetch(process.env.REACT_APP_API_URL + '/api/tickets');
        if (!ticketsResponse.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsResponse.json();
        setTickets(ticketsData);

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users');
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData);
          }
        }
      } catch (error) {
        console.error("Errore nel caricare i dati:", error);
        showNotification(error.message, "error");
      }
    };

    if (isLoggedIn) {
      fetchData();
    }
  }, [isLoggedIn, currentUser]);

  const showNotification = (message, type) => {
    if (!type) type = 'success';
    setNotification({ show: true, message: message, type: type });
    setTimeout(() => setNotification(p => ({ ...p, show: false })), 4000);
  };

  const handleLogin = async () => {
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
      setLoginData({ email: '', password: '' });
      showNotification('Benvenuto ' + user.nome + '!', 'success');

    } catch (error) {
      console.error("Errore durante il login:", error);
      showNotification(error.message || 'Credenziali non valide o errore di rete.', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedTicket(null);
    setTickets([]);
    setUsers([]);
    setModalState({ type: null, data: null });
    showNotification('Disconnessione effettuata.', 'info');
  };

  const handleAutoFillLogin = (ruolo) => {
    if (ruolo === 'cliente') {
      setLoginData({ email: 'cliente@example.com', password: 'cliente123' });
    } else if (ruolo === 'tecnico') {
      setLoginData({ email: 'tecnico@example.com', password: 'tecnico123' });
    }
  };

  const handleSendMessage = (id, msg, isReclamo) => {
    if (!isReclamo) isReclamo = false;
    if (!msg.trim()) return;

    setTickets(prevTickets => prevTickets.map(t => {
      if (t.id === id) {
        const autore = currentUser.ruolo === 'cliente' ? t.nomerichiedente : 'Tecnico';
        const updatedTicket = {
          ...t,
          messaggi: [
            ...(t.messaggi || []),
            {
              id: (t.messaggi?.length || 0) + 1,
              autore: autore,
              contenuto: msg,
              data: new Date().toISOString(),
              reclamo: isReclamo
            }
          ],
          stato: isReclamo 
            ? 'in_lavorazione' 
            : (currentUser.ruolo === 'tecnico' && t.stato === 'risolto' ? 'in_lavorazione' : t.stato)
        };

        if (selectedTicket && selectedTicket.id === id) {
          setSelectedTicket(updatedTicket);
        }

        return updatedTicket;
      }
      return t;
    }));

    if (isReclamo) {
      showNotification('Reclamo inviato! Ticket riaperto.', 'error');
    }
  };

  const handleChangeStatus = async (id, status) => {
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });

      if (!response.ok) {
        throw new Error('Errore nell aggiornamento dello stato');
      }

      const updatedTicket = await response.json();

      setTickets(prevTickets =>
        prevTickets.map(t => (t.id === id ? updatedTicket : t))
      );

      showNotification('Stato del ticket aggiornato!', 'success');

      if (status === 'chiuso' || (status === 'risolto' && currentUser.ruolo === 'tecnico')) {
        setSelectedTicket(null);
      }

    } catch (error) {
      console.error('Errore handleChangeStatus:', error);
      showNotification('Impossibile aggiornare lo stato.', 'error');
    }
  };

  const handleDeleteTicket = (id) => {
    if (selectedTicket && selectedTicket.id === id) {
      setSelectedTicket(null);
    }
    setTickets(prevTickets => prevTickets.filter(t => t.id !== id));
    showNotification('Ticket eliminato.', 'error');
  };

  if (!isLoggedIn) {
    return (
      <>
        <Notification notification={notification} setNotification={setNotification} />
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
      <Notification notification={notification} setNotification={setNotification} />
      
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Sistema Gestione Ticket</h1>
              <p className="text-sm text-gray-600 mt-1">
                <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (currentUser.ruolo === 'cliente' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')}>
                  {currentUser.ruolo.toUpperCase()}
                </span>
                <span className="ml-2">{currentUser.nome} - {currentUser.azienda}</span>
              </p>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
          <p className="text-gray-600 mb-4">Benvenuto nel sistema di gestione ticket!</p>
          
          {tickets.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold mb-2">Tickets: {tickets.length}</h3>
              <div className="space-y-2">
                {tickets.slice(0, 5).map(ticket => (
                  <div key={ticket.id} className="p-3 bg-gray-50 rounded border">
                    <p className="font-semibold">{ticket.numero} - {ticket.titolo}</p>
                    <p className="text-sm text-gray-600">Stato: {ticket.stato}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-semibold">Sistema Funzionante</p>
            <p className="text-sm text-blue-600 mt-1">Connessione al backend stabilita. UI completa in arrivo.</p>
          </div>
        </div>
      </main>
    </div>
  );
}