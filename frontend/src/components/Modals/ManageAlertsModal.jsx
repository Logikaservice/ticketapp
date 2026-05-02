import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Calendar, Clock, Info, AlertCircle, AlertTriangle as AlertTriangleIcon, Image, Trash2, Sparkles, ChevronDown, ChevronRight, Crown, Building, Mail } from 'lucide-react';
import {
  getStoredTechHubAccent,
  HUB_PAGE_BG,
  HUB_SURFACE,
  hexToRgba,
  readableOnAccent,
  hubModalCssVars,
  HUB_MODAL_LABEL_CLS,
  HUB_MODAL_FIELD_CLS,
  HUB_MODAL_TEXTAREA_CLS
} from '../../utils/techHubAccent';

const ManageAlertsModal = ({ isOpen, onClose, users, onSave, onEdit, editingAlert, onRequestEmailConfirm }) => {
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

  // Quando priority diventa 'features', seleziona automaticamente tutti i clienti
  useEffect(() => {
    if (formData.priority === 'features' && selectedClients.length === 0) {
      // Seleziona tutti i clienti
      const allClients = users.filter(u => u.ruolo === 'cliente').map(u => u.id);
      setSelectedClients(allClients);
    }
  }, [formData.priority, users]);

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
      onClose();
    } else {
      // Per nuovi avvisi, mostra il modal di conferma email
      if (onRequestEmailConfirm) {
        onRequestEmailConfirm(alertData);
      } else {
        // Fallback se onRequestEmailConfirm non è disponibile
        onSave(alertData);
        onClose();
      }
    }
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

  const accentHex = getStoredTechHubAccent();

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[116] flex items-center justify-center bg-black/60 p-4"
      style={{ paddingTop: '3rem', paddingBottom: '3rem' }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] shadow-2xl"
        style={{ backgroundColor: HUB_PAGE_BG, ...hubModalCssVars(accentHex) }}
      >
        <div className="shrink-0 border-b border-white/[0.08] px-6 py-5" style={{ backgroundColor: HUB_SURFACE }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12"
                style={{ backgroundColor: hexToRgba(accentHex, 0.2), color: accentHex }}
              >
                <AlertTriangle size={24} aria-hidden className="shrink-0 md:h-[26px] md:w-[26px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white md:text-2xl">
                  {editingAlert ? 'Modifica Avviso' : 'Nuovo Avviso'}
                </h2>
                <p className="mt-0.5 text-sm text-white/55">
                  {editingAlert ? 'Modifica i dettagli dell\'avviso' : 'Crea un nuovo avviso per i clienti'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="shrink-0 rounded-lg bg-white/10 p-2 text-white ring-1 ring-white/15 transition hover:bg-white/16"
              aria-label="Chiudi"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-gray-100">
          <div>
            <label className={HUB_MODAL_LABEL_CLS}>
              Titolo Avviso <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={HUB_MODAL_FIELD_CLS}
              placeholder="Es: Manutenzione server programmata"
              required
            />
          </div>

          <div>
            <label className={HUB_MODAL_LABEL_CLS}>
              Descrizione <span className="text-red-400">*</span>
            </label>
            <textarea
              rows="4"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={HUB_MODAL_TEXTAREA_CLS}
              placeholder="Descrivi i dettagli dell'avviso in modo chiaro e completo..."
              required
            />
          </div>

          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Contenuto</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[
                { value: 'info', label: 'Informazione', icon: <Info size={20} />, color: 'text-sky-400', bgColor: 'bg-sky-600' },
                { value: 'warning', label: 'Avviso', icon: <AlertCircle size={20} />, color: 'text-amber-400', bgColor: 'bg-amber-600' },
                { value: 'danger', label: 'Critico', icon: <AlertTriangleIcon size={20} />, color: 'text-red-400', bgColor: 'bg-red-600' },
                { value: 'features', label: 'Nuove funzionalità', icon: <Sparkles size={20} />, color: 'text-emerald-400', bgColor: 'bg-emerald-600' }
              ].map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, priority: priority.value }))}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                    formData.priority === priority.value
                      ? `${priority.bgColor} border-white/25 text-white`
                      : 'border-white/[0.12] bg-black/[0.22] text-white/75 hover:border-white/25 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={formData.priority === priority.value ? 'text-white' : priority.color}>
                    {priority.icon}
                  </div>
                  <div
                    className={`text-center text-xs font-medium sm:text-sm ${
                      formData.priority === priority.value ? 'text-white' : 'text-white/80'
                    }`}
                  >
                    {priority.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Destinatari</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowClientSelector(!showClientSelector)}
                className={`${HUB_MODAL_FIELD_CLS} flex cursor-pointer items-center justify-between text-left`}
              >
                <span className={selectedClients.length === 0 ? 'text-gray-400' : 'text-gray-100'}>
                  {selectedClients.length === 0 
                    ? 'Seleziona clienti...' 
                    : selectedClients.length === users.filter(u => u.ruolo === 'cliente').length
                      ? 'Tutti i clienti'
                      : `${selectedClients.length} clienti selezionati`
                  }
                </span>
                <ChevronDown
                  size={20}
                  className={`text-white/45 transition-transform ${showClientSelector ? 'rotate-180' : ''}`}
                />
              </button>

              {showClientSelector && (
                <>
                  <div className="fixed inset-0 z-[115]" onClick={() => setShowClientSelector(false)} />
                  <div className="absolute z-[120] mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-white/[0.12] bg-[#1E1E1E] shadow-2xl">
                    {Object.keys(clientiPerAzienda).length === 0 ? (
                      <div className="p-4 text-center text-sm text-white/50">Nessun cliente disponibile</div>
                    ) : (
                      <>
                        {/* Opzione "Tutti i clienti" */}
                        <button
                          type="button"
                          onClick={() => handleClientToggle('all')}
                          className={`flex w-full items-center gap-3 border-b border-white/[0.08] px-4 py-2.5 text-left transition hover:bg-white/[0.06] ${
                            selectedClients.length === users.filter((u) => u.ruolo === 'cliente').length
                              ? 'border-l-2 border-l-[color:var(--hub-accent)] bg-white/[0.08]'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedClients.length === users.filter((u) => u.ruolo === 'cliente').length}
                            readOnly
                            className="rounded border-white/30 bg-black/40"
                          />
                          <span className="font-medium text-white">Tutti i clienti</span>
                        </button>

                        {Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                          const isExpanded = expandedCompanies.has(azienda);
                          const isNoCompany = azienda === 'Senza azienda';
                          
                          return (
                            <div key={azienda} className="border-b border-white/[0.06] last:border-b-0">
                              <button
                                type="button"
                                onClick={() => toggleCompany(azienda)}
                                className="flex w-full items-center justify-between bg-black/[0.2] px-3 py-2 text-left transition-all hover:bg-white/[0.06]"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <div
                                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-xs font-bold text-[color:var(--hub-accent)] ring-1 ring-white/15"
                                    style={{ backgroundColor: hexToRgba(accentHex, 0.12) }}
                                  >
                                    {isNoCompany ? <Building size={12} /> : azienda.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-bold text-white">
                                      {isNoCompany ? 'Senza azienda' : azienda}
                                    </h3>
                                    <p className="text-xs text-white/45">
                                      {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                                    </p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown size={16} className="flex-shrink-0 text-white/45" />
                                ) : (
                                  <ChevronRight size={16} className="flex-shrink-0 text-white/45" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="bg-black/[0.15]">
                                  {clientiAzienda.map((cliente) => {
                                    const isAdmin = isAdminOfCompany(cliente);
                                    const isSelected = selectedClients.includes(cliente.id);
                                    
                                    return (
                                      <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => handleClientToggle(cliente.id)}
                                        className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition hover:bg-white/[0.06] ${
                                          isSelected
                                            ? 'border-[color:var(--hub-accent)] bg-white/[0.08]'
                                            : 'border-transparent'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          readOnly
                                          className="rounded border-white/30 bg-black/40"
                                        />
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                                            {isAdmin && <Crown size={16} className="text-amber-400" />}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`text-sm font-medium ${isSelected ? 'text-[color:var(--hub-accent)]' : 'text-white'}`}
                                              >
                                                {cliente.nome} {cliente.cognome}
                                              </span>
                                            </div>
                                            {cliente.email && (
                                              <div className="mt-0.5 flex items-center gap-1">
                                                <Mail size={12} className="text-white/35" />
                                                <span className="truncate text-xs text-white/50">{cliente.email}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div
                                            className="h-2 w-2 flex-shrink-0 rounded-full"
                                            style={{ backgroundColor: accentHex }}
                                          />
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

          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Allegati (Foto)</label>
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-dashed border-white/[0.15] p-4 text-center transition hover:border-[color:var(--hub-accent-border)]">
                <input
                  type="file"
                  id="fileInput"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="fileInput"
                  className="flex cursor-pointer flex-col items-center gap-2 text-center text-gray-200"
                >
                  <Image className="h-8 w-8 text-gray-400" aria-hidden />
                  <span className="text-sm text-gray-100">Clicca per selezionare immagini (max 5)</span>
                  <span className="text-xs text-gray-400">JPG, PNG, GIF - Max 5MB per immagine</span>
                </label>
              </div>

              {/* File selezionati */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-200">Nuove immagini selezionate:</h4>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded border border-white/[0.08] bg-black/[0.25] p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-white/45" aria-hidden />
                        <span className="text-sm text-white/85">{file.name}</span>
                        <span className="text-xs text-white/45">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-400 hover:text-red-300"
                        aria-label="Rimuovi file"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Allegati esistenti (solo in modifica) */}
              {editingAlert && existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-200">Immagini esistenti:</h4>
                  {existingAttachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded border border-sky-500/30 bg-sky-500/10 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-sky-400" aria-hidden />
                        <span className="text-sm text-white/88">{attachment.originalName}</span>
                        <span className="text-xs text-white/45">
                          ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingAttachment(index)}
                        className="text-red-400 hover:text-red-300"
                        aria-label="Rimuovi allegato"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Durata Avviso</label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="permanent"
                  name="duration"
                  checked={formData.isPermanent}
                  onChange={() => setFormData((prev) => ({ ...prev, isPermanent: true }))}
                  className="h-4 w-4 accent-[color:var(--hub-accent)]"
                />
                <label htmlFor="permanent" className="flex items-center gap-2 text-sm text-gray-100">
                  <Clock className="h-4 w-4 text-gray-400" aria-hidden />
                  <span>Avviso permanente</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="radio"
                  id="temporary"
                  name="duration"
                  checked={!formData.isPermanent}
                  onChange={() => setFormData((prev) => ({ ...prev, isPermanent: false }))}
                  className="h-4 w-4 accent-[color:var(--hub-accent)]"
                />
                <label htmlFor="temporary" className="flex items-center gap-2 text-sm text-gray-100">
                  <Calendar className="h-4 w-4 text-gray-400" aria-hidden />
                  <span>Avviso temporaneo</span>
                </label>
                {!formData.isPermanent && (
                  <div className="ml-0 flex items-center gap-2 sm:ml-4">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.daysToExpire}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, daysToExpire: parseInt(e.target.value, 10) || 7 }))
                      }
                      className="w-20 rounded-lg border border-white/[0.12] bg-black/[0.28] px-2 py-1 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)]"
                    />
                    <span className="text-sm text-gray-400">giorni</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-b-2xl border-t border-white/[0.08] p-4" style={{ backgroundColor: HUB_SURFACE }}>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/[0.1] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.14]"
            >
              Annulla
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-110"
              style={{ backgroundColor: accentHex, color: readableOnAccent(accentHex) }}
            >
              <AlertTriangle size={18} aria-hidden />
              {editingAlert ? 'Salva Modifiche' : 'Crea Avviso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageAlertsModal;
