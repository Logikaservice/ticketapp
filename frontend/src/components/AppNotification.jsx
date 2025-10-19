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
    if (typeof notification.onClick === 'function') {
      try { notification.onClick(); } catch {}
    }
    handleClose();
  };

  return (
    <div
      className={`fixed bottom-5 right-5 z-[100] flex items-center gap-4 p-4 rounded-xl shadow-2xl text-white max-w-sm ${style.bg} ${notification.onClick ? 'cursor-pointer' : ''}`}
      onClick={notification.onClick ? handleClick : undefined}
      role={notification.onClick ? 'button' : undefined}
      tabIndex={notification.onClick ? 0 : undefined}
      onKeyDown={notification.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
    >
      <div className="flex-shrink-0">
        {style.icon}
      </div>
      <div className="flex-1">
        <span>{notification.message}</span>
      </div>
      <button 
        onClick={handleClose} 
        className="ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Chiudi notifica"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default AppNotification;
