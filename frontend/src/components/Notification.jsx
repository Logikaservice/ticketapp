import React from 'react';
import { X, Check, AlertCircle, Info } from 'lucide-react';

const Notification = ({ notification, setNotification }) => {
  if (!notification || !notification.show) return null;
  
  const typeStyles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };
  
  const Icon = notification.type === 'success' ? Check : (notification.type === 'error' ? AlertCircle : Info);
  
  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <div className={'flex items-center p-4 rounded-xl shadow-2xl text-white ' + typeStyles[notification.type]}>
        <Icon size={24} className="mr-3" />
        <span>{notification.message}</span>
        <button 
          onClick={() => setNotification(p => ({ ...p, show: false }))} 
          className="ml-4 p-1 rounded-full hover:bg-white/20"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Notification;