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
        socket.on('connect', () => {
            console.log('✅ Crypto WebSocket connected');
            setConnected(true);
            
            // Join crypto dashboard room
            socket.emit('crypto:join-dashboard');
        });

        socket.on('crypto:joined', (data) => {
            console.log('✅ Joined crypto dashboard room:', data.room);
        });

        socket.on('disconnect', () => {
            console.log('❌ Crypto WebSocket disconnected');
            setConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Crypto WebSocket connection error:', error);
            setConnected(false);
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

