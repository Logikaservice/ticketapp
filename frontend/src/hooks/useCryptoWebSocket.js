import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

export const useCryptoWebSocket = (onPositionOpened, onPositionClosed) => {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const { getAuthHeader } = useAuth();

    useEffect(() => {
        // Determine API base URL
        const apiBase = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : '';

        // Get auth token
        const authHeader = getAuthHeader();
        const token = authHeader['Authorization']?.replace('Bearer ', '');

        if (!token) {
            console.warn('⚠️ No auth token found for crypto WebSocket');
            return;
        }

        // Connect to Socket.io
        socketRef.current = io(apiBase, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        const socket = socketRef.current;

        // Connection events
        let reconnectAttempts = 0;
        const MAX_RECONNECT_ATTEMPTS = 10;
        let lastErrorTime = 0;
        const ERROR_LOG_INTERVAL = 30000; // Log errori max ogni 30 secondi

        socket.on('connect', () => {
            console.log('✅ Crypto WebSocket connected');
            setConnected(true);
            reconnectAttempts = 0; // Reset contatore al successo
            
            // Join crypto dashboard room
            socket.emit('crypto:join-dashboard');
        });

        socket.on('crypto:joined', (data) => {
            console.log('✅ Joined crypto dashboard room:', data.room);
        });

        socket.on('disconnect', (reason) => {
            // Non loggare ogni disconnect (può essere normale durante riavvii)
            if (reason === 'io server disconnect') {
                // Il server ha forzato la disconnessione, non riconnettersi automaticamente
                console.warn('⚠️ Crypto WebSocket disconnesso dal server');
            }
            setConnected(false);
        });

        socket.on('connect_error', (error) => {
            const now = Date.now();
            reconnectAttempts++;
            
            // Log errori solo ogni 30 secondi per evitare spam nella console
            if (now - lastErrorTime > ERROR_LOG_INTERVAL || reconnectAttempts === 1) {
                if (error.message?.includes('502') || error.message?.includes('Bad Gateway')) {
                    console.warn('⚠️ Crypto WebSocket: Backend non raggiungibile (502) - riprovo...');
                } else if (reconnectAttempts <= 3) {
                    // Log solo i primi 3 tentativi
                    console.warn(`⚠️ Crypto WebSocket connection error (tentativo ${reconnectAttempts}):`, error.message || error);
                }
                lastErrorTime = now;
            }
            
            setConnected(false);
            
            // Dopo molti tentativi falliti, ferma il logging
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.warn(`⚠️ Crypto WebSocket: Tentativi di riconnessione sospesi dopo ${MAX_RECONNECT_ATTEMPTS} tentativi`);
            }
        });

        // Crypto-specific events
        socket.on('crypto:position-opened', (data) => {
            console.log('📈 Position opened:', data);
            if (onPositionOpened) {
                onPositionOpened(data);
            }
        });

        socket.on('crypto:position-closed', (data) => {
            console.log('📉 Position closed:', data);
            if (onPositionClosed) {
                onPositionClosed(data);
            }
        });

        // ✅ NEW: Real-time price updates via WebSocket
        socket.on('crypto:prices-update', (data) => {
            // Emit custom event that components can listen to
            const event = new CustomEvent('crypto-prices-update', { 
                detail: data 
            });
            window.dispatchEvent(event);
        });

        // Cleanup on unmount
        return () => {
            if (socket) {
                socket.emit('crypto:leave-dashboard');
                socket.disconnect();
            }
        };
    }, []); // Only run on mount/unmount

    return { connected, socket: socketRef.current };
};

