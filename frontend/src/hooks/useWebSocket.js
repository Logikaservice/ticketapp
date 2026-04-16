// hooks/useWebSocket.js

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getApiBase } from '../utils/apiConfig';

export const useWebSocket = ({
  enabled = true,
  getAuthHeader,
  currentUser,
  onTicketCreated,
  onTicketUpdated,
  onTicketStatusChanged,
  onNewMessage,
  onTicketDeleted,
  onNetworkMonitoringUpdate
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);
  const pingIntervalRef = useRef(null);
  const isDebugEnabledRef = useRef(false);

  const wsLog = useCallback((...args) => {
    if (isDebugEnabledRef.current) console.log(...args);
  }, []);
  const wsWarn = useCallback((...args) => {
    if (isDebugEnabledRef.current) console.warn(...args);
  }, []);
  const wsError = useCallback((...args) => {
    if (isDebugEnabledRef.current) console.error(...args);
  }, []);
  
  // Usa useRef per le callback per evitare ri-render
  const callbacksRef = useRef({
    onTicketCreated,
    onTicketUpdated,
    onTicketStatusChanged,
    onNewMessage,
    onTicketDeleted,
    onNetworkMonitoringUpdate
  });
  
  // Aggiorna le callback senza causare ri-render
  useEffect(() => {
    callbacksRef.current = {
      onTicketCreated,
      onTicketUpdated,
      onTicketStatusChanged,
      onNewMessage,
      onTicketDeleted,
      onNetworkMonitoringUpdate
    };
  }, [onTicketCreated, onTicketUpdated, onTicketStatusChanged, onNewMessage, onTicketDeleted, onNetworkMonitoringUpdate]);

  useEffect(() => {
    // Se disabilitato, assicura disconnessione e non tentare connessioni.
    if (!enabled) {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (_) {
          // ignore
        }
        socketRef.current = null;
      }
      setIsConnected(false);
      isConnectingRef.current = false;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      return;
    }

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

      // Debug logs: disattivati di default per evitare spam console in produzione.
      // Abilita con: localStorage.setItem('debug_ws','1')
      try {
        isDebugEnabledRef.current = localStorage.getItem('debug_ws') === '1';
      } catch (_) {
        isDebugEnabledRef.current = false;
      }
      
      // Ottieni token - non usare getAuthHeader nelle dipendenze
      const authHeader = getAuthHeader();
      let token = authHeader?.Authorization?.replace('Bearer ', '');
      
      if (!token) {
        token = localStorage.getItem('authToken');
      }
      
      if (!token) {
        wsWarn('⚠️ WebSocket: Token non disponibile, connessione non possibile');
        wsWarn('⚠️ authHeader:', authHeader);
        wsWarn('⚠️ localStorage authToken:', localStorage.getItem('authToken'));
        isConnectingRef.current = false;
        return;
      }

      // Verifica che il token sia valido (almeno ha la struttura JWT)
      if (!token.includes('.')) {
        wsError('❌ WebSocket: Token malformato (non è un JWT valido)');
        isConnectingRef.current = false;
        return;
      }

      wsLog('🔌 WebSocket: Tentativo di connessione a', apiBase);
      wsLog('🔌 WebSocket: Token presente (lunghezza:', token.length, 'caratteri)');
      
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
        wsLog('✅ WebSocket: Connesso con successo');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
      });

      socket.on('disconnect', (reason) => {
        wsLog('❌ WebSocket: Disconnesso -', reason);
        setIsConnected(false);
        isConnectingRef.current = false;
      });

      socket.on('connect_error', (error) => {
        // Non loggare errori CORS o di rete come errori critici se sono temporanei
        const isNetworkError = error.message.includes('websocket error') || 
                               error.message.includes('xhr poll error') ||
                               error.message.includes('timeout');
        
        if (isNetworkError && reconnectAttemptsRef.current < 3) {
          // Log solo come warning per i primi tentativi
          wsWarn('⚠️ WebSocket: Tentativo di connessione...', reconnectAttemptsRef.current + 1);
        } else {
          wsError('❌ WebSocket: Errore connessione -', error.message);
        }
        
        setIsConnected(false);
        isConnectingRef.current = false;
        // Non riconnettere manualmente - Socket.io lo fa automaticamente
      });

      socket.on('pong', () => {
        // Risposta al ping, connessione attiva
      });

      // Eventi ticket - usa callbacksRef per evitare dipendenze
      socket.on('ticket:created', (ticket) => {
        wsLog('📨 WebSocket: Nuovo ticket creato', ticket.id);
        if (callbacksRef.current.onTicketCreated) {
          callbacksRef.current.onTicketCreated(ticket);
        }
      });

      socket.on('ticket:updated', (ticket) => {
        wsLog('📨 WebSocket: Ticket aggiornato', ticket.id);
        if (callbacksRef.current.onTicketUpdated) {
          callbacksRef.current.onTicketUpdated(ticket);
        }
      });

      socket.on('ticket:status-changed', (data) => {
        wsLog('📨 WebSocket: Stato ticket cambiato', data.ticketId, data.oldStatus, '→', data.newStatus);
        if (callbacksRef.current.onTicketStatusChanged) {
          callbacksRef.current.onTicketStatusChanged(data);
        }
      });

      socket.on('message:new', (data) => {
        wsLog('📨 WebSocket: Nuovo messaggio', data.ticketId);
        if (callbacksRef.current.onNewMessage) {
          callbacksRef.current.onNewMessage(data);
        }
      });

      socket.on('ticket:deleted', (data) => {
        wsLog('📨 WebSocket: Ticket cancellato', data.ticketId);
        if (callbacksRef.current.onTicketDeleted) {
          callbacksRef.current.onTicketDeleted(data);
        }
      });

      // Eventi network monitoring
      socket.on('network-monitoring-update', (data) => {
        wsLog('📡 WebSocket: Network monitoring update', data);
        if (callbacksRef.current.onNetworkMonitoringUpdate) {
          callbacksRef.current.onNetworkMonitoringUpdate(data);
        }
      });

      // Ping periodico per mantenere la connessione attiva
      pingIntervalRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000); // Ogni 30 secondi

    } catch (error) {
      wsError('❌ WebSocket: Errore inizializzazione -', error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }

    return () => {
      // Cleanup solo se l'utente è cambiato o il componente viene smontato
      if (socketRef.current && socketRef.current.userId !== userId) {
        wsLog('🔌 WebSocket: Disconnessione cleanup (utente cambiato)');
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
  }, [enabled, currentUser?.id]); // SOLO flags + currentUser.id come dipendenza

  return { isConnected, socket: socketRef.current };
};

