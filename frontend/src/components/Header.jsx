import React from 'react';
import { Plus, LogOut, Settings, Users } from 'lucide-react';

const Header = ({ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings }) => (
  <div className="bg-white border-b">
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sistema Gestione Ticket</h1>
          <p className="text-sm text-gray-600 mt-1">
            <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (currentUser.ruolo === 'cliente' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')}>
              {currentUser.ruolo.toUpperCase()}
            </span>
            <span className="ml-2">{currentUser.nome} - {currentUser.azienda}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {currentUser.ruolo === 'cliente' && (
            <button 
              onClick={openNewTicketModal} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              Nuovo Ticket
            </button>
          )}
          
          {currentUser.ruolo === 'tecnico' && (
            <>
              <button 
                onClick={openNewTicketModal} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Nuovo Ticket
              </button>
              <button 
                onClick={openNewClientModal} 
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Users size={18} />
                Nuovo Cliente
              </button>
            </>
          )}
          
          <button 
            onClick={openSettings} 
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Settings size={18} />
          </button>
          
          <button 
            onClick={handleLogout} 
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default Header;