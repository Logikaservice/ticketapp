// hooks/useWebSocket.js

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook per gestire la connessione WebSocket
 * @param {Object} options - Opzioni per la connessione
 * @param {Function} options.onTicketCreated - Callback quando viene creato un ticket
 * @param {Function} options.onTicketUpdated - Callback quando viene aggiornato un ticket
 * @param {Function} options.onTicketStatusChanged - Callback quando cambia lo stato di un ticket
 * @param {Function} options.onNewMessage - Callback quando viene aggiunto un nuovo messaggio
 * @param {Function} options.getAuthHeader - Funzione per ottenere l'header di autenticazione
 * @param {Object} options.currentUser - Utente corrente
 * @returns {Object} - Oggetto con socket e stato connessione
 */
export const useWebSocket = ({
  onTicketCreated,
  onTicketUpdated,
  onTicketStatusChanged,
  onNewMessage,
  getAuthHeader,
  currentUser
}) => {
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!currentUser || !getAuthHeader) {
      console.log('⚠️ WebSocket: Utente o getAuthHeader non disponibile');
      return;
    }

    // Chiudi connessione esistente se presente
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      const apiBase = process.env.REACT_APP_API_URL;
      if (!apiBase) {
        console.error('❌ WebSocket: REACT_APP_API_URL non configurato');
        return;
      }

      const authHeader = getAuthHeader();
      const token = authHeader['Authorization']?.replace('Bearer ', '') || authHeader['authorization']?.replace('Bearer ', '');

      if (!token) {
        console.log('⚠️ WebSocket: Token non disponibile');
        return;
      }

      console.log('🔌 WebSocket: Tentativo di connessione...');

      socketRef.current = io(apiBase, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 20000
      });

      const socket = socketRef.current;

      // Evento: connessione stabilita
      socket.on('connect', () => {
        console.log('✅ WebSocket: Connesso con successo');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Invia ping periodico per mantenere connessione attiva
        if (reconnectTimeoutRef.current) {
          clearInterval(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping');
          }
        }, 30000); // Ping ogni 30 secondi
      });

      // Evento: disconnessione
      socket.on('disconnect', (reason) => {
        console.log(`❌ WebSocket: Disconnesso - ${reason}`);
        setIsConnected(false);
        
        if (reconnectTimeoutRef.current) {
          clearInterval(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Se la disconnessione non è volontaria, tenta riconnessione
        if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 WebSocket: Tentativo riconnessione ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
        }
      });

      // Evento: errore di connessione
      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket: Errore connessione -', error.message);
        reconnectAttemptsRef.current++;
      });

      // Evento: pong (risposta al ping)
      socket.on('pong', () => {
        // Connessione attiva
      });

      // Eventi business logic
      socket.on('ticket:created', (ticket) => {
        console.log('🔔 WebSocket: Nuovo ticket creato', ticket.id);
        if (onTicketCreated) {
          onTicketCreated(ticket);
        }
      });

      socket.on('ticket:updated', (ticket) => {
        console.log('🔔 WebSocket: Ticket aggiornato', ticket.id);
        if (onTicketUpdated) {
          onTicketUpdated(ticket);
        }
      });

      socket.on('ticket:status-changed', (data) => {
        console.log('🔔 WebSocket: Stato ticket cambiato', data.ticketId, data.oldStatus, '->', data.newStatus);
        if (onTicketStatusChanged) {
          onTicketStatusChanged(data);
        }
      });

      socket.on('message:new', (data) => {
        console.log('🔔 WebSocket: Nuovo messaggio', data.ticketId);
        if (onNewMessage) {
          onNewMessage(data);
        }
      });

    } catch (error) {
      console.error('❌ WebSocket: Errore durante la connessione', error);
    }
  }, [currentUser, getAuthHeader, onTicketCreated, onTicketUpdated, onTicketStatusChanged, onNewMessage]);

  // Connetti quando l'utente è disponibile
  useEffect(() => {
    if (currentUser) {
      connect();
    }

    // Cleanup alla disconnessione
    return () => {
      if (reconnectTimeoutRef.current) {
        clearInterval(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        console.log('🔌 WebSocket: Disconnessione cleanup');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUser, connect]);

  return {
    socket: socketRef.current,
    isConnected: isConnected,
    reconnect: connect
  };
};

