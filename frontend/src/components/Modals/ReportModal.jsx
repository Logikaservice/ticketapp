// src/components/Modals/ReportModal.jsx

import React from 'react';
import { X, Printer } from 'lucide-react';

const ReportModal = ({ closeModal, htmlContent, title }) => {
  const handlePrint = () => {
    // Crea un blob URL per aprire l'HTML in una nuova scheda
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
    
    if (printWindow) {
      // Pulisci l'URL dopo che la finestra è stata aperta
      printWindow.addEventListener('load', () => {
        URL.revokeObjectURL(url);
        // Attendi che il contenuto sia completamente caricato prima di stampare
        setTimeout(() => {
          printWindow.print();
        }, 500);
      });
      
      // Fallback: pulisci l'URL dopo 10 secondi anche se l'evento load non viene chiamato
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    }
  };

  return (
    <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
          {title}
        </h2>
        <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div 
          className="bg-white shadow-lg"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Footer con pulsanti */}
      <div className="flex gap-3 p-6 border-t bg-gray-50">
        <button
          onClick={closeModal}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-bold hover:bg-gray-100"
        >
          Chiudi
        </button>
        
        <button
          onClick={handlePrint}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700"
        >
          <Printer size={18} />
          Stampa
        </button>
      </div>
    </div>
  );
};

export default ReportModal;
