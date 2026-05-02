import React, { useState, useMemo } from 'react';
import { Edit2, Save, Trash2, Mail, Phone, Building, Lock, ChevronRight, ChevronDown, Crown, FolderOpen } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  getStoredTechHubAccent,
  HUB_MODAL_FIELD_CLS,
  HUB_MODAL_NOTICE_WARN,
  techHubAccentIconTileStyle
} from '../../utils/techHubAccent';
import {
  HubModalBackdrop,
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalSecondaryButton,
  HubModalPrimaryButton
} from './HubModalChrome';

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

  const accentHex = getStoredTechHubAccent();

  return (
    <HubModalBackdrop zClass="z-[118]">
      <HubModalInnerCard maxWidthClass="max-w-5xl" className="flex max-h-[90vh] flex-col overflow-hidden">
        <HubModalChromeHeader
          icon={Building}
          title="Gestione Clienti"
          subtitle={`${clienti.length} ${clienti.length === 1 ? 'cliente registrato' : 'clienti registrati'}`}
          onClose={onClose}
          compact
        />
        <HubModalBody className="p-4">
          {clienti.length === 0 ? (
            <div className="py-12 text-center">
              <Building size={64} className="mx-auto mb-4 text-white/25" />
              <p className="text-lg text-white/50">Nessun cliente registrato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                const isExpanded = expandedCompanies.has(azienda);
                const isNoCompany = azienda === 'Senza azienda';
                
                return (
                  <div key={azienda} className="overflow-hidden rounded-xl border border-white/10 shadow-sm">
                    {/* Header Azienda - Espandibile */}
                    <button
                      type="button"
                      onClick={() => toggleCompany(azienda)}
                      className="flex w-full items-center justify-between border-b border-white/10 bg-black/25 p-3 transition-all hover:bg-black/35"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                          style={techHubAccentIconTileStyle(accentHex)}
                        >
                          {isNoCompany ? <Building size={14} /> : azienda.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-bold text-white">
                            {isNoCompany ? 'Clienti senza azienda' : azienda}
                          </h3>
                          <p className="text-xs text-white/55">
                            {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown size={20} className="text-white/55" />
                        ) : (
                          <ChevronRight size={20} className="text-white/55" />
                        )}
                      </div>
                    </button>
                    
                    {/* Clienti dell'azienda - Espansi/Collassati */}
                    {isExpanded && (
                      <div className="space-y-2 bg-black/20 p-2">
                        {clientiAzienda.map((cliente) => (
                          <div
                            key={cliente.id}
                            className="ml-4 rounded-lg border border-white/10 bg-black/15 shadow-sm transition hover:border-white/15"
                          >
                            {editingId === cliente.id ? (
                              // Modalità Modifica
                              <div className="p-4">
                                {/* INTESTAZIONE CLIENTE (sempre visibile) */}
                                <div className="relative mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                                  <div
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                                    style={techHubAccentIconTileStyle(accentHex)}
                                  >
                                    {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-white">
                                      {cliente.nome} {cliente.cognome}
                                    </h4>
                                    <p className="text-xs text-white/55">{azienda}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowProjectsMenu(showProjectsMenu === cliente.id ? null : cliente.id);
                                      }}
                                      className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25"
                                      title="Gestisci progetti abilitati"
                                    >
                                      <FolderOpen size={16} />
                                      <span>Progetti</span>
                                    </button>
                                    <span className="rounded-full bg-[color:var(--hub-accent)]/20 px-2 py-0.5 text-xs font-semibold text-[color:var(--hub-accent)] ring-1 ring-[color:var(--hub-accent-border)]">
                                      In modifica
                                    </span>
                                  </div>
                                  
                                  {showProjectsMenu === cliente.id && (
                                    <div className="absolute right-0 top-full z-50 mt-2 min-w-[250px] rounded-lg border border-white/10 bg-[#1E1E1E] p-3 shadow-xl">
                                      <div className="mb-2 text-xs font-bold text-white/85">Progetti Abilitati</div>
                                      <div className="space-y-2">
                                        {availableProjects.map(project => {
                                          const isEnabled = (editData.enabled_projects || ['ticket']).includes(project.id);
                                          return (
                                            <label
                                              key={project.id}
                                              className="flex cursor-pointer items-start gap-2 rounded p-2 transition hover:bg-white/5"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={(e) => {
                                                  const currentProjects = editData.enabled_projects || ['ticket'];
                                                  let newProjects;
                                                  if (e.target.checked) {
                                                    newProjects = currentProjects.includes(project.id)
                                                      ? currentProjects
                                                      : [...currentProjects, project.id];
                                                  } else {
                                                    if (project.id === 'ticket' && currentProjects.length === 1) {
                                                      return;
                                                    }
                                                    newProjects = currentProjects.filter(p => p !== project.id);
                                                    if (newProjects.length === 0) {
                                                      newProjects = ['ticket'];
                                                    }
                                                  }
                                                  setEditData({ ...editData, enabled_projects: newProjects });
                                                }}
                                                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 accent-[color:var(--hub-accent)]"
                                              />
                                              <div className="flex-1">
                                                <div className="text-sm font-medium text-white">{project.name}</div>
                                                <div className="text-xs text-white/50">{project.description}</div>
                                              </div>
                                            </label>
                                          );
                                        })}
                                      </div>
                                      <div className="mt-3 border-t border-white/10 pt-2 text-xs text-white/45">
                                        Progetti selezionati: {(editData.enabled_projects || ['ticket']).join(', ')}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* FORM DI MODIFICA */}
                                <div className="mb-3">
                                  <label className="mb-1 block text-xs font-bold text-white/75">Azienda</label>
                                  <input
                                    type="text"
                                    value={editData.azienda}
                                    onChange={(e) => setEditData({ ...editData, azienda: e.target.value })}
                                    className={HUB_MODAL_FIELD_CLS}
                                  />
                                </div>

                                <div className="mb-3 grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-white/70">Nome</label>
                                    <input
                                      type="text"
                                      value={editData.nome}
                                      onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                                      className={HUB_MODAL_FIELD_CLS}
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-white/70">Cognome</label>
                                    <input
                                      type="text"
                                      value={editData.cognome}
                                      onChange={(e) => setEditData({ ...editData, cognome: e.target.value })}
                                      className={HUB_MODAL_FIELD_CLS}
                                    />
                                  </div>
                                </div>

                                <div className="mb-3 grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-white/70">Email</label>
                                    <input
                                      type="email"
                                      value={editData.email}
                                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                      className={HUB_MODAL_FIELD_CLS}
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-white/70">
                                      <Lock size={12} />
                                      Password
                                    </label>
                                    <input
                                      type="text"
                                      value={editData.password}
                                      onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                                      placeholder="Password del cliente"
                                      className={`${HUB_MODAL_FIELD_CLS} font-mono`}
                                    />
                                  </div>
                                </div>

                                <div className="mb-3">
                                  <label className="mb-1 block text-xs font-medium text-white/70">Telefono</label>
                                  <input
                                    type="tel"
                                    value={editData.telefono}
                                    onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                                    className={HUB_MODAL_FIELD_CLS}
                                  />
                                </div>
                                
                                <div className={`mb-3 p-3 ${HUB_MODAL_NOTICE_WARN}`}>
                                  <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editData.isAdmin || false}
                                      onChange={(e) => setEditData({ ...editData, isAdmin: e.target.checked })}
                                      className="h-4 w-4 rounded border-amber-400/40 bg-black/20 accent-amber-400"
                                    />
                                    <div className="flex items-center gap-2">
                                      <Crown size={16} className="text-amber-200" />
                                      <span className="text-xs font-medium text-amber-50">
                                        Cliente Amministratore per questa azienda
                                      </span>
                                    </div>
                                  </label>
                                  <p className="mt-1 ml-6 text-xs text-amber-100/90">
                                    L'amministratore riceverà email quando altri clienti dell'azienda creano ticket o quando cambia lo stato dei loro ticket.
                                  </p>
                                </div>
                                
                                <div className="flex justify-end gap-2">
                                  <HubModalSecondaryButton onClick={handleCancel}>Annulla</HubModalSecondaryButton>
                                  <HubModalPrimaryButton onClick={() => handleSave(cliente.id)}>
                                    <span className="flex items-center gap-1.5">
                                      <Save size={16} />
                                      Salva
                                    </span>
                                  </HubModalPrimaryButton>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <div
                                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                                      style={techHubAccentIconTileStyle(accentHex)}
                                    >
                                      {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="flex items-center gap-1 truncate text-sm font-bold text-white">
                                        {cliente.nome} {cliente.cognome}
                                        {isAdminOfCompany(cliente, azienda) && (
                                          <Crown size={14} className="flex-shrink-0 text-amber-400" title="Amministratore" />
                                        )}
                                      </h4>
                                      <p className="truncate text-xs text-white/55">{cliente.email || 'N/D'}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                                    <div className="flex flex-col gap-1 text-xs text-white/60">
                                      <div className="flex items-center gap-1">
                                        <Mail size={12} className="flex-shrink-0 text-[color:var(--hub-accent)]" />
                                        <span className="max-w-[180px] truncate">{cliente.email || 'N/D'}</span>
                                      </div>
                                      {cliente.telefono && (
                                        <div className="flex items-center gap-1">
                                          <Phone size={12} className="flex-shrink-0 text-[color:var(--hub-accent)]" />
                                          <span>{cliente.telefono}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEdit(cliente);
                                        }}
                                        className="rounded-lg p-1.5 text-sky-400 transition hover:bg-white/10"
                                        title="Modifica"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(cliente);
                                        }}
                                        className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/15"
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
        </HubModalBody>
        <HubModalChromeFooter className="items-center justify-between">
          <span className="text-xs text-white/55">
            Totale: {clienti.length} {clienti.length === 1 ? 'cliente' : 'clienti'}
          </span>
          <HubModalSecondaryButton onClick={onClose}>Chiudi</HubModalSecondaryButton>
        </HubModalChromeFooter>
      </HubModalInnerCard>
    </HubModalBackdrop>
  );
};

export default ManageClientsModal;
