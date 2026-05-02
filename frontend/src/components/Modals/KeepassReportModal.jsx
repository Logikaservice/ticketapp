import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, Info, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalBackdrop,
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton
} from './HubModalChrome';
import { HUB_MODAL_LABEL_CLS, HUB_MODAL_FIELD_CLS, HUB_MODAL_TEXTAREA_CLS } from '../../utils/techHubAccent';

const TIPO_OPTIONS = [
  { value: 'informazione', label: 'Informazione', icon: Info, selectedCls: 'border-sky-500/55 bg-sky-500/12 ring-1 ring-sky-500/35', iconActive: 'text-sky-300', iconIdle: 'text-white/38', labelActive: 'text-white', labelIdle: 'text-white/65' },
  { value: 'avviso', label: 'Avviso', icon: AlertCircle, selectedCls: 'border-amber-500/55 bg-amber-500/12 ring-1 ring-amber-500/35', iconActive: 'text-amber-200', iconIdle: 'text-white/38', labelActive: 'text-white', labelIdle: 'text-white/65' },
  { value: 'critico', label: 'Critico', icon: AlertTriangle, selectedCls: 'border-red-500/55 bg-red-500/15 ring-1 ring-red-500/35', iconActive: 'text-red-200', iconIdle: 'text-white/38', labelActive: 'text-white', labelIdle: 'text-white/65' }
];

const KeepassReportModal = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  getAuthHeader,
  credentialData = null, // Dati della credenziale (opzionale)
  onReportCreated = null // Callback chiamato dopo la creazione della segnalazione
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
      
      // Ricarica gli avvisi se è stato fornito il callback
      if (onReportCreated) {
        onReportCreated();
      }
      
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

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <HubModalBackdrop zClass="z-[118]" className="overflow-y-auto py-8">
      <HubModalInnerCard maxWidthClass="max-w-2xl" className="my-auto flex max-h-[90vh] flex-col overflow-hidden">
        <HubModalChromeHeader
          icon={AlertTriangle}
          title={credentialData ? 'Segnala problema credenziale' : 'Segnalazione generica'}
          subtitle={
            credentialData
              ? 'Segnala un problema con questa credenziale al team tecnico'
              : 'Invia una segnalazione o richiesta al team tecnico'
          }
          onClose={isSaving ? undefined : onClose}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            {/* Tipo */}
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Tipo di segnalazione *</label>
              <div className="grid grid-cols-3 gap-3">
                {TIPO_OPTIONS.map((tipo) => {
                  const Icon = tipo.icon;
                  const sel = formData.tipo === tipo.value;
                  return (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipo: tipo.value }))}
                      disabled={isSaving}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition disabled:opacity-50 ${sel ? tipo.selectedCls : 'border-white/10 bg-black/15 hover:border-white/18'}`}
                    >
                      <Icon size={24} className={sel ? tipo.iconActive : tipo.iconIdle} aria-hidden />
                      <span className={`text-sm font-medium ${sel ? tipo.labelActive : tipo.labelIdle}`}>
                        {tipo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Titolo */}
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Titolo *</label>
              <input
                type="text"
                value={formData.titolo}
                onChange={(e) => setFormData(prev => ({ ...prev, titolo: e.target.value }))}
                className={HUB_MODAL_FIELD_CLS}
                placeholder="Breve descrizione del problema"
                required
                disabled={isSaving}
              />
            </div>

            {/* Descrizione */}
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Descrizione *</label>
              <textarea
                value={formData.descrizione}
                onChange={(e) => setFormData(prev => ({ ...prev, descrizione: e.target.value }))}
                rows={8}
                className={HUB_MODAL_TEXTAREA_CLS}
                placeholder="Descrivi dettagliatamente il problema riscontrato"
                required
                disabled={isSaving}
              />
            </div>

            {/* Allegati */}
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Allegati (opzionale)</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isSaving}
              />
              <HubModalSecondaryButton
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-white/18 py-3 hover:border-[color:var(--hub-accent-border)]"
              >
                <Upload size={20} aria-hidden />
                Carica screenshot, log o altri file
              </HubModalSecondaryButton>

              {formData.allegati.length > 0 && (
                <div className="mt-3 space-y-2">
                  {formData.allegati.map((file, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-2">
                      <span className="flex-1 truncate text-sm text-white/78">
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-2 rounded p-1 text-red-300 hover:bg-red-500/15"
                        disabled={isSaving}
                        aria-label="Rimuovi allegato"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-3 text-sm text-red-50">
                {error}
              </div>
            )}
          </div>

          <HubModalChromeFooter className="justify-end gap-3">
            <HubModalSecondaryButton type="button" onClick={onClose} disabled={isSaving}>
              Annulla
            </HubModalSecondaryButton>
            <HubModalPrimaryButton type="submit" disabled={isSaving} className="flex items-center gap-2 disabled:opacity-50">
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  Invio in corso...
                </>
              ) : (
                <>
                  <AlertTriangle size={18} aria-hidden />
                  Invia Segnalazione
                </>
              )}
            </HubModalPrimaryButton>
          </HubModalChromeFooter>
        </form>
      </HubModalInnerCard>
    </HubModalBackdrop>,
    document.body
  );
};

export default KeepassReportModal;
