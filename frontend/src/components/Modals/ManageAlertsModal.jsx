import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Users, Calendar, Clock } from 'lucide-react';

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
        setSelectedClients(editingAlert.clients || []);
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
      setSelectedClients(users.filter(u => u.ruolo === 'cliente').map(u => u.id));
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {editingAlert ? 'Modifica Avviso' : 'Nuovo Avviso'}
              </h2>
              <p className="text-sm text-gray-500">
                {editingAlert ? 'Modifica i dettagli dell\'avviso' : 'Crea un nuovo avviso per i clienti'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Titolo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titolo Avviso *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Inserisci il titolo dell'avviso"
              required
            />
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
              placeholder="Descrivi i dettagli dell'avviso..."
              required
            />
          </div>

          {/* Priorità */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priorità
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'info', label: 'Informazione', icon: '🔵' },
                { value: 'warning', label: 'Avviso', icon: '🟡' },
                { value: 'danger', label: 'Critico', icon: '🔴' }
              ].map(priority => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.value }))}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.priority === priority.value
                      ? getPriorityColor(priority.value)
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{priority.icon}</div>
                  <div className="text-sm font-medium">{priority.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Clienti */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destinatari
            </label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowClientSelector(!showClientSelector)}
                className="w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-between"
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
                <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
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
                  
                  {users.filter(u => u.ruolo === 'cliente').map(client => (
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
                        <span>{client.nome} {client.cognome}</span>
                        <span className="text-sm text-gray-500">({client.email})</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Durata */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Durata Avviso
            </label>
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
              </div>

              {!formData.isPermanent && (
                <div className="ml-7">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.daysToExpire}
                      onChange={(e) => setFormData(prev => ({ ...prev, daysToExpire: parseInt(e.target.value) || 7 }))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-600">giorni</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {editingAlert ? 'Salva Modifiche' : 'Crea Avviso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManageAlertsModal;
