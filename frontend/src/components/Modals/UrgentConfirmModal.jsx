import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';

const UrgentConfirmModal = ({ handleConfirmUrgentCreation, closeModal }) => {
  return (
    <div className="bg-white rounded-xl max-w-sm w-full p-6">
      <div className="text-center mb-4">
        <AlertTriangle size={48} className="text-red-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Conferma Urgente</h2>
      </div>

      <div className="text-sm mb-6 p-3 border border-red-200 bg-red-50 rounded-lg">
        <p className="font-semibold text-red-800">Attenzione:</p>
        <p className="mt-1">
          La priorità URGENTE potrebbe prevedere costi maggiorati.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg">
          Annulla
        </button>
        <button
          onClick={handleConfirmUrgentCreation}
          className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <Check size={18} />
          Accetta
        </button>
      </div>
    </div>
  );
};

export default UrgentConfirmModal;