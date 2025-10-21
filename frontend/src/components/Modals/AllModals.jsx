// src/components/Modals/AllModals.jsx

import React from 'react';
import TimeLoggerModal from './TimeLoggerModal';
import SettingsModal from './SettingsModal';
import UrgentConfirmModal from './UrgentConfirmModal';
import EmptyDescriptionConfirmModal from './EmptyDescriptionConfirmModal';
import ReportModal from './ReportModal';

const AllModals = ({ modalState, closeModal, ...handlers }) => {
  if (!modalState.type) return null;

  const renderModalContent = () => {
    switch (modalState.type) {
      case 'timeLogger':
        return (
          <TimeLoggerModal 
            closeModal={closeModal} 
            selectedTicket={modalState.data}
            currentUser={handlers.currentUser}
            {...handlers} 
          />
        );
      
      case 'viewTimeLogger':
        return (
          <TimeLoggerModal 
            closeModal={closeModal} 
            selectedTicket={modalState.data}
            readOnly={true}
            currentUser={handlers.currentUser}
            handleSaveTimeLogs={handlers.handleSaveTimeLogs}
            {...handlers} 
          />
        );
        
      case 'settings':
        return <SettingsModal closeModal={closeModal} {...handlers} />;
        
      case 'urgentConfirm':
        return <UrgentConfirmModal closeModal={closeModal} {...handlers} />;
        
      case 'emptyDescriptionConfirm':
        return <EmptyDescriptionConfirmModal closeModal={closeModal} {...handlers} />;
        
      case 'reportHTML':
        return (
          <ReportModal 
            closeModal={closeModal} 
            title={modalState.data.title}
            htmlContent={modalState.data.htmlContent}
          />
        );
        
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
