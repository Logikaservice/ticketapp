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
  const isConnectingRef = useRef(false);
  const pingIntervalRef = useRef(null);
  
  // Usa useRef per le callback per evitare ri-render
  const callbacksRef = useRef({
    onTicketCreated,
    onTicketUpdated,
    onTicketStatusChanged,
    onNewMessage
  });
  
  // Aggiorna le callback senza causare ri-render
  useEffect(() => {
    callbacksRef.current = {
      onTicketCreated,
      onTicketUpdated,
      onTicketStatusChanged,
      onNewMessage
    };
  }, [onTicketCreated, onTicketUpdated, onTicketStatusChanged, onNewMessage]);

  useEffect(() => {
    if (!currentUser || isConnectingRef.current || socketRef.current?.connected) {
      return;
    }

    isConnectingRef.current = true;

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
        isConnectingRef.current = false;
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
        isConnectingRef.current = false;
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket: Disconnesso -', reason);
        setIsConnected(false);
        isConnectingRef.current = false;
        
        // Non riconnettere manualmente se è una disconnessione normale
        // Socket.io gestisce già la riconnessione automatica
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket: Errore connessione -', error.message);
        setIsConnected(false);
        isConnectingRef.current = false;
      });

      socket.on('pong', () => {
        // Risposta al ping, connessione attiva
      });

      // Eventi ticket - usa callbacksRef per evitare dipendenze
      socket.on('ticket:created', (ticket) => {
        console.log('📨 WebSocket: Nuovo ticket creato', ticket.id);
        if (callbacksRef.current.onTicketCreated) {
          callbacksRef.current.onTicketCreated(ticket);
        }
      });

      socket.on('ticket:updated', (ticket) => {
        console.log('📨 WebSocket: Ticket aggiornato', ticket.id);
        if (callbacksRef.current.onTicketUpdated) {
          callbacksRef.current.onTicketUpdated(ticket);
        }
      });

      socket.on('ticket:status-changed', (data) => {
        console.log('📨 WebSocket: Stato ticket cambiato', data.ticketId, data.oldStatus, '→', data.newStatus);
        if (callbacksRef.current.onTicketStatusChanged) {
          callbacksRef.current.onTicketStatusChanged(data);
        }
      });

      socket.on('message:new', (data) => {
        console.log('📨 WebSocket: Nuovo messaggio', data.ticketId);
        if (callbacksRef.current.onNewMessage) {
          callbacksRef.current.onNewMessage(data);
        }
      });

      // Ping periodico per mantenere la connessione attiva
      pingIntervalRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000); // Ogni 30 secondi

    } catch (error) {
      console.error('❌ WebSocket: Errore inizializzazione -', error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }

    return () => {
      if (socketRef.current) {
        console.log('🔌 WebSocket: Disconnessione cleanup');
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        isConnectingRef.current = false;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [currentUser?.id, getAuthHeader]); // Solo currentUser.id e getAuthHeader come dipendenze

  return { isConnected };
};

