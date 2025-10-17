// src/components/Header.jsx
// VERSIONE SICURA - SENZA THEME TOGGLE (per far ripartire il deploy)

import React, { useState, useRef, useEffect } from 'react';
import { Plus, LogOut, Settings, Users, UserPlus, List } from 'lucide-react';

const Header = ({ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal }) => {
  const [showClientMenu, setShowClientMenu] = useState(false);
  const menuRef = useRef(null);

  // Chiudi il menu quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowClientMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Versione sicura per visualizzare il ruolo
  const userRole = (currentUser?.ruolo || '').toUpperCase();
  const roleClasses = currentUser?.ruolo === 'cliente' 
    ? 'bg-blue-100 text-blue-800' 
    : 'bg-green-100 text-green-800';

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sistema Gestione Ticket</h1>
            <p className="text-sm text-gray-600 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleClasses}`}>
                {userRole}
              </span>
              <span className="ml-2">{currentUser?.nome} - {currentUser?.azienda}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {currentUser?.ruolo === 'cliente' && (
              <button 
                onClick={openNewTicketModal} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Nuovo Ticket
              </button>
            )}
            
            {currentUser?.ruolo === 'tecnico' && (
              <>
                <button 
                  onClick={openNewTicketModal} 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Nuovo Ticket
                </button>
                
                {/* Menu Dropdown Clienti */}
                <div className="relative" ref={menuRef}>
                  <button 
                    onClick={() => setShowClientMenu(!showClientMenu)}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    title="Gestione Clienti"
                  >
                    <Users size={18} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showClientMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                      <button
                        onClick={() => {
                          openNewClientModal();
                          setShowClientMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-green-50 transition"
                      >
                        <UserPlus size={18} className="text-green-600" />
                        <div>
                          <div className="font-medium">Nuovo Cliente</div>
                          <div className="text-xs text-gray-500">Crea un nuovo cliente</div>
                        </div>
                      </button>
                      
                      <div className="border-t border-gray-200 my-1"></div>
                      
                      <button
                        onClick={() => {
                          openManageClientsModal();
                          setShowClientMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-blue-50 transition"
                      >
                        <List size={18} className="text-blue-600" />
                        <div>
                          <div className="font-medium">Gestisci Clienti</div>
                          <div className="text-xs text-gray-500">Visualizza tutti i clienti</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            
            <button 
              onClick={openSettings} 
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Impostazioni"
            >
              <Settings size={18} />
            </button>
            
            <button 
              onClick={handleLogout} 
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
