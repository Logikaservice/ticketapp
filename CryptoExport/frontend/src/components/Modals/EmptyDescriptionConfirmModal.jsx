import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';

const EmptyDescriptionConfirmModal = ({ handleConfirmEmptyDescription, closeModal }) => {
  return (
    <div className="bg-white rounded-xl max-w-sm w-full p-6">
      <div className="text-center mb-4">
        <AlertTriangle size={48} className="text-orange-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Descrizione Vuota</h2>
      </div>

      <div className="text-sm mb-6 p-3 border border-orange-200 bg-orange-50 rounded-lg">
        <p className="font-semibold text-orange-800">Attenzione:</p>
        <p className="mt-1">
          Non hai inserito nessuna descrizione. Vuoi procedere comunque?
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">
          Torna indietro
        </button>
        <button
          onClick={handleConfirmEmptyDescription}
          className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-orange-700"
        >
          <Check size={18} />
          Continua
        </button>
      </div>
    </div>
  );
};

export default EmptyDescriptionConfirmModal;
