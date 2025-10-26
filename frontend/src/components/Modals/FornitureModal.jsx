import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Trash2 } from 'lucide-react';

const FornitureModal = ({ ticket, onClose, onFornitureCountChange, currentUser, getAuthHeader }) => {
  const [forniture, setForniture] = useState([]);
  const [nuovoMateriale, setNuovoMateriale] = useState('');
  const [nuovaQuantita, setNuovaQuantita] = useState(1);
  const [nuovaNota, setNuovaNota] = useState('');
  const [loading, setLoading] = useState(true);

  console.log('🔍 DEBUG FORNITURE: FornitureModal renderizzato per ticket:', ticket?.id, ticket?.numero);

  useEffect(() => {
    fetchForniture();
  }, [ticket.id]);

  const fetchForniture = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`);
      if (response.ok) {
        const data = await response.json();
        setForniture(data);
        // Aggiorna il conteggio in tempo reale
        if (onFornitureCountChange) {
          onFornitureCountChange(ticket.id, data.length);
        }
      }
    } catch (err) {
      console.error('Errore nel caricare le forniture:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAggiungi = async () => {
    if (!nuovoMateriale.trim()) return;

    console.log('🔍 DEBUG FORNITURE: Tentativo di aggiungere fornitura');
    console.log('🔍 DEBUG FORNITURE: Ticket ID:', ticket.id);
    console.log('🔍 DEBUG FORNITURE: Materiale:', nuovoMateriale);
    console.log('🔍 DEBUG FORNITURE: Quantità:', nuovaQuantita);
    
    const authHeaders = getAuthHeader();
    console.log('🔍 DEBUG FORNITURE: Auth headers:', authHeaders);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ materiale: nuovoMateriale, quantita: nuovaQuantita, nota: nuovaNota })
      });

      console.log('🔍 DEBUG FORNITURE: Response status:', response.status);
      console.log('🔍 DEBUG FORNITURE: Response ok:', response.ok);

      if (response.ok) {
        const newFornitura = await response.json();
        console.log('🔍 DEBUG FORNITURE: Nuova fornitura creata:', newFornitura);
        
        const updatedForniture = [newFornitura, ...forniture];
        setForniture(updatedForniture);
        setNuovoMateriale('');
        setNuovaQuantita(1);
        setNuovaNota('');
        
        // Aggiorna il badge immediatamente
        if (onFornitureCountChange) {
          onFornitureCountChange(ticket.id, updatedForniture.length);
        }
        
        console.log('🔍 DEBUG FORNITURE: Fornitura aggiunta con successo');
      } else {
        const errorText = await response.text();
        console.error('🔍 DEBUG FORNITURE: Errore response:', response.status, errorText);
      }
    } catch (err) {
      console.error('🔍 DEBUG FORNITURE: Errore nell\'aggiungere la fornitura:', err);
    }
  };

  const handleRestituisci = async (fornituraId) => {
    if (!window.confirm('Confermi la restituzione di questo materiale?')) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/forniture/${fornituraId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        const updatedForniture = forniture.filter(f => f.id !== fornituraId);
        setForniture(updatedForniture);
        
        // Aggiorna il badge immediatamente
        if (onFornitureCountChange) {
          onFornitureCountChange(ticket.id, updatedForniture.length);
        }
      }
    } catch (err) {
      console.error('Errore nella restituzione:', err);
    }
  };

  const isTecnico = currentUser?.ruolo === 'tecnico';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 border-b pb-3">
          <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <Package size={24} />
            Forniture Temporanee
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg text-sm mb-6">
          Ticket: {ticket.numero} - {ticket.titolo}
        </div>

        {/* Form Aggiungi - SOLO PER TECNICO */}
        {isTecnico && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-bold mb-3">Aggiungi Fornitura</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={nuovoMateriale}
                  onChange={(e) => setNuovoMateriale(e.target.value)}
                  placeholder="Nome materiale"
                  className="flex-1 px-3 py-2 border rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleAggiungi()}
                />
                <input
                  type="number"
                  min="1"
                  value={nuovaQuantita}
                  onChange={(e) => setNuovaQuantita(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={handleAggiungi}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Aggiungi
                </button>
              </div>
              <input
                type="text"
                value={nuovaNota}
                onChange={(e) => setNuovaNota(e.target.value)}
                placeholder="Note aggiuntive (opzionale)"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Lista Forniture */}
        <div className="space-y-3">
          <h3 className="font-bold">Forniture Attive ({forniture.length})</h3>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Caricamento...</div>
          ) : forniture.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package size={48} className="mx-auto mb-2 opacity-30" />
              Nessuna fornitura temporanea
            </div>
          ) : (
            forniture.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50">
                <div className="flex-1">
                  <div className="font-semibold">{f.materiale}</div>
                  <div className="text-sm text-gray-500">
                    Quantità: {f.quantita} - Prestito: {new Date(f.data_prestito).toLocaleDateString('it-IT')}
                  </div>
                  {f.nota && (
                    <div className="text-sm text-blue-600 mt-1">
                      Note: {f.nota}
                    </div>
                  )}
                </div>
                {isTecnico && (
                  <button
                    onClick={() => handleRestituisci(f.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 text-sm"
                  >
                    <Trash2 size={16} />
                    Restituito
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pulsanti */}
        <div className="flex gap-3 pt-6 border-t mt-6">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default FornitureModal;
