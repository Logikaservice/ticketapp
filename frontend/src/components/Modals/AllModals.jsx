// src/components/Modals/AllModals.jsx

import React from 'react';
import TimeLoggerModal from './TimeLoggerModal';
import SettingsModal from './SettingsModal';
import UrgentConfirmModal from './UrgentConfirmModal';
import ReportModal from './ReportModal';

const AllModals = ({ modalState, closeModal, ...handlers }) => {
  if (!modalState.type) return null;

  const renderModalContent = () => {
    switch (modalState.type) {
      case 'timeLogger':
        // ✅ Passa selectedTicket dal modalState.data
        return (
          <TimeLoggerModal 
            closeModal={closeModal} 
            selectedTicket={modalState.data}
            {...handlers} 
          />
        );
      
      case 'viewTimeLogger':
        // ✅ Modal TimeLogger in modalità SOLA LETTURA
        return (
          <TimeLoggerModal 
            closeModal={closeModal} 
            selectedTicket={modalState.data}
            readOnly={true}
            {...handlers} 
          />
        );
        
      case 'settings':
        return <SettingsModal closeModal={closeModal} {...handlers} />;
        
      case 'urgentConfirm':
        return <UrgentConfirmModal closeModal={closeModal} {...handlers} />;
        
      case 'invoiceReport':
      case 'sentReport':
        return <ReportModal closeModal={closeModal} {...modalState.data} {...handlers} />;
        
      default:
        return null;
    }
  };
  
  const content = renderModalContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
      {content}
    </div>
  );
};

export default AllModals;
