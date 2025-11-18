import React, { useState, useEffect } from 'react';
import { X, Clock, Check } from 'lucide-react';

const InactivityTimerModal = ({ closeModal, currentTimeout, onTimeoutChange }) => {
  const [selectedTimeout, setSelectedTimeout] = useState(currentTimeout || 3); // Default 3 minuti

  const timeoutOptions = [
    { value: 1, label: '1 minuto' },
    { value: 3, label: '3 minuti' },
    { value: 6, label: '6 minuti' },
    { value: 0, label: 'Mai' }
  ];

  const handleSave = () => {
    onTimeoutChange(selectedTimeout);
    closeModal();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Clock size={28} />
                Timer Inattività
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Imposta il tempo di disconnessione automatica
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Contenuto */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Seleziona dopo quanto tempo di inattività vuoi essere disconnesso automaticamente:
          </p>

          <div className="space-y-2">
            {timeoutOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTimeout(option.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition ${
                  selectedTimeout === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                {selectedTimeout === option.value && (
                  <Check size={20} className="text-blue-600" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Nota:</strong> Il timer si resetta automaticamente ad ogni tua interazione (click, movimento mouse, digitazione).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex gap-2">
          <button
            onClick={closeModal}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityTimerModal;

