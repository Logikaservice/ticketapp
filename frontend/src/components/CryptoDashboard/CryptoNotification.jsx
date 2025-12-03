import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import './CryptoNotification.css';

const CryptoNotification = ({ notification, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Auto-close after 5 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(), 300); // Wait for animation
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    if (!isVisible) return null;

    const isPositive = notification.type === 'closed' && notification.profit_loss > 0;

    return (
        <div className={`crypto-notification ${isVisible ? 'visible' : ''} ${notification.type}`}>
            <div className="notification-icon">
                {notification.type === 'opened' ? (
                    <TrendingUp size={20} className="text-blue-500" />
                ) : (
                    <TrendingDown size={20} className={isPositive ? 'text-green-500' : 'text-red-500'} />
                )}
            </div>
            <div className="notification-content">
                <div className="notification-title">
                    {notification.type === 'opened' 
                        ? `📈 Posizione Aperta: ${notification.type.toUpperCase()}`
                        : `📉 Posizione Chiusa: ${notification.reason || 'Manual'}`
                    }
                </div>
                <div className="notification-details">
                    {notification.symbol} - {notification.volume?.toFixed(4) || 0} @ €{notification.entry_price?.toFixed(2) || 0}
                    {notification.type === 'closed' && (
                        <span className={`pnl ${isPositive ? 'positive' : 'negative'}`}>
                            {isPositive ? '+' : ''}€{notification.profit_loss?.toFixed(2) || 0}
                        </span>
                    )}
                </div>
            </div>
            <button className="notification-close" onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose(), 300);
            }}>
                <X size={16} />
            </button>
        </div>
    );
};

export default CryptoNotification;

