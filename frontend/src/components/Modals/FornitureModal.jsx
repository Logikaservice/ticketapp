import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import { HUB_PAGE_BG, hubModalCssVars, getStoredTechHubAccent, HUB_MODAL_FIELD_CLS, HUB_MODAL_NOTICE_INFO } from '../../utils/techHubAccent';
import { HubModalBackdrop, HubModalChromeHeader, HubModalChromeFooter, HubModalSecondaryButton, HubModalPrimaryButton } from './HubModalChrome';

const FornitureModal = ({ ticket, onClose, onFornitureCountChange, currentUser, getAuthHeader }) => {
  const [forniture, setForniture] = useState([]);
  const [nuovoMateriale, setNuovoMateriale] = useState('');
  const [nuovaQuantita, setNuovaQuantita] = useState(1);
  const [nuovaNota, setNuovaNota] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editMateriale, setEditMateriale] = useState('');
  const [editQuantita, setEditQuantita] = useState(1);
  const [editNota, setEditNota] = useState('');

  const accentHex = getStoredTechHubAccent();

  useEffect(() => {
    fetchForniture();
  }, [ticket.id]);

  const fetchForniture = async () => {
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${ticket.id}/forniture`), {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setForniture(data);
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

    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${ticket.id}/forniture`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ materiale: nuovoMateriale, quantita: nuovaQuantita, nota: nuovaNota })
      });

      if (response.ok) {
        const newFornitura = await response.json();

        const updatedForniture = [newFornitura, ...forniture];
        setForniture(updatedForniture);
        setNuovoMateriale('');
        setNuovaQuantita(1);
        setNuovaNota('');

        if (onFornitureCountChange) {
          onFornitureCountChange(ticket.id, updatedForniture.length);
        }
      }
    } catch (err) {
      console.error("Errore nell'aggiungere la fornitura:", err);
    }
  };

  const handleRestituisci = async (fornituraId) => {
    if (!window.confirm('Confermi la restituzione di questo materiale?')) return;

    try {
      const response = await fetch(buildApiUrl(`/api/tickets/forniture/${fornituraId}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        const updatedForniture = forniture.filter((f) => f.id !== fornituraId);
        setForniture(updatedForniture);

        if (onFornitureCountChange) {
          onFornitureCountChange(ticket.id, updatedForniture.length);
        }
      }
    } catch (err) {
      console.error('Errore nella restituzione:', err);
    }
  };

  const handleModifica = (f) => {
    setEditingId(f.id);
    setEditMateriale(f.materiale || '');
    setEditQuantita(f.quantita || 1);
    setEditNota(f.nota || '');
  };

  const handleAnnullaModifica = () => {
    setEditingId(null);
    setEditMateriale('');
    setEditQuantita(1);
    setEditNota('');
  };

  const handleSalvaModifica = async () => {
    if (!editMateriale.trim()) return;
    if (!editingId) return;

    try {
      const response = await fetch(buildApiUrl(`/api/tickets/forniture/${editingId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ materiale: editMateriale, quantita: editQuantita, nota: editNota })
      });

      if (response.ok) {
        const updated = await response.json();
        setForniture((prev) => prev.map((f) => (f.id === editingId ? updated : f)));
        handleAnnullaModifica();
      }
    } catch (err) {
      console.error('Errore nella modifica:', err);
    }
  };

  const isTecnico = currentUser?.ruolo === 'tecnico';

  return (
    <HubModalBackdrop zClass="z-[118]">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/[0.1] shadow-2xl"
        style={{ backgroundColor: HUB_PAGE_BG, ...hubModalCssVars(accentHex) }}
      >
        <HubModalChromeHeader icon={Package} title="Forniture Temporanee" onClose={onClose} compact />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-white">
          <div className={HUB_MODAL_NOTICE_INFO}>
            Ticket: <strong>{ticket.numero}</strong> — {ticket.titolo}
          </div>

          {isTecnico && (
            <div className="rounded-lg border border-white/[0.12] bg-black/[0.22] p-4">
              <h3 className="mb-3 font-bold text-white">Aggiungi Fornitura</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={nuovoMateriale}
                    onChange={(e) => setNuovoMateriale(e.target.value)}
                    placeholder="Nome materiale"
                    className={`${HUB_MODAL_FIELD_CLS} flex-1`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAggiungi()}
                  />
                  <input
                    type="number"
                    min="1"
                    value={nuovaQuantita}
                    onChange={(e) => setNuovaQuantita(parseInt(e.target.value, 10) || 1)}
                    className={`${HUB_MODAL_FIELD_CLS} w-24`}
                  />
                  <HubModalPrimaryButton type="button" onClick={handleAggiungi} className="flex items-center gap-2 px-4 py-2">
                    <Plus size={18} aria-hidden />
                    Aggiungi
                  </HubModalPrimaryButton>
                </div>
                <input
                  type="text"
                  value={nuovaNota}
                  onChange={(e) => setNuovaNota(e.target.value)}
                  placeholder="Note aggiuntive (opzionale)"
                  className={HUB_MODAL_FIELD_CLS}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-bold text-white">Forniture Attive ({forniture.length})</h3>

            {loading ? (
              <div className="py-8 text-center text-white/52">Caricamento…</div>
            ) : forniture.length === 0 ? (
              <div className="py-8 text-center text-white/52">
                <Package size={48} className="mx-auto mb-2 opacity-30" aria-hidden />
                Nessuna fornitura temporanea
              </div>
            ) : (
              forniture.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.1] bg-black/[0.2] p-3 transition hover:bg-white/[0.04]"
                >
                  {editingId === f.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={editMateriale}
                        onChange={(e) => setEditMateriale(e.target.value)}
                        placeholder="Nome materiale"
                        className={`${HUB_MODAL_FIELD_CLS} text-sm`}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={editQuantita}
                          onChange={(e) => setEditQuantita(parseInt(e.target.value, 10) || 1)}
                          className={`${HUB_MODAL_FIELD_CLS} w-24 text-sm`}
                        />
                        <input
                          type="text"
                          value={editNota}
                          onChange={(e) => setEditNota(e.target.value)}
                          placeholder="Note (opzionale)"
                          className={`${HUB_MODAL_FIELD_CLS} flex-1 text-sm`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <HubModalPrimaryButton type="button" onClick={handleSalvaModifica} className="flex items-center gap-1 px-3 py-1.5 text-sm">
                          <Check size={14} aria-hidden />
                          Salva
                        </HubModalPrimaryButton>
                        <HubModalSecondaryButton type="button" onClick={handleAnnullaModifica} className="text-sm">
                          Annulla
                        </HubModalSecondaryButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white">{f.materiale}</div>
                        <div className="text-sm text-white/55">
                          Quantità: {f.quantita} — Prestito: {new Date(f.data_prestito).toLocaleDateString('it-IT')}
                        </div>
                        {f.nota && <div className="mt-1 text-sm text-sky-300">Note: {f.nota}</div>}
                      </div>
                      {isTecnico && (
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleModifica(f)}
                            className="flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-sky-300 hover:bg-white/[0.08]"
                          >
                            <Pencil size={16} aria-hidden />
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestituisci(f.id)}
                            className="flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-red-300 hover:bg-red-500/15"
                          >
                            <Trash2 size={16} aria-hidden />
                            Restituito
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <HubModalChromeFooter>
          <HubModalSecondaryButton type="button" onClick={onClose} className="w-full py-3 md:w-auto">
            Chiudi
          </HubModalSecondaryButton>
        </HubModalChromeFooter>
      </div>
    </HubModalBackdrop>
  );
};

export default FornitureModal;
