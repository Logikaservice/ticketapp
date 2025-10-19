import React from 'react';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const AppNotification = ({ notification, handleClose }) => {
  if (!notification || !notification.show) {
    return null;
  }

  // Definisce stili e icone per ogni tipo di notifica
  const typeStyles = {
    success: { bg: 'bg-green-600', icon: <CheckCircle /> },
    error: { bg: 'bg-red-600', icon: <XCircle /> },
    info: { bg: 'bg-blue-600', icon: <Info /> },
    warning: { bg: 'bg-yellow-500', icon: <AlertTriangle /> }
  };

  const style = typeStyles[notification.type] || typeStyles.info;

  const handleClick = () => {
    if (notification && notification.ticketId) {
      try { window.dispatchEvent(new CustomEvent('toast-open-ticket', { detail: notification.ticketId })); } catch {}
      handleClose();
    }
  };

  return (
    <div
      className={`fixed bottom-5 right-5 z-[100] flex items-center gap-4 p-4 rounded-xl shadow-2xl text-white max-w-sm ${style.bg} ${notification.ticketId ? 'cursor-pointer' : ''}`}
      onClick={notification.ticketId ? handleClick : undefined}
    >
      <div className="flex-shrink-0">
        {style.icon}
      </div>
      <div className="flex-1">
        <span>{notification.message}</span>
      </div>
      {notification.ticketId && (
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs"
          aria-label="Apri ticket"
        >
          Apri
        </button>
      )}
      <button 
        onClick={(e) => { e.stopPropagation(); handleClose(); }} 
        className="ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Chiudi notifica"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default AppNotification;
