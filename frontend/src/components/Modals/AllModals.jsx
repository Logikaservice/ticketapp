// src/components/Modals/AllModals.jsx

import React from 'react';
import NewTicketModal from './NewTicketModal';
import TimeLoggerModal from './TimeLoggerModal';
import SettingsModal from './SettingsModal';
// NON importare più NewClientModal qui
import UrgentConfirmModal from './UrgentConfirmModal';
import ReportModal from './ReportModal';

const AllModals = ({ modalState, closeModal, ...handlers }) => {
  // Se non c'è nessuna modale da aprire (o se è una di quelle nuove), non fare nulla
  if (!modalState.type) return null;

  // Estrai solo le props che servono a questo componente
  const {
    // ... (le props come newTicketData, settingsData, ecc. rimangono qui)
  } = handlers;

  const renderModalContent = () => {
    switch (modalState.type) {
      case 'newTicket':
        return <NewTicketModal closeModal={closeModal} {...handlers} />;

      case 'timeLogger':
        return <TimeLoggerModal closeModal={closeModal} {...handlers} />;

      case 'settings':
        return <SettingsModal closeModal={closeModal} {...handlers} />;

      // --- HO RIMOSSO COMPLETAMENTE IL "case 'newClient'" DA QUI ---

      case 'urgentConfirm':
        return <UrgentConfirmModal closeModal={closeModal} {...handlers} />;

      case 'invoiceReport':
      case 'sentReport':
        return <ReportModal closeModal={closeModal} {...modalState.data} {...handlers} />;

      default:
        // Se il tipo di modale è 'newClient' o 'manageClients', non fare nulla
        // perché vengono gestite da App.jsx
        return null;
    }
  };

  // Se non c'è contenuto da renderizzare, non mostrare nulla
  const content = renderModalContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
      {content}
    </div>
  );
};

export default AllModals;
