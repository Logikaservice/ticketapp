// frontend/src/components/TelegramConfigSection.jsx
import React, { useState } from 'react';
import { MessageSquare, X, Save, Trash, Bell, BellOff, CheckCircle, AlertCircle, Edit, Send, TestTube } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const TelegramConfigSection = ({ 
  companies, 
  agents, 
  telegramConfigs, 
  loading, 
  onSave, 
  onDelete, 
  onClose,
  getAuthHeader 
}) => {
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    azienda_id: '',
    agent_id: '',
    bot_token: '',
    chat_id: '',
    enabled: true,
    notify_agent_offline: true,
    notify_ip_changes: true,
    notify_mac_changes: true,
    notify_status_changes: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const handleEdit = (config) => {
    setEditingConfig(config.id);
    setFormData({
      azienda_id: config.azienda_id || '',
      agent_id: config.agent_id || '',
      bot_token: config.bot_token || '',
      chat_id: config.chat_id || '',
      enabled: config.enabled !== false,
      notify_agent_offline: config.notify_agent_offline !== false,
      notify_ip_changes: config.notify_ip_changes !== false,
      notify_mac_changes: config.notify_mac_changes !== false,
      notify_status_changes: config.notify_status_changes !== false
    });
    setError(null);
    setSuccess(null);
  };

  const handleNew = () => {
    setEditingConfig('new');
    setFormData({
      azienda_id: '',
      agent_id: '',
      bot_token: '',
      chat_id: '',
      enabled: true,
      notify_agent_offline: true,
      notify_ip_changes: true,
      notify_mac_changes: true,
      notify_status_changes: true
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingConfig(null);
    setFormData({
      azienda_id: '',
      agent_id: '',
      bot_token: '',
      chat_id: '',
      enabled: true,
      notify_agent_offline: true,
      notify_ip_changes: true,
      notify_mac_changes: true,
      notify_status_changes: true
    });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.bot_token || !formData.chat_id) {
        throw new Error('Bot Token e Chat ID sono obbligatori');
      }

      await onSave(formData);
      setSuccess('Configurazione salvata con successo!');
      setTimeout(() => {
        setEditingConfig(null);
        setSuccess(null);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (configId) => {
    if (!window.confirm('Sei sicuro di voler rimuovere questa configurazione?')) {
      return;
    }

    try {
      await onDelete(configId);
      setSuccess('Configurazione rimossa con successo!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message || 'Errore durante la rimozione');
    }
  };

  const handleToggleEnabled = async (config) => {
    try {
      const updatedConfig = {
        ...config,
        enabled: !config.enabled
      };
      await onSave(updatedConfig);
      setSuccess(`Notifiche ${updatedConfig.enabled ? 'abilitate' : 'disabilitate'} con successo!`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message || 'Errore durante l\'aggiornamento');
    }
  };

  const getCompanyName = (aziendaId) => {
    if (!aziendaId) return 'Tutte le aziende';
    const company = companies.find(c => c.id === aziendaId);
    return company ? company.azienda : `Azienda #${aziendaId}`;
  };

  const getAgentName = (agentId) => {
    if (!agentId) return 'Tutti gli agent';
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.agent_name : `Agent #${agentId}`;
  };

  const handleTestNotification = async (configId, notificationType) => {
    setTesting(configId + '_' + notificationType);
    setTestResult(null);
    setError(null);
    
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/telegram/config/${configId}/test`), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_type: notificationType })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        // Se la risposta non è JSON valido, probabilmente è un errore 500 del server
        const text = await response.text();
        throw new Error(`Errore del server (${response.status}): ${text || 'Risposta non valida'}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || `Errore ${response.status} durante il test`);
      }

      setTestResult({
        success: true,
        type: notificationType,
        message: data.message || 'Notifica di test inviata con successo!'
      });
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    } catch (err) {
      console.error('Errore test notifica:', err);
      setTestResult({
        success: false,
        type: notificationType,
        message: err.message || 'Errore durante il test. Verifica che il backend sia aggiornato e che node-telegram-bot-api sia installato.'
      });
      setTimeout(() => {
        setTestResult(null);
      }, 8000);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="mb-6 bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Notifiche Telegram</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          title="Chiudi"
        >
          <X size={20} />
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {editingConfig && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            {editingConfig === 'new' ? 'Nuova Configurazione' : 'Modifica Configurazione'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Azienda (opzionale - lascia vuoto per tutte)
                </label>
                <select
                  value={formData.azienda_id}
                  onChange={(e) => setFormData({ ...formData, azienda_id: e.target.value || '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tutte le aziende</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.azienda}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agent (opzionale - lascia vuoto per tutti)
                </label>
                <select
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value || '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tutti gli agent</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.agent_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bot_token}
                  onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Ottieni da @BotFather su Telegram</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chat ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.chat_id}
                  onChange={(e) => setFormData({ ...formData, chat_id: e.target.value })}
                  placeholder="123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Ottieni inviando /start al bot e controllando getUpdates</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipi di Notifiche
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Abilita notifiche</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notify_agent_offline}
                    onChange={(e) => setFormData({ ...formData, notify_agent_offline: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Agent offline</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notify_ip_changes}
                    onChange={(e) => setFormData({ ...formData, notify_ip_changes: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Cambio IP (dispositivi statici)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notify_mac_changes}
                    onChange={(e) => setFormData({ ...formData, notify_mac_changes: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Cambio MAC (dispositivi statici)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notify_status_changes}
                    onChange={(e) => setFormData({ ...formData, notify_status_changes: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Online/Offline (dispositivi statici)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <MessageSquare size={18} />
          Nuova Configurazione
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Caricamento...</div>
      ) : telegramConfigs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nessuna configurazione Telegram. Clicca su "Nuova Configurazione" per aggiungerne una.
        </div>
      ) : (
        <div className="space-y-3">
          {telegramConfigs.map(config => (
            <div
              key={config.id}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={20} className="text-blue-600" />
                    <h3 className="font-semibold text-gray-800">
                      {getCompanyName(config.azienda_id)} - {getAgentName(config.agent_id)}
                    </h3>
                    {config.enabled ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                        <Bell size={12} />
                        Attivo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 flex items-center gap-1">
                        <BellOff size={12} />
                        Disabilitato
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Bot Token:</strong> {config.bot_token ? `${config.bot_token.substring(0, 20)}...` : 'N/A'}</p>
                    <p><strong>Chat ID:</strong> {config.chat_id || 'N/A'}</p>
                    <div className="mt-2">
                      <strong>Notifiche:</strong>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {config.notify_agent_offline && (
                          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Agent Offline</span>
                        )}
                        {config.notify_ip_changes && (
                          <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Cambio IP</span>
                        )}
                        {config.notify_mac_changes && (
                          <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">Cambio MAC</span>
                        )}
                        {config.notify_status_changes && (
                          <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Status</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleToggleEnabled(config)}
                    className={`p-2 rounded-lg transition-colors ${
                      config.enabled 
                        ? 'text-orange-600 hover:bg-orange-50' 
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={config.enabled ? 'Disabilita notifiche' : 'Abilita notifiche'}
                  >
                    {config.enabled ? <BellOff size={18} /> : <Bell size={18} />}
                  </button>
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Modifica configurazione"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Elimina"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
              
              {/* Pulsanti Test Notifiche */}
              {config.enabled && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TestTube size={16} className="text-purple-600" />
                    <span className="text-sm font-semibold text-gray-700">Test Notifiche:</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {config.notify_agent_offline && (
                      <button
                        onClick={() => handleTestNotification(config.id, 'agent_offline')}
                        disabled={testing === config.id + '_agent_offline'}
                        className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        title="Test notifica agent offline"
                      >
                        {testing === config.id + '_agent_offline' ? (
                          <>⏳ Invio...</>
                        ) : (
                          <>🔴 Agent Offline</>
                        )}
                      </button>
                    )}
                    {config.notify_ip_changes && (
                      <button
                        onClick={() => handleTestNotification(config.id, 'ip_changed')}
                        disabled={testing === config.id + '_ip_changed'}
                        className="px-3 py-2 text-xs bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        title="Test notifica cambio IP"
                      >
                        {testing === config.id + '_ip_changed' ? (
                          <>⏳ Invio...</>
                        ) : (
                          <>⚠️ Cambio IP</>
                        )}
                      </button>
                    )}
                    {config.notify_mac_changes && (
                      <button
                        onClick={() => handleTestNotification(config.id, 'mac_changed')}
                        disabled={testing === config.id + '_mac_changed'}
                        className="px-3 py-2 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        title="Test notifica cambio MAC"
                      >
                        {testing === config.id + '_mac_changed' ? (
                          <>⏳ Invio...</>
                        ) : (
                          <>⚠️ Cambio MAC</>
                        )}
                      </button>
                    )}
                    {config.notify_status_changes && (
                      <>
                        <button
                          onClick={() => handleTestNotification(config.id, 'status_changed_online')}
                          disabled={testing === config.id + '_status_changed_online'}
                          className="px-3 py-2 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          title="Test notifica dispositivo online"
                        >
                          {testing === config.id + '_status_changed_online' ? (
                            <>⏳ Invio...</>
                          ) : (
                            <>🟢 Online</>
                          )}
                        </button>
                        <button
                          onClick={() => handleTestNotification(config.id, 'status_changed_offline')}
                          disabled={testing === config.id + '_status_changed_offline'}
                          className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          title="Test notifica dispositivo offline"
                        >
                          {testing === config.id + '_status_changed_offline' ? (
                            <>⏳ Invio...</>
                          ) : (
                            <>🔴 Offline</>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                  {testResult && testResult.type && (
                    <div className={`mt-3 p-2 rounded-lg text-xs ${
                      testResult.success 
                        ? 'bg-green-100 text-green-700 border border-green-300' 
                        : 'bg-red-100 text-red-700 border border-red-300'
                    }`}>
                      {testResult.success ? '✅' : '❌'} {testResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TelegramConfigSection;
