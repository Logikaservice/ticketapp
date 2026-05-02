import React, { useState, useEffect, useRef } from 'react';
import { Send, User, FileText, AlertTriangle, Camera, Image as ImageIcon } from 'lucide-react';
import {
  HubModalScaffold,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton
} from './HubModalChrome';
import { HUB_MODAL_FIELD_CLS, HUB_MODAL_LABEL_CLS, HUB_MODAL_TEXTAREA_CLS } from '../../utils/techHubAccent';

const QuickRequestModal = ({ onClose, onSubmit, existingClients = [] }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    azienda: '',
    titolo: '',
    descrizione: '',
    priorita: 'media'
  });
  const [loading, setLoading] = useState(false);
  const [aziendaLocked, setAziendaLocked] = useState(false);
  const [aziendaSource, setAziendaSource] = useState('');
  const [clients, setClients] = useState(existingClients);
  const [photos, setPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [aziendaSuggestions, setAziendaSuggestions] = useState([]);
  const [showAziendaSuggestions, setShowAziendaSuggestions] = useState(false);

  // Carica i clienti direttamente nel modal
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const url = '/api/clients';
        const clientsResponse = await fetch(url);
        
        if (clientsResponse.ok) {
          const clients = await clientsResponse.json();
          setClients(clients);
        }
      } catch (error) {
        console.error('Errore caricamento clienti:', error);
      }
    };
    
    fetchClients();
  }, []); // Esegue al mount del modal

  // Funzione per estrarre il dominio da un'email
  const getEmailDomain = (email) => {
    if (!email || !email.includes('@')) return null;
    return email.split('@')[1]?.toLowerCase();
  };

  // Funzione per trovare un cliente esistente con lo stesso dominio
  const findClientByDomain = (email) => {
    const domain = getEmailDomain(email);
    if (!domain) return null;
    
    return clients.find(client => {
      const clientDomain = getEmailDomain(client.email);
      return clientDomain === domain;
    });
  };

  // Effetto per controllare l'email e bloccare l'azienda
  useEffect(() => {
    if (formData.email) {
      const existingClient = findClientByDomain(formData.email);
      
      if (existingClient) {
        // Blocca il campo azienda e imposta il valore
        setAziendaLocked(true);
        setAziendaSource(`Automaticamente rilevata da ${existingClient.email}`);
        setFormData(prev => ({
          ...prev,
          azienda: existingClient.azienda || existingClient.nome + ' ' + existingClient.cognome
        }));
      } else {
        // Sblocca il campo azienda
        setAziendaLocked(false);
        setAziendaSource('');
      }
    } else {
      // Se l'email è vuota, sblocca tutto
      setAziendaLocked(false);
      setAziendaSource('');
    }
  }, [formData.email, clients]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      alert('Solo file immagine sono permessi');
      return;
    }
    setPhotos(imageFiles);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData, photos);
      onClose();
    } catch (error) {
      console.error('Errore invio richiesta:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Suggerimenti Azienda: mostra suggerimenti solo da 5 caratteri in su
  useEffect(() => {
    const raw = (formData.azienda || '');
    const term = raw.toLowerCase();
    if (raw.length < 5) {
      setAziendaSuggestions([]);
      setShowAziendaSuggestions(false);
      return;
    }
    // Costruisci lista aziende uniche dai clienti
    const aziendeSet = new Set();
    const aziende = [];
    clients.forEach(c => {
      const az = (c.azienda || '').trim();
      if (az && !aziendeSet.has(az)) {
        aziendeSet.add(az);
        aziende.push(az);
      }
    });
    // Matching semplice: substring case-insensitive
    const matches = aziende.filter(az => az.toLowerCase().includes(term)).slice(0, 20);
    setAziendaSuggestions(matches);
    setShowAziendaSuggestions(matches.length > 0);
  }, [formData.azienda, clients]);

  const handlePickAzienda = (value) => {
    setFormData(prev => ({ ...prev, azienda: value }));
    setShowAziendaSuggestions(false);
  };

  return (
    <HubModalScaffold onBackdropClick={onClose} maxWidthClass="max-w-2xl" zClass="z-[118]">
      <HubModalChromeHeader icon={FileText} title="Richiesta Assistenza Veloce" onClose={onClose} compact />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {/* Informazioni Personali */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <User size={18} aria-hidden />
              Informazioni Personali
            </h3>
            
            {/* Email in alto su una riga separata */}
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={`${HUB_MODAL_FIELD_CLS} py-1.5 text-sm`}
                placeholder="esempio@azienda.com"
              />
              <p className="mt-0.5 text-xs text-white/45">
                Utilizzare la mail aziendale e non quella personale
              </p>
            </div>
            
            {/* Azienda subito sotto Email */}
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Azienda
                {aziendaLocked && (
                  <span className="ml-1 text-xs text-[color:var(--hub-accent)]">
                    (Auto-rilevata)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="azienda"
                  value={formData.azienda}
                  onChange={handleChange}
                  onBlur={() => setTimeout(() => setShowAziendaSuggestions(false), 150)}
                  readOnly={false}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)] ${
                    aziendaLocked 
                      ? 'cursor-not-allowed border border-[color:var(--hub-accent-border)] bg-black/25 text-white/75' 
                      : HUB_MODAL_FIELD_CLS
                  }`}
                  placeholder="Nome dell'azienda"
                />
                {showAziendaSuggestions && (
                  <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-white/10 bg-[#1e1e1e] shadow-lg">
                    {aziendaSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePickAzienda(sug)}
                        className="w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                        title={sug}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {aziendaLocked && aziendaSource && (
                <p className="mt-1 text-xs text-[color:var(--hub-accent)]">
                  {aziendaSource}
                </p>
              )}
            </div>

            {/* Nome e Cognome in grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                  Nome *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className={`${HUB_MODAL_FIELD_CLS} py-1.5 text-sm`}
                />
              </div>
              
              <div>
                <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                  Cognome *
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className={`${HUB_MODAL_FIELD_CLS} py-1.5 text-sm`}
                />
              </div>
            </div>

            {/* Telefono su una riga separata */}
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Telefono
              </label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className={`${HUB_MODAL_FIELD_CLS} py-1.5 text-sm`}
                placeholder="+39 123 456 7890"
              />
            </div>
            
          </div>

          {/* Dettagli Richiesta */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <AlertTriangle size={18} aria-hidden />
              Dettagli Richiesta
            </h3>
            
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Titolo Richiesta *
              </label>
              <input
                type="text"
                name="titolo"
                value={formData.titolo}
                onChange={handleChange}
                required
                placeholder="Breve descrizione del problema"
                className={`${HUB_MODAL_FIELD_CLS} py-1.5 text-sm`}
              />
            </div>

            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Descrizione *
              </label>
              <textarea
                name="descrizione"
                value={formData.descrizione}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Descrivi il problema in dettaglio..."
                className={`${HUB_MODAL_TEXTAREA_CLS} py-1.5 text-sm`}
              />
            </div>

            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Priorità
              </label>
              <select
                name="priorita"
                value={formData.priorita}
                onChange={handleChange}
                className={`${HUB_MODAL_FIELD_CLS} py-1.5 text-sm`}
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className={`${HUB_MODAL_LABEL_CLS} mb-0.5 text-xs`}>
                Foto (opzionale)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <HubModalSecondaryButton
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 py-1.5 text-sm"
              >
                <Camera size={16} aria-hidden />
                {photos.length > 0 ? `${photos.length} foto selezionate` : 'Seleziona foto'}
              </HubModalSecondaryButton>
              {photos.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                  {photos.map((photo, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1.5">
                      <ImageIcon size={14} className="text-white/55" aria-hidden />
                      <span className="flex-1 truncate text-xs text-white/78">{photo.name}</span>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <HubModalChromeFooter className="gap-2 border-t border-white/[0.08]">
          <HubModalSecondaryButton type="button" onClick={onClose} className="flex-1">
            Annulla
          </HubModalSecondaryButton>
          <HubModalPrimaryButton type="submit" disabled={loading} className="flex flex-1 items-center justify-center gap-2 disabled:opacity-50">
            {loading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                Invio in corso...
              </>
            ) : (
              <>
                <Send size={16} aria-hidden />
                Invia Richiesta
              </>
            )}
          </HubModalPrimaryButton>
        </HubModalChromeFooter>
      </form>
    </HubModalScaffold>
  );
};

export default QuickRequestModal;
