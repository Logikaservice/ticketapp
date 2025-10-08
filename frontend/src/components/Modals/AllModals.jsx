import React from 'react';
import NewTicketModal from './NewTicketModal';
import TimeLoggerModal from './TimeLoggerModal';
import SettingsModal from './SettingsModal';
import NewClientModal from './NewClientModal';
import UrgentConfirmModal from './UrgentConfirmModal';
import ReportModal from './ReportModal';

const AllModals = ({ modalState, closeModal, ...handlers }) => {
  if (!modalState.type) return null;

  const {
    newTicketData,
    setNewTicketData,
    handleCreateTicket,
    isEditingTicket,
    currentUser,
    clientiAttivi,
    selectedClientForNewTicket,
    setSelectedClientForNewTicket,
    resetNewTicketData,
    timeLogs,
    setTimeLogs,
    handleTimeLogChange,
    handleAddTimeLog,
    handleRemoveTimeLog,
    handleDuplicateTimeLog,
    handleMaterialChange,
    handleAddMaterial,
    handleRemoveMaterial,
    handleConfirmTimeLogs,
    settingsData,
    setSettingsData,
    handleUpdateSettings,
    newClientData,
    setNewClientData,
    handleCreateClient,
    handleConfirmUrgentCreation,
    showNotification
  } = handlers;

  const renderModalContent = () => {
    switch (modalState.type) {
      case 'newTicket':
        return (
          <NewTicketModal
            newTicketData={newTicketData}
            setNewTicketData={setNewTicketData}
            handleCreateTicket={handleCreateTicket}
            isEditingTicket={isEditingTicket}
            currentUser={currentUser}
            clientiAttivi={clientiAttivi}
            selectedClientForNewTicket={selectedClientForNewTicket}
            setSelectedClientForNewTicket={setSelectedClientForNewTicket}
            resetNewTicketData={resetNewTicketData}
            closeModal={closeModal}
          />
        );

      case 'timeLogger':
        return (
          <TimeLoggerModal
            modalData={modalState.data}
            timeLogs={timeLogs}
            setTimeLogs={setTimeLogs}
            handleTimeLogChange={handleTimeLogChange}
            handleAddTimeLog={handleAddTimeLog}
            handleRemoveTimeLog={handleRemoveTimeLog}
            handleDuplicateTimeLog={handleDuplicateTimeLog}
            handleMaterialChange={handleMaterialChange}
            handleAddMaterial={handleAddMaterial}
            handleRemoveMaterial={handleRemoveMaterial}
            handleConfirmTimeLogs={handleConfirmTimeLogs}
            closeModal={closeModal}
          />
        );

      case 'settings':
        return (
          <SettingsModal
            settingsData={settingsData}
            setSettingsData={setSettingsData}
            handleUpdateSettings={handleUpdateSettings}
            closeModal={closeModal}
          />
        );

      case 'newClient':
        return (
          <NewClientModal
            newClientData={newClientData}
            setNewClientData={setNewClientData}
            handleCreateClient={handleCreateClient}
            closeModal={closeModal}
          />
        );

      case 'urgentConfirm':
        return (
          <UrgentConfirmModal
            handleConfirmUrgentCreation={handleConfirmUrgentCreation}
            closeModal={closeModal}
          />
        );

      case 'invoiceReport':
      case 'sentReport':
        const { title, content, color } = modalState.data;
        return (
          <ReportModal
            title={title}
            content={content}
            color={color}
            closeModal={closeModal}
            showNotification={showNotification}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      {renderModalContent()}
    </div>
  );
};

export default AllModals;