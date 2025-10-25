import React, { useState, useEffect } from 'react';
import { X, Send, User, Mail, Phone, Building, FileText, AlertTriangle } from 'lucide-react';

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

  // Carica i clienti direttamente nel modal
  useEffect(() => {
    const fetchClients = async () => {
      if (!process.env.REACT_APP_API_URL) return;
      
      try {
        const url = process.env.REACT_APP_API_URL + '/clients';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={28} />
            <h2 className="text-2xl font-bold">Richiesta Assistenza Veloce</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informazioni Personali */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User size={20} />
              Informazioni Personali
            </h3>
            
            {/* Email in alto su una riga separata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="esempio@azienda.com"
              />
            </div>
            
            {/* Nome e Cognome in grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cognome *
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Telefono su una riga separata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono
              </label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+39 123 456 7890"
              />
            </div>

            {/* Azienda su una riga separata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Azienda
                {aziendaLocked && (
                  <span className="text-xs text-blue-600 ml-2">
                    (Auto-rilevata)
                  </span>
                )}
              </label>
              <input
                type="text"
                name="azienda"
                value={formData.azienda}
                onChange={handleChange}
                readOnly={aziendaLocked}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  aziendaLocked 
                    ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-not-allowed' 
                    : 'border-gray-300'
                }`}
                placeholder="Nome dell'azienda"
              />
              {aziendaLocked && aziendaSource && (
                <p className="text-xs text-blue-600 mt-1">
                  {aziendaSource}
                </p>
              )}
            </div>
          </div>

          {/* Dettagli Richiesta */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={20} />
              Dettagli Richiesta
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titolo Richiesta *
              </label>
              <input
                type="text"
                name="titolo"
                value={formData.titolo}
                onChange={handleChange}
                required
                placeholder="Breve descrizione del problema"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione *
              </label>
              <textarea
                name="descrizione"
                value={formData.descrizione}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Descrivi il problema in dettaglio..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorità
              </label>
              <select
                name="priorita"
                value={formData.priorita}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Invio in corso...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Invia Richiesta
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickRequestModal;
