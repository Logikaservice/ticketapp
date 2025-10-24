export const useClients = (showNotification, setUsers, setTickets, getAuthHeader) => {
  const handleCreateClient = async (newClientData, closeModal) => {
    if (!newClientData.email || !newClientData.password) {
      return showNotification('Email e password sono obbligatori.', 'error');
    }
    if (!newClientData.nome || !newClientData.cognome) {
      return showNotification('Nome e cognome sono obbligatori.', 'error');
    }
    if (!newClientData.azienda) {
      return showNotification('Il nome dell\'azienda è obbligatorio.', 'error');
    }
    
    const clienteDaCreare = {
      ...newClientData,
      ruolo: 'cliente'
    };
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(clienteDaCreare)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nella creazione del cliente');
      }
      
      const nuovoCliente = await response.json();
      setUsers(prev => [...prev, nuovoCliente]);
      closeModal();
      
      showNotification('Cliente creato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile creare il cliente.', 'error');
    }
  };

  const handleUpdateClient = async (id, updatedData) => {
    if (!id) return showNotification('ID cliente non valido.', 'error');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nell\'aggiornamento del cliente');
      }
      
      const clienteAggiornato = await response.json();
      setUsers(prev => prev.map(u => u.id === id ? clienteAggiornato : u));
      
      showNotification('Cliente aggiornato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile aggiornare il cliente.', 'error');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente? Tutti i suoi ticket verranno eliminati!')) {
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nell\'eliminazione del cliente');
      }
      
      setUsers(prev => prev.filter(u => u.id !== id));
      setTickets(prev => prev.filter(t => t.clienteid !== id));
      
      showNotification('Cliente eliminato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile eliminare il cliente.', 'error');
    }
  };

  return {
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient
  };
};