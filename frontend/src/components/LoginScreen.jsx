import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import QuickRequestModal from './Modals/QuickRequestModal';

const LoginScreen = ({ loginData, setLoginData, handleLogin, onQuickRequest, existingClients = [] }) => {
  const [showQuickRequest, setShowQuickRequest] = useState(false);
  const [clients, setClients] = useState(existingClients);

  // Carica i clienti quando si apre il modal
  useEffect(() => {
    const fetchClients = async () => {
      console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Inizio caricamento clienti');
      console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - API_URL:', process.env.REACT_APP_API_URL);
      
      if (!process.env.REACT_APP_API_URL) {
        console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - API_URL non definita');
        return;
      }
      
      try {
        const url = process.env.REACT_APP_API_URL + '/api/users';
        console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - URL richiesta:', url);
        
        const usersResponse = await fetch(url);
        
        console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Response status:', usersResponse.status);
        console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Response ok:', usersResponse.ok);
        
        if (usersResponse.ok) {
          const allUsers = await usersResponse.json();
          console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Tutti gli utenti ricevuti:', allUsers);
          const clients = allUsers.filter(u => u.ruolo === 'cliente');
          console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Clienti filtrati:', clients);
          setClients(clients);
        } else {
          const errorText = await usersResponse.text();
          console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Errore response:', usersResponse.status, errorText);
        }
      } catch (error) {
        console.log('🔍 DEBUG AUTO-AZIENDA: LoginScreen - Errore caricamento clienti:', error);
      }
    };
    
    fetchClients();
  }, []); // Esegue al mount del LoginScreen

  const handleQuickRequest = async (formData) => {
    if (onQuickRequest) {
      await onQuickRequest(formData);
    }
  };

  return (
    <>
        {showQuickRequest && (
          <QuickRequestModal
            onClose={() => setShowQuickRequest(false)}
            onSubmit={handleQuickRequest}
            existingClients={clients}
          />
        )}
  <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
      <div className="text-center mb-8">
        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <User size={32} className="text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold">Sistema Ticketing</h1>
        <p className="text-gray-600">Accedi per gestire i tuoi ticket</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={loginData.email}
            onChange={(e) => setLoginData(prevData => ({ ...prevData, email: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            value={loginData.password}
            onChange={(e) => setLoginData(prevData => ({ ...prevData, password: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          Accedi
        </button>
      </div>
      
      {/* Pulsante Richiesta Assistenza Veloce */}
      <div className="mt-6 text-center">
        <button
          onClick={() => setShowQuickRequest(true)}
          className="text-sm text-blue-600 hover:text-blue-800 underline transition"
        >
          Richiesta Assistenza Veloce
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Invia una richiesta senza registrarti
        </p>
      </div>
    </div>
  </div>
    </>
  );
};

export default LoginScreen;
