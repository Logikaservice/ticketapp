import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Users, Calendar, Clock, Info, AlertCircle, AlertTriangle as AlertTriangleIcon, Image, Trash2, Sparkles, ChevronDown, ChevronRight, Crown, Building, Mail } from 'lucide-react';

const ManageAlertsModal = ({ isOpen, onClose, users, onSave, onEdit, editingAlert }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'warning',
    clients: [],
    isPermanent: true,
    daysToExpire: 7
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  const [selectedClients, setSelectedClients] = useState([]);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState(() => {
    // Aziende collassate di default (vuoto = tutte collassate)
    return new Set();
  });

  // Reset form when modal opens/closes or when editing
  useEffect(() => {
    if (isOpen) {
      if (editingAlert) {
        setFormData({
          title: editingAlert.title || '',
          description: editingAlert.body || '',
          priority: editingAlert.level || 'warning',
          clients: editingAlert.clients || [],
          isPermanent: editingAlert.isPermanent !== false,
          daysToExpire: editingAlert.daysToExpire || 7
        });
        setExistingAttachments(editingAlert.attachments || []);
        // Gestisci clienti come array o JSON
        const clients = editingAlert.clients;
        if (Array.isArray(clients)) {
          setSelectedClients(clients);
        } else if (typeof clients === 'string') {
          try {
            setSelectedClients(JSON.parse(clients));
          } catch {
            setSelectedClients([]);
          }
        } else {
          setSelectedClients([]);
        }
      } else {
        setFormData({
          title: '',
          description: '',
          priority: 'warning',
          clients: [],
          isPermanent: true,
          daysToExpire: 7
        });
        setSelectedClients([]);
        setSelectedFiles([]);
        setExistingAttachments([]);
      }
    }
  }, [isOpen, editingAlert]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      alert('Solo file immagine sono permessi');
    }
    
    if (selectedFiles.length + imageFiles.length > 5) {
      alert('Massimo 5 immagini per avviso');
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...imageFiles]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (index) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Titolo e descrizione sono obbligatori');
      return;
    }

    const alertData = {
      ...formData,
      clients: selectedClients,
      id: editingAlert?.id,
      files: selectedFiles,
      existingAttachments: existingAttachments
    };

    if (editingAlert) {
      onEdit(alertData);
    } else {
      onSave(alertData);
    }
    onClose();
  };

  // Helper per verificare se un cliente è admin della sua azienda
  const isAdminOfCompany = (cliente) => {
    if (!cliente.admin_companies || !Array.isArray(cliente.admin_companies)) return false;
    const azienda = cliente.azienda || '';
    return cliente.admin_companies.includes(azienda);
  };

  // Raggruppa clienti per azienda, con amministratori per primi
  const clientiPerAzienda = useMemo(() => {
    const clientiAttivi = users.filter(u => u.ruolo === 'cliente');
    const grouped = {};
    clientiAttivi.forEach(cliente => {
      const azienda = cliente.azienda || 'Senza azienda';
      if (!grouped[azienda]) {
        grouped[azienda] = [];
      }
      grouped[azienda].push(cliente);
    });
    
    // Ordina i clienti dentro ogni azienda: prima gli amministratori, poi gli altri
    Object.keys(grouped).forEach(azienda => {
      grouped[azienda].sort((a, b) => {
        const aIsAdmin = isAdminOfCompany(a);
        const bIsAdmin = isAdminOfCompany(b);
        
        // Prima gli amministratori
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        
        // Poi ordina per nome
        const nomeA = `${a.nome || ''} ${a.cognome || ''}`.trim().toLowerCase();
        const nomeB = `${b.nome || ''} ${b.cognome || ''}`.trim().toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
    });
    
    // Ordina le aziende alfabeticamente
    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === 'Senza azienda') return 1;
        if (b === 'Senza azienda') return -1;
        return a.toLowerCase().localeCompare(b.toLowerCase());
      })
      .reduce((acc, azienda) => {
        acc[azienda] = grouped[azienda];
        return acc;
      }, {});
  }, [users]);

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

  const handleClientToggle = (clientId) => {
    if (clientId === 'all') {
      // Se tutti sono selezionati, deseleziona tutti, altrimenti seleziona tutti
      const allClients = users.filter(u => u.ruolo === 'cliente').map(u => u.id);
      const allSelected = allClients.length === selectedClients.length && 
                         allClients.every(id => selectedClients.includes(id));
      
      if (allSelected) {
        setSelectedClients([]);
      } else {
        setSelectedClients(allClients);
      }
    } else {
      setSelectedClients(prev => 
        prev.includes(clientId) 
          ? prev.filter(id => id !== clientId)
          : [...prev, clientId]
      );
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'danger': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'features': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'danger': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      case 'features': return '✨';
      default: return '⚪';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {/* Header con lo stile viola sfumato */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle size={28} />
                {editingAlert ? 'Modifica Avviso' : 'Nuovo Avviso'}
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                {editingAlert ? 'Modifica i dettagli dell\'avviso' : 'Crea un nuovo avviso per i clienti'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Form per l'inserimento dei dati */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Titolo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Avviso <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Es: Manutenzione server programmata"
              required
            />
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione <span className="text-red-500">*</span></label>
            <textarea
              rows="4"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Descrivi i dettagli dell'avviso in modo chiaro e completo..."
              required
            />
          </div>

          {/* Contenuto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenuto</label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: 'info', label: 'Informazione', icon: <Info size={20} />, color: 'text-blue-600', bgColor: 'bg-blue-600' },
                { value: 'warning', label: 'Avviso', icon: <AlertCircle size={20} />, color: 'text-yellow-600', bgColor: 'bg-yellow-600' },
                { value: 'danger', label: 'Critico', icon: <AlertTriangleIcon size={20} />, color: 'text-red-600', bgColor: 'bg-red-600' },
                { value: 'features', label: 'Nuove funzionalità', icon: <Sparkles size={20} />, color: 'text-green-600', bgColor: 'bg-green-600' }
              ].map(priority => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.value }))}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    formData.priority === priority.value
                      ? `${priority.bgColor} border-gray-300 text-white`
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={formData.priority === priority.value ? 'text-white' : priority.color}>
                    {priority.icon}
                  </div>
                  <div className={`text-sm font-medium ${
                    formData.priority === priority.value ? 'text-white' : 'text-gray-700'
                  }`}>
                    {priority.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Clienti */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destinatari</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClientSelector(!showClientSelector)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-400 transition"
              >
                <span className={
                  selectedClients.length === 0 
                    ? 'text-gray-500' 
                    : 'text-gray-900'
                }>
                  {selectedClients.length === 0 
                    ? 'Seleziona clienti...' 
                    : selectedClients.length === users.filter(u => u.ruolo === 'cliente').length
                      ? 'Tutti i clienti'
                      : `${selectedClients.length} clienti selezionati`
                  }
                </span>
                <ChevronDown 
                  size={20} 
                  className={`text-gray-400 transition-transform ${showClientSelector ? 'rotate-180' : ''}`} 
                />
              </button>

              {showClientSelector && (
                <>
                  <div 
                    className="fixed inset-0 z-[55]" 
                    onClick={() => setShowClientSelector(false)}
                  />
                  <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                    {Object.keys(clientiPerAzienda).length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Nessun cliente disponibile
                      </div>
                    ) : (
                      <>
                        {/* Opzione "Tutti i clienti" */}
                        <button
                          type="button"
                          onClick={() => handleClientToggle('all')}
                          className={`w-full px-4 py-2.5 text-left hover:bg-purple-50 transition flex items-center gap-3 border-b border-gray-100 ${
                            selectedClients.length === users.filter(u => u.ruolo === 'cliente').length
                              ? 'bg-purple-50 border-purple-300' 
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedClients.length === users.filter(u => u.ruolo === 'cliente').length}
                            readOnly
                            className="rounded"
                          />
                          <span className="font-medium text-gray-900">Tutti i clienti</span>
                        </button>

                        {Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                          const isExpanded = expandedCompanies.has(azienda);
                          const isNoCompany = azienda === 'Senza azienda';
                          
                          return (
                            <div key={azienda} className="border-b border-gray-100 last:border-b-0">
                              {/* Header Azienda - Espandibile */}
                              <button
                                type="button"
                                onClick={() => toggleCompany(azienda)}
                                className="w-full px-3 py-2 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 transition-all flex items-center justify-between text-left"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-violet-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {isNoCompany ? <Building size={12} /> : azienda.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-800 truncate">
                                      {isNoCompany ? 'Senza azienda' : azienda}
                                    </h3>
                                    <p className="text-xs text-gray-600">
                                      {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                                    </p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                                )}
                              </button>
                              
                              {/* Clienti dell'azienda - Espansi/Collassati */}
                              {isExpanded && (
                                <div className="bg-gray-50">
                                  {clientiAzienda.map((cliente) => {
                                    const isAdmin = isAdminOfCompany(cliente);
                                    const isSelected = selectedClients.includes(cliente.id);
                                    
                                    return (
                                      <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => handleClientToggle(cliente.id)}
                                        className={`w-full px-4 py-2.5 text-left hover:bg-purple-50 transition flex items-center gap-3 border-l-2 ${
                                          isSelected 
                                            ? 'bg-purple-50 border-purple-500' 
                                            : 'border-transparent'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          readOnly
                                          className="rounded"
                                        />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          {/* Spazio fisso per la corona */}
                                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                            {isAdmin && (
                                              <Crown size={16} className="text-yellow-500" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className={`text-sm font-medium ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                                                {cliente.nome} {cliente.cognome}
                                              </span>
                                            </div>
                                            {cliente.email && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <Mail size={12} className="text-gray-400" />
                                                <span className="text-xs text-gray-600 truncate">
                                                  {cliente.email}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Allegati */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allegati (Foto)</label>
            <div className="space-y-3">
              {/* Input per selezionare file */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition">
                <input
                  type="file"
                  id="fileInput"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center gap-2">
                  <Image className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Clicca per selezionare immagini (max 5)
                  </span>
                  <span className="text-xs text-gray-400">
                    JPG, PNG, GIF - Max 5MB per immagine
                  </span>
                </label>
              </div>

              {/* File selezionati */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Nuove immagini selezionate:</h4>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Allegati esistenti (solo in modifica) */}
              {editingAlert && existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Immagini esistenti:</h4>
                  {existingAttachments.map((attachment, index) => (
                    <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-gray-700">{attachment.originalName}</span>
                        <span className="text-xs text-gray-500">
                          ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Durata */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durata Avviso</label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="permanent"
                  name="duration"
                  checked={formData.isPermanent}
                  onChange={() => setFormData(prev => ({ ...prev, isPermanent: true }))}
                  className="w-4 h-4"
                />
                <label htmlFor="permanent" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Avviso permanente</span>
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="temporary"
                  name="duration"
                  checked={!formData.isPermanent}
                  onChange={() => setFormData(prev => ({ ...prev, isPermanent: false }))}
                  className="w-4 h-4"
                />
                <label htmlFor="temporary" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Avviso temporaneo</span>
                </label>
                {!formData.isPermanent && (
                  <div className="flex items-center gap-2 ml-4">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.daysToExpire}
                      onChange={(e) => setFormData(prev => ({ ...prev, daysToExpire: parseInt(e.target.value) || 7 }))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">giorni</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer con i pulsanti */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <AlertTriangle size={18} />
              {editingAlert ? 'Salva Modifiche' : 'Crea Avviso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageAlertsModal;
