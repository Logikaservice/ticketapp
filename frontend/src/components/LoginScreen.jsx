import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import QuickRequestModal from './Modals/QuickRequestModal';

const LoginScreen = ({ loginData, setLoginData, handleLogin, onQuickRequest, existingClients = [] }) => {
  const [showQuickRequest, setShowQuickRequest] = useState(false);
  const [clients, setClients] = useState(existingClients);


  const handleQuickRequest = async (formData) => {
    if (onQuickRequest) {
      await onQuickRequest(formData);
    }
  };

  // Nascondi scrollbar quando si è nel login e assicura che lo sfondo copra tutto
  React.useEffect(() => {
    // Nascondi scrollbar
    const html = document.documentElement;
    const body = document.body;
    
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100vh';
    html.style.minHeight = '100vh';
    body.style.height = '100vh';
    body.style.minHeight = '100vh';
    body.style.width = '100vw';
    body.style.minWidth = '100vw';
    body.style.margin = '0';
    body.style.padding = '0';
    body.style.backgroundColor = 'transparent';
    html.style.backgroundColor = 'transparent';
    
    // Assicura che #root copra tutto
    const root = document.getElementById('root');
    if (root) {
      root.style.height = '100vh';
      root.style.minHeight = '100vh';
      root.style.width = '100vw';
      root.style.minWidth = '100vw';
      root.style.margin = '0';
      root.style.padding = '0';
      root.style.backgroundColor = 'transparent';
    }
    
    return () => {
      html.style.overflow = '';
      body.style.overflow = '';
      html.style.height = '';
      html.style.minHeight = '';
      body.style.height = '';
      body.style.minHeight = '';
      body.style.width = '';
      body.style.minWidth = '';
      body.style.margin = '';
      body.style.padding = '';
      body.style.backgroundColor = '';
      html.style.backgroundColor = '';
      if (root) {
        root.style.height = '';
        root.style.minHeight = '';
        root.style.width = '';
        root.style.minWidth = '';
        root.style.margin = '';
        root.style.padding = '';
        root.style.backgroundColor = '';
      }
    };
  }, []);

  return (
    <>
        {showQuickRequest && (
          <QuickRequestModal
            onClose={() => setShowQuickRequest(false)}
            onSubmit={handleQuickRequest}
            existingClients={clients}
          />
        )}
  <div 
    className="fixed bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center" 
    style={{ 
      overflow: 'hidden', 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      minWidth: '100vw',
      minHeight: '100vh',
      margin: 0,
      padding: '1rem',
      boxSizing: 'border-box',
      zIndex: 0
    }}
  >
    <div 
      className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 md:p-8 mx-auto" 
      style={{ 
        maxHeight: 'calc(100vh - 2rem)',
        margin: 'auto'
      }}
    >
      <div className="text-center mb-4 sm:mb-6">
        <div className="bg-blue-100 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
          <User size={24} className="sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl sm:text-2xl md:text-3xl font-bold">Sistema Ticketing</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Accedi per gestire i tuoi ticket</p>
      </div>
      
      <div className="space-y-3 sm:space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Email</label>
          <input
            type="email"
            value={loginData.email}
            onChange={(e) => setLoginData(prevData => ({ ...prevData, email: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Password</label>
          <input
            type="password"
            value={loginData.password}
            onChange={(e) => setLoginData(prevData => ({ ...prevData, password: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full py-2 sm:py-2.5 md:py-3 text-sm sm:text-base bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          Accedi
        </button>
      </div>
      
      {/* Pulsante Richiesta Assistenza Veloce */}
      <div className="mt-4 sm:mt-5 md:mt-6 text-center">
        <button
          onClick={() => setShowQuickRequest(true)}
          className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline transition"
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
