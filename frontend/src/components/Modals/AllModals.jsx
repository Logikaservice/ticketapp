// src/components/Modals/AllModals.jsx

import React from 'react';
import TimeLoggerModal from './TimeLoggerModal';
import SettingsModal from './SettingsModal';
import UrgentConfirmModal from './UrgentConfirmModal';
import EmptyDescriptionConfirmModal from './EmptyDescriptionConfirmModal';
import ReportModal from './ReportModal';
import ManageAlertsModal from './ManageAlertsModal';
import EmailConfirmModal from './EmailConfirmModal';
import AlertEmailConfirmModal from './AlertEmailConfirmModal';

const AllModals = ({ modalState, closeModal, closeEmptyDescriptionModal, ...handlers }) => {
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
        return <SettingsModal closeModal={closeModal} currentUser={handlers.currentUser} {...handlers} />;
        
      case 'urgentConfirm':
        return <UrgentConfirmModal closeModal={closeModal} {...handlers} />;
        
      case 'emptyDescriptionConfirm':
        return <EmptyDescriptionConfirmModal closeModal={closeEmptyDescriptionModal || closeModal} {...handlers} />;
        
      case 'reportHTML':
        return (
          <ReportModal 
            closeModal={closeModal} 
            title={modalState.data.title}
            htmlContent={modalState.data.htmlContent}
          />
        );
        
      case 'manageAlerts':
        return (
          <ManageAlertsModal 
            isOpen={true}
            onClose={closeModal}
            users={handlers.users}
            onSave={handlers.onSaveAlert}
            onEdit={handlers.onEditAlert}
            editingAlert={modalState.data}
            onRequestEmailConfirm={handlers.onRequestEmailConfirm}
          />
        );
        
      case 'emailConfirm':
        return (
          <EmailConfirmModal 
            onConfirm={handlers.onConfirmEmail}
            onCancel={handlers.onCancelEmail}
            isEditing={modalState.data?.isEditing}
            clientName={modalState.data?.clientName}
            currentUser={handlers.currentUser}
            statusChange={modalState.data?.statusChange}
            newStatus={modalState.data?.newStatus}
          />
        );
        
      case 'alertEmailConfirm':
        return (
          <AlertEmailConfirmModal 
            onConfirm={handlers.onConfirmAlertEmail}
            onCancel={handlers.onCancelAlertEmail}
            users={handlers.users}
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
