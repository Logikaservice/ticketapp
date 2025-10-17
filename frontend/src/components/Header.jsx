// src/components/Header.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Plus, LogOut, Settings, Users, UserPlus, List } from 'lucide-react';
import ThemeToggle from './ThemeToggle'; // ← AGGIUNTO

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
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' // ← AGGIUNTO dark mode
    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'; // ← AGGIUNTO dark mode

  return (
    <div className="bg-white dark:bg-slate-800 border-b dark:border-gray-700 transition-colors duration-300"> {/* ← AGGIUNTO dark mode */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">Sistema Gestione Ticket</h1> {/* ← AGGIUNTO dark mode */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1"> {/* ← AGGIUNTO dark mode */}
              {/* --- CODICE CORRETTO --- */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleClasses}`}>
                {userRole}
              </span>
              {/* Controlla che currentUser esista prima di accedere alle sue proprietà */}
              <span className="ml-2">{currentUser?.nome} - {currentUser?.azienda}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* ═══════════════════════════════════════════════════════
                THEME TOGGLE BUTTON - AGGIUNTO QUI ← NUOVO!
                ═══════════════════════════════════════════════════════ */}
            <ThemeToggle />
            
            {currentUser?.ruolo === 'cliente' && (
              <button 
                onClick={openNewTicketModal} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" // ← AGGIUNTO transition
              >
                <Plus size={18} />
                Nuovo Ticket
              </button>
            )}
            
            {currentUser?.ruolo === 'tecnico' && (
              <>
                <button 
                  onClick={openNewTicketModal} 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" // ← AGGIUNTO transition
                >
                  <Plus size={18} />
                  Nuovo Ticket
                </button>
                
                {/* Menu Dropdown Clienti */}
                <div className="relative" ref={menuRef}>
                  <button 
                    onClick={() => setShowClientMenu(!showClientMenu)}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" // ← AGGIUNTO transition-colors
                    title="Gestione Clienti"
                  >
                    <Users size={18} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showClientMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 transition-colors"> {/* ← AGGIUNTO dark mode */}
                      <button
                        onClick={() => {
                          openNewClientModal();
                          setShowClientMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" // ← AGGIUNTO dark mode
                      >
                        <UserPlus size={18} className="text-green-600 dark:text-green-400" /> {/* ← AGGIUNTO dark mode */}
                        <div>
                          <div className="font-medium">Nuovo Cliente</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Crea un nuovo cliente</div> {/* ← AGGIUNTO dark mode */}
                        </div>
                      </button>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div> {/* ← AGGIUNTO dark mode */}
                      
                      <button
                        onClick={() => {
                          openManageClientsModal();
                          setShowClientMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" // ← AGGIUNTO dark mode
                      >
                        <List size={18} className="text-blue-600 dark:text-blue-400" /> {/* ← AGGIUNTO dark mode */}
                        <div>
                          <div className="font-medium">Gestisci Clienti</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Visualizza tutti i clienti</div> {/* ← AGGIUNTO dark mode */}
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            
            <button 
              onClick={openSettings} 
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" // ← AGGIUNTO dark mode
              title="Impostazioni"
            >
              <Settings size={18} />
            </button>
            
            <button 
              onClick={handleLogout} 
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" // ← AGGIUNTO dark mode
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
