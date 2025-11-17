// hooks/useWebSocket.js

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getApiBase } from '../utils/apiConfig';

export const useWebSocket = ({
  getAuthHeader,
  currentUser,
  onTicketCreated,
  onTicketUpdated,
  onTicketStatusChanged,
  onNewMessage,
  onTicketDeleted
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
    onNewMessage,
    onTicketDeleted
  });
  
  // Aggiorna le callback senza causare ri-render
  useEffect(() => {
    callbacksRef.current = {
      onTicketCreated,
      onTicketUpdated,
      onTicketStatusChanged,
      onNewMessage,
      onTicketDeleted
    };
  }, [onTicketCreated, onTicketUpdated, onTicketStatusChanged, onNewMessage, onTicketDeleted]);

  useEffect(() => {
    // Controlla se dobbiamo connettere
    if (!currentUser?.id) {
      // Se non c'è utente, disconnetti se presente
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        isConnectingRef.current = false;
      }
      return;
    }

    // Se già connesso o in connessione, non fare nulla
    if (socketRef.current?.connected || isConnectingRef.current) {
      return;
    }

    // Prevenzione doppia connessione
    const userId = currentUser.id;
    if (socketRef.current?.userId === userId && socketRef.current?.connected) {
      return;
    }

    isConnectingRef.current = true;

    // Disconnetti socket esistente se presente
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      const apiBase = getApiBase() || window.location.origin;
      
      // Ottieni token - non usare getAuthHeader nelle dipendenze
      const authHeader = getAuthHeader();
      let token = authHeader?.Authorization?.replace('Bearer ', '');
      
      if (!token) {
        token = localStorage.getItem('authToken');
      }
      
      if (!token) {
        console.warn('⚠️ WebSocket: Token non disponibile, connessione non possibile');
        console.warn('⚠️ authHeader:', authHeader);
        console.warn('⚠️ localStorage authToken:', localStorage.getItem('authToken'));
        isConnectingRef.current = false;
        return;
      }

      // Verifica che il token sia valido (almeno ha la struttura JWT)
      if (!token.includes('.')) {
        console.error('❌ WebSocket: Token malformato (non è un JWT valido)');
        isConnectingRef.current = false;
        return;
      }

      console.log('🔌 WebSocket: Tentativo di connessione a', apiBase);
      console.log('🔌 WebSocket: Token presente (lunghezza:', token.length, 'caratteri)');
      
      const socket = io(apiBase, {
        auth: {
          token: token
        },
        extraHeaders: {
          Authorization: `Bearer ${token}`
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 20000
      });

      socket.userId = userId; // Salva userId per controllo
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ WebSocket: Connesso con successo');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket: Disconnesso -', reason);
        setIsConnected(false);
        isConnectingRef.current = false;
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket: Errore connessione -', error.message);
        setIsConnected(false);
        isConnectingRef.current = false;
        // Non riconnettere manualmente - Socket.io lo fa automaticamente
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

      socket.on('ticket:deleted', (data) => {
        console.log('📨 WebSocket: Ticket cancellato', data.ticketId);
        if (callbacksRef.current.onTicketDeleted) {
          callbacksRef.current.onTicketDeleted(data);
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
      // Cleanup solo se l'utente è cambiato o il componente viene smontato
      if (socketRef.current && socketRef.current.userId !== userId) {
        console.log('🔌 WebSocket: Disconnessione cleanup (utente cambiato)');
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
  }, [currentUser?.id]); // SOLO currentUser.id come dipendenza - getAuthHeader viene chiamato dentro

  return { isConnected };
};

