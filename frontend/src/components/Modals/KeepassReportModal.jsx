// Modale per segnalare problemi dalle credenziali KeePass
import React, { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, Info, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const KeepassReportModal = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  getAuthHeader,
  credentialData = null // Dati della credenziale (opzionale)
}) => {
  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    tipo: 'informazione',
    allegati: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Pre-compila la descrizione con i dati della credenziale (se forniti)
  useEffect(() => {
    if (isOpen && credentialData) {
      let descrizione = '📋 Dettagli credenziale:\n\n';
      
      if (credentialData.groupPath) {
        descrizione += `📁 Percorso: ${credentialData.groupPath}\n`;
      }
      if (credentialData.title) {
        descrizione += `🏷️ Titolo: ${credentialData.title}\n`;
      }
      if (credentialData.username) {
        descrizione += `👤 Username: ${credentialData.username}\n`;
      }
      if (credentialData.url) {
        descrizione += `🌐 URL: ${credentialData.url}\n`;
      }
      
      descrizione += '\n---\n\n';
      descrizione += 'Descrivi qui il problema riscontrato:\n';
      
      setFormData(prev => ({
        ...prev,
        descrizione: descrizione,
        titolo: credentialData.title ? `Problema con: ${credentialData.title}` : ''
      }));
    } else if (isOpen && !credentialData) {
      // Segnalazione generica (senza credenziale associata)
      setFormData({
        titolo: '',
        descrizione: 'Descrivi qui la tua segnalazione o richiesta:\n',
        tipo: 'informazione',
        allegati: []
      });
    }
  }, [isOpen, credentialData]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      allegati: [...prev.allegati, ...files]
    }));
    // Reset input per permettere di selezionare lo stesso file di nuovo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      allegati: prev.allegati.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.titolo.trim()) {
      setError('Il titolo è obbligatorio');
      return;
    }
    
    if (!formData.descrizione.trim()) {
      setError('La descrizione è obbligatoria');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const authHeader = getAuthHeader();
      
      // Crea FormData per inviare file
      const submitData = new FormData();
      submitData.append('titolo', formData.titolo);
      submitData.append('descrizione', formData.descrizione);
      submitData.append('tipo', formData.tipo);
      submitData.append('fonte', 'keepass'); // Indica che proviene dalla sezione KeePass
      
      // Aggiungi dati credenziale se presenti
      if (credentialData) {
        submitData.append('credenziale_titolo', credentialData.title || '');
        submitData.append('credenziale_username', credentialData.username || '');
        submitData.append('credenziale_url', credentialData.url || '');
        submitData.append('credenziale_path', credentialData.groupPath || '');
      }
      
      // Aggiungi allegati
      formData.allegati.forEach((file, index) => {
        submitData.append(`allegato_${index}`, file);
      });

      const response = await fetch(buildApiUrl('/api/keepass/report-issue'), {
        method: 'POST',
        headers: {
          ...authHeader,
          'x-user-id': currentUser?.id?.toString() || '',
          'x-user-role': currentUser?.ruolo || ''
          // Non impostare Content-Type, verrà impostato automaticamente con boundary
        },
        body: submitData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'invio della segnalazione');
      }

      const result = await response.json();
      alert(result.message || 'Segnalazione inviata con successo!');
      
      // Reset form e chiudi
      setFormData({
        titolo: '',
        descrizione: '',
        tipo: 'informazione',
        allegati: []
      });
      onClose();
    } catch (err) {
      console.error('Errore invio segnalazione:', err);
      setError(err.message || 'Errore durante l\'invio della segnalazione');
    } finally {
      setIsSaving(false);
    }
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'critico':
        return <AlertTriangle className="text-red-600" />;
      case 'avviso':
        return <AlertCircle className="text-yellow-600" />;
      default:
        return <Info className="text-blue-600" />;
    }
  };

  const getTipoColor = (tipo) => {
    switch (tipo) {
      case 'critico':
        return 'border-red-600 bg-red-50';
      case 'avviso':
        return 'border-yellow-600 bg-yellow-50';
      default:
        return 'border-blue-600 bg-blue-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle size={28} />
                {credentialData ? 'Segnala Problema Credenziale' : 'Segnalazione Generica'}
              </h2>
              <p className="text-red-100 text-sm mt-1">
                {credentialData 
                  ? 'Segnala un problema con questa credenziale al team tecnico'
                  : 'Invia una segnalazione o richiesta al team tecnico'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
              disabled={isSaving}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo di segnalazione *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'informazione', label: 'Informazione', icon: Info, color: 'blue' },
                  { value: 'avviso', label: 'Avviso', icon: AlertCircle, color: 'yellow' },
                  { value: 'critico', label: 'Critico', icon: AlertTriangle, color: 'red' }
                ].map(tipo => (
                  <button
                    key={tipo.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, tipo: tipo.value }))}
                    className={`
                      p-3 rounded-lg border-2 transition flex flex-col items-center gap-2
                      ${formData.tipo === tipo.value
                        ? `border-${tipo.color}-600 bg-${tipo.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <tipo.icon 
                      size={24} 
                      className={formData.tipo === tipo.value ? `text-${tipo.color}-600` : 'text-gray-400'}
                    />
                    <span className={`text-sm font-medium ${formData.tipo === tipo.value ? 'text-gray-900' : 'text-gray-600'}`}>
                      {tipo.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Titolo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titolo *
              </label>
              <input
                type="text"
                value={formData.titolo}
                onChange={(e) => setFormData(prev => ({ ...prev, titolo: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Breve descrizione del problema"
                required
                disabled={isSaving}
              />
            </div>

            {/* Descrizione */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione *
              </label>
              <textarea
                value={formData.descrizione}
                onChange={(e) => setFormData(prev => ({ ...prev, descrizione: e.target.value }))}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none font-mono text-sm"
                placeholder="Descrivi dettagliatamente il problema riscontrato"
                required
                disabled={isSaving}
              />
            </div>

            {/* Allegati */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allegati (opzionale)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isSaving}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition flex items-center justify-center gap-2 text-gray-600 hover:text-red-600"
                disabled={isSaving}
              >
                <Upload size={20} />
                Carica screenshot, log o altri file
              </button>
              
              {/* Lista allegati */}
              {formData.allegati.length > 0 && (
                <div className="mt-3 space-y-2">
                  {formData.allegati.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-2 p-1 text-red-600 hover:bg-red-100 rounded"
                        disabled={isSaving}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Errore */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            disabled={isSaving}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Invio in corso...
              </>
            ) : (
              <>
                <AlertTriangle size={18} />
                Invia Segnalazione
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeepassReportModal;
