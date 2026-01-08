import React, { useState, useMemo } from 'react';
import { X, Edit2, Save, Trash2, Mail, Phone, Building, Lock, ChevronRight, ChevronDown, Crown, FolderOpen } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const ManageClientsModal = ({ clienti, onClose, onUpdateClient, onDeleteClient, getAuthHeader }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [expandedCompanies, setExpandedCompanies] = useState(() => new Set());
  const [showProjectsMenu, setShowProjectsMenu] = useState(null); // ID del cliente per cui mostrare il menu
  
  // Lista progetti disponibili
  const availableProjects = [
    { id: 'ticket', name: 'Ticket', description: 'Sistema di gestione ticket' },
    { id: 'orari', name: 'Orari e Turni', description: 'Gestione orari e turni dipendenti' }
  ];

  // Raggruppa clienti per azienda
  const clientiPerAzienda = useMemo(() => {
    const grouped = {};
    clienti.forEach(cliente => {
      const azienda = cliente.azienda || 'Senza azienda';
      if (!grouped[azienda]) {
        grouped[azienda] = [];
      }
      grouped[azienda].push(cliente);
    });
    
    // Ordina i clienti dentro ogni azienda per nome
    Object.keys(grouped).forEach(azienda => {
      grouped[azienda].sort((a, b) => {
        const nomeA = `${a.nome || ''} ${a.cognome || ''}`.trim().toLowerCase();
        const nomeB = `${b.nome || ''} ${b.cognome || ''}`.trim().toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
    });
    
    // Ordina le aziende alfabeticamente
    return Object.keys(grouped)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .reduce((acc, azienda) => {
        acc[azienda] = grouped[azienda];
        return acc;
      }, {});
  }, [clienti]);

  const toggleCompany = (azienda) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(azienda)) {
        next.delete(azienda);
      } else {
        next.add(azienda);
      }
      return next;
    });
  };

  // Helper per verificare se un cliente è admin della sua azienda
  const isAdminOfCompany = (cliente, azienda) => {
    if (!cliente.admin_companies || !Array.isArray(cliente.admin_companies)) return false;
    return cliente.admin_companies.includes(azienda);
  };

  const handleStartEdit = async (cliente) => {
    setEditingId(cliente.id);
    // Gestisci enabled_projects: default ['ticket'] se non presente
    let enabledProjects = ['ticket'];
    if (cliente.enabled_projects) {
      if (Array.isArray(cliente.enabled_projects)) {
        enabledProjects = cliente.enabled_projects;
      } else if (typeof cliente.enabled_projects === 'string') {
        try {
          enabledProjects = JSON.parse(cliente.enabled_projects);
        } catch (e) {
          enabledProjects = ['ticket'];
        }
      }
    }
    
    // Se la password non è presente o è vuota, caricala dal backend
    let passwordToUse = cliente.password || '';
    if (!passwordToUse && getAuthHeader) {
      try {
        const response = await fetch(buildApiUrl(`/api/users/${cliente.id}`), {
          headers: getAuthHeader()
        });
        if (response.ok) {
          const userData = await response.json();
          passwordToUse = userData.password || '';
        }
      } catch (error) {
        console.error('Errore nel caricare la password:', error);
      }
    }
    
    setEditData({
      nome: cliente.nome || '',
      cognome: cliente.cognome || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      azienda: cliente.azienda || '',
      password: passwordToUse, // Password attuale editabile
      isAdmin: isAdminOfCompany(cliente, cliente.azienda || ''),
      admin_companies: cliente.admin_companies || [],
      enabled_projects: enabledProjects
    });
  };

  const handleSave = (id) => {
    const dataToSend = { ...editData };
    // Se la password è vuota, non la inviamo (mantiene quella attuale)
    if (!dataToSend.password || dataToSend.password.trim() === '') {
      delete dataToSend.password;
    }
    
    // Gestione admin_companies: se isAdmin è true, aggiungi l'azienda all'array, altrimenti rimuovila
    if (dataToSend.azienda) {
      const currentAdminCompanies = Array.isArray(dataToSend.admin_companies) ? [...dataToSend.admin_companies] : [];
      const aziendaCurrent = dataToSend.azienda.trim();
      
      if (dataToSend.isAdmin) {
        // Aggiungi l'azienda se non è già presente
        if (!currentAdminCompanies.includes(aziendaCurrent)) {
          currentAdminCompanies.push(aziendaCurrent);
        }
      } else {
        // Rimuovi l'azienda se è presente
        const index = currentAdminCompanies.indexOf(aziendaCurrent);
        if (index > -1) {
          currentAdminCompanies.splice(index, 1);
        }
      }
      
      dataToSend.admin_companies = currentAdminCompanies;
    }
    
    // Gestione enabled_projects: assicurati che sia un array valido
    if (dataToSend.enabled_projects) {
      if (!Array.isArray(dataToSend.enabled_projects) || dataToSend.enabled_projects.length === 0) {
        dataToSend.enabled_projects = ['ticket']; // Default se vuoto o non valido
      }
    } else {
      dataToSend.enabled_projects = ['ticket']; // Default se non presente
    }
    
    // Rimuovi isAdmin dal dataToSend (è solo per UI)
    delete dataToSend.isAdmin;
    
    onUpdateClient(id, dataToSend);
    setEditingId(null);
    setEditData({});
    setShowProjectsMenu(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
    setShowProjectsMenu(null);
  };

  const handleDelete = (cliente) => {
    onDeleteClient(cliente.id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Building size={24} />
                Gestione Clienti
              </h2>
              <p className="text-green-100 text-xs mt-0.5">
                {clienti.length} {clienti.length === 1 ? 'cliente registrato' : 'clienti registrati'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {clienti.length === 0 ? (
            <div className="text-center py-12">
              <Building size={64} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Nessun cliente registrato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                const isExpanded = expandedCompanies.has(azienda);
                const isNoCompany = azienda === 'Senza azienda';
                
                return (
                  <div key={azienda} className="border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Header Azienda - Espandibile */}
                    <button
                      onClick={() => toggleCompany(azienda)}
                      className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-all p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {isNoCompany ? <Building size={14} /> : azienda.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-800 truncate">
                            {isNoCompany ? 'Clienti senza azienda' : azienda}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown size={20} className="text-gray-600" />
                        ) : (
                          <ChevronRight size={20} className="text-gray-600" />
                        )}
                      </div>
                    </button>
                    
                    {/* Clienti dell'azienda - Espansi/Collassati */}
                    {isExpanded && (
                      <div className="bg-gray-50 space-y-2 p-2">
                        {clientiAzienda.map((cliente) => (
                          <div
                            key={cliente.id}
                            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition ml-4"
                          >
                            {editingId === cliente.id ? (
                              // Modalità Modifica
                              <div className="p-4">
                                {/* INTESTAZIONE CLIENTE (sempre visibile) */}
                                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 relative">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                                    {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-gray-800">
                                      {cliente.nome} {cliente.cognome}
                                    </h4>
                                    <p className="text-xs text-gray-600">
                                      {azienda}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Pulsante Progetti - A SINISTRA di "In modifica" */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowProjectsMenu(showProjectsMenu === cliente.id ? null : cliente.id);
                                      }}
                                      className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition flex items-center gap-1.5 border border-purple-300"
                                      title="Gestisci progetti abilitati"
                                    >
                                      <FolderOpen size={16} />
                                      <span>Progetti</span>
                                    </button>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                      In modifica
                                    </span>
                                  </div>
                                  
                                  {/* Menu Progetti Dropdown */}
                                  {showProjectsMenu === cliente.id && (
                                    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 min-w-[250px]">
                                      <div className="text-xs font-bold text-gray-700 mb-2">Progetti Abilitati</div>
                                      <div className="space-y-2">
                                        {availableProjects.map(project => {
                                          const isEnabled = (editData.enabled_projects || ['ticket']).includes(project.id);
                                          return (
                                            <label
                                              key={project.id}
                                              className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={(e) => {
                                                  const currentProjects = editData.enabled_projects || ['ticket'];
                                                  let newProjects;
                                                  if (e.target.checked) {
                                                    // Aggiungi progetto se non presente
                                                    newProjects = currentProjects.includes(project.id)
                                                      ? currentProjects
                                                      : [...currentProjects, project.id];
                                                  } else {
                                                    // Rimuovi progetto, ma mantieni almeno 'ticket'
                                                    if (project.id === 'ticket' && currentProjects.length === 1) {
                                                      // Non permettere di rimuovere l'ultimo progetto se è ticket
                                                      return;
                                                    }
                                                    newProjects = currentProjects.filter(p => p !== project.id);
                                                    // Se rimuovi tutto, mantieni almeno ticket
                                                    if (newProjects.length === 0) {
                                                      newProjects = ['ticket'];
                                                    }
                                                  }
                                                  setEditData({ ...editData, enabled_projects: newProjects });
                                                }}
                                                className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                              />
                                              <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-800">{project.name}</div>
                                                <div className="text-xs text-gray-500">{project.description}</div>
                                              </div>
                                            </label>
                                          );
                                        })}
                                      </div>
                                      <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                        Progetti selezionati: {(editData.enabled_projects || ['ticket']).join(', ')}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* FORM DI MODIFICA */}
                                {/* Azienda - Prima riga da sola */}
                                <div className="mb-3">
                                  <label className="block text-xs font-medium text-gray-700 mb-1 font-bold">
                                    Azienda
                                  </label>
                                  <input
                                    type="text"
                                    value={editData.azienda}
                                    onChange={(e) => setEditData({ ...editData, azienda: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  />
                                </div>

                                {/* Nome e Cognome - Seconda riga */}
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Nome
                                    </label>
                                    <input
                                      type="text"
                                      value={editData.nome}
                                      onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Cognome
                                    </label>
                                    <input
                                      type="text"
                                      value={editData.cognome}
                                      onChange={(e) => setEditData({ ...editData, cognome: e.target.value })}
                                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                  </div>
                                </div>

                                {/* Email e Password - Terza riga */}
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Email
                                    </label>
                                    <input
                                      type="email"
                                      value={editData.email}
                                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                                      <Lock size={12} />
                                      Password
                                    </label>
                                    <input
                                      type="text"
                                      value={editData.password}
                                      onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                                      placeholder="Password del cliente"
                                      className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                                    />
                                  </div>
                                </div>

                                {/* Telefono - Quarta riga */}
                                <div className="mb-3">
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Telefono
                                  </label>
                                  <input
                                    type="tel"
                                    value={editData.telefono}
                                    onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  />
                                </div>
                                
                                {/* Checkbox Cliente Amministratore */}
                                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editData.isAdmin || false}
                                      onChange={(e) => setEditData({ ...editData, isAdmin: e.target.checked })}
                                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                    />
                                    <div className="flex items-center gap-2">
                                      <Crown size={16} className="text-yellow-600" />
                                      <span className="text-xs font-medium text-gray-700">
                                        Cliente Amministratore per questa azienda
                                      </span>
                                    </div>
                                  </label>
                                  <p className="text-xs text-gray-500 mt-1 ml-6">
                                    L'amministratore riceverà email quando altri clienti dell'azienda creano ticket o quando cambia lo stato dei loro ticket.
                                  </p>
                                </div>
                                
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                  >
                                    Annulla
                                  </button>
                                  <button
                                    onClick={() => handleSave(cliente.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                  >
                                    <Save size={16} />
                                    Salva
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Modalità Visualizzazione - COMPATTA
                              <div className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                      {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-bold text-gray-800 truncate flex items-center gap-1">
                                        {cliente.nome} {cliente.cognome}
                                        {isAdminOfCompany(cliente, azienda) && (
                                          <Crown size={14} className="text-yellow-600 flex-shrink-0" title="Amministratore" />
                                        )}
                                      </h4>
                                      <p className="text-xs text-gray-600 truncate">
                                        {cliente.email || 'N/D'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                    <div className="flex flex-col gap-1 text-xs text-gray-600">
                                      <div className="flex items-center gap-1">
                                        <Mail size={12} className="text-green-600 flex-shrink-0" />
                                        <span className="truncate max-w-[180px]">{cliente.email || 'N/D'}</span>
                                      </div>
                                      {cliente.telefono && (
                                        <div className="flex items-center gap-1">
                                          <Phone size={12} className="text-green-600 flex-shrink-0" />
                                          <span>{cliente.telefono}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEdit(cliente);
                                        }}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="Modifica"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(cliente);
                                        }}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="Elimina"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-between items-center text-xs text-gray-600">
            <span>Totale: {clienti.length} {clienti.length === 1 ? 'cliente' : 'clienti'}</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageClientsModal;
