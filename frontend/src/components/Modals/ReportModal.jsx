// src/components/Modals/ReportModal.jsx

import React from 'react';
import { Printer } from 'lucide-react';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalSecondaryButton
} from './HubModalChrome';

const ReportModal = ({ closeModal, htmlContent, title }) => {
  const handlePrint = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

    if (printWindow) {
      printWindow.addEventListener('load', () => {
        URL.revokeObjectURL(url);
        setTimeout(() => {
          printWindow.print();
        }, 500);
      });

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    }
  };

  return (
    <HubModalInnerCard maxWidthClass="max-w-5xl w-full" className="flex max-h-[90vh] flex-col">
      <HubModalChromeHeader title={title || 'Report'} onClose={closeModal} compact />

      <div className="min-h-0 flex-1 overflow-y-auto bg-black/[0.2] p-4">
        <div className="bg-white shadow-lg" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>

      <HubModalChromeFooter className="justify-stretch gap-3 [&>button]:flex-1">
        <HubModalSecondaryButton type="button" onClick={closeModal} className="flex-1 py-3">
          Chiudi
        </HubModalSecondaryButton>
        <button
          type="button"
          onClick={handlePrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
        >
          <Printer size={18} aria-hidden />
          Stampa
        </button>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default ReportModal;
