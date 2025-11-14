// hooks/useWebSocket.js

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useWebSocket = ({
  getAuthHeader,
  currentUser,
  onTicketCreated,
  onTicketUpdated,
  onTicketStatusChanged,
  onNewMessage
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!currentUser || socketRef.current?.connected) {
      return;
    }

    // Disconnetti socket esistente se presente
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const token = getAuthHeader()?.Authorization?.replace('Bearer ', '') || 
                    localStorage.getItem('token');

      if (!token) {
        console.warn('⚠️ WebSocket: Token non disponibile, connessione non possibile');
        return;
      }

      console.log('🔌 WebSocket: Tentativo di connessione...');
      
      const socket = io(apiBase, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ WebSocket: Connesso');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket: Disconnesso -', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server ha disconnesso, riconnetti manualmente
          setTimeout(() => {
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              connect();
            }
          }, 2000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket: Errore connessione -', error.message);
        setIsConnected(false);
      });

      socket.on('pong', () => {
        // Risposta al ping, connessione attiva
      });

      // Eventi ticket
      socket.on('ticket:created', (ticket) => {
        console.log('📨 WebSocket: Nuovo ticket creato', ticket.id);
        if (onTicketCreated) {
          onTicketCreated(ticket);
        }
      });

      socket.on('ticket:updated', (ticket) => {
        console.log('📨 WebSocket: Ticket aggiornato', ticket.id);
        if (onTicketUpdated) {
          onTicketUpdated(ticket);
        }
      });

      socket.on('ticket:status-changed', (data) => {
        console.log('📨 WebSocket: Stato ticket cambiato', data.ticketId, data.oldStatus, '→', data.newStatus);
        if (onTicketStatusChanged) {
          onTicketStatusChanged(data);
        }
      });

      socket.on('message:new', (data) => {
        console.log('📨 WebSocket: Nuovo messaggio', data.ticketId);
        if (onNewMessage) {
          onNewMessage(data);
        }
      });

      // Ping periodico per mantenere la connessione attiva
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000); // Ogni 30 secondi

      // Cleanup ping interval
      return () => {
        clearInterval(pingInterval);
      };
    } catch (error) {
      console.error('❌ WebSocket: Errore inizializzazione -', error);
      setIsConnected(false);
    }
  }, [currentUser, getAuthHeader, onTicketCreated, onTicketUpdated, onTicketStatusChanged, onNewMessage]);

  useEffect(() => {
    if (currentUser) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        console.log('🔌 WebSocket: Disconnessione cleanup');
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [connect, currentUser]);

  return { isConnected };
};

