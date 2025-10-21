import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Users, Calendar, Clock, Info, AlertCircle, AlertTriangle as AlertTriangleIcon } from 'lucide-react';

const ManageAlertsModal = ({ isOpen, onClose, users, onSave, onEdit, editingAlert }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'warning',
    clients: [],
    isPermanent: true,
    daysToExpire: 7
  });

  const [selectedClients, setSelectedClients] = useState([]);
  const [showClientSelector, setShowClientSelector] = useState(false);

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
      }
    }
  }, [isOpen, editingAlert]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Titolo e descrizione sono obbligatori');
      return;
    }

    const alertData = {
      ...formData,
      clients: selectedClients,
      id: editingAlert?.id
    };

    if (editingAlert) {
      onEdit(alertData);
    } else {
      onSave(alertData);
    }
    onClose();
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
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'danger': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
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

          {/* Priorità */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'info', label: 'Informazione', icon: <Info size={20} />, color: 'text-blue-600' },
                { value: 'warning', label: 'Avviso', icon: <AlertCircle size={20} />, color: 'text-yellow-600' },
                { value: 'danger', label: 'Critico', icon: <AlertTriangleIcon size={20} />, color: 'text-red-600' }
              ].map(priority => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.value }))}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    formData.priority === priority.value
                      ? getPriorityColor(priority.value)
                      : 'border-gray-200 hover:border-gray-300'
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
            <div className="space-y-3 relative">
              <button
                type="button"
                onClick={() => setShowClientSelector(!showClientSelector)}
                className="w-full p-3 border rounded-lg hover:bg-gray-50 flex items-center justify-between focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>
                    {selectedClients.length === 0 
                      ? 'Seleziona clienti...' 
                      : selectedClients.length === users.filter(u => u.ruolo === 'cliente').length
                        ? 'Tutti i clienti'
                        : `${selectedClients.length} clienti selezionati`
                    }
                  </span>
                </div>
                <div className="text-gray-400">▼</div>
              </button>

              {showClientSelector && (
                <>
                  {/* Overlay per chiudere cliccando fuori */}
                  <div 
                    className="fixed inset-0 z-[55] bg-black/20" 
                    onClick={() => setShowClientSelector(false)}
                  />
                  <div className="fixed z-[60] bg-white border border-gray-200 rounded-lg shadow-2xl p-3 space-y-2 max-h-60 overflow-y-auto" 
                       style={{
                         top: '50%',
                         left: '50%',
                         transform: 'translate(-50%, -50%)',
                         width: '400px',
                         maxWidth: '90vw'
                       }}>
                  <button
                    type="button"
                    onClick={() => handleClientToggle('all')}
                    className={`w-full text-left p-2 rounded hover:bg-gray-50 ${
                      selectedClients.length === users.filter(u => u.ruolo === 'cliente').length
                        ? 'bg-blue-50 text-blue-700'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedClients.length === users.filter(u => u.ruolo === 'cliente').length}
                        readOnly
                        className="rounded"
                      />
                      <span className="font-medium">Tutti i clienti</span>
                    </div>
                  </button>
                  
                  {users.filter(u => u.ruolo === 'cliente').sort((a, b) => {
                    const aName = a.azienda || '';
                    const bName = b.azienda || '';
                    return aName.localeCompare(bName, 'it', { sensitivity: 'base' });
                  }).map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleClientToggle(client.id)}
                      className={`w-full text-left p-2 rounded hover:bg-gray-50 ${
                        selectedClients.includes(client.id) ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          readOnly
                          className="rounded"
                        />
                        <span className="font-medium">{client.azienda || 'Azienda non specificata'}</span>
                        <span className="text-sm text-gray-500">({client.nome} {client.cognome})</span>
                      </div>
                    </button>
                  ))}
                  </div>
                </>
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
