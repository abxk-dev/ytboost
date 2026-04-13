import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

import { BACKEND_ORIGIN } from '../config/apiConfig';

const SOCKET_URL = BACKEND_ORIGIN || '';

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!SOCKET_URL) return;
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const joinPaymentSession = useCallback((sessionId) => {
    if (socketRef.current) {
      socketRef.current.emit('join_payment_session', sessionId);
    }
  }, []);

  const leavePaymentSession = useCallback((sessionId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_payment_session', sessionId);
    }
  }, []);

  const joinUserRoom = useCallback((userId) => {
    if (socketRef.current) {
      socketRef.current.emit('join_user_room', userId);
    }
  }, []);

  const onPaymentDetected = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('payment_detected', callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off('payment_detected', callback);
      }
    };
  }, []);

  const onPaymentConfirmed = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('payment_confirmed', callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off('payment_confirmed', callback);
      }
    };
  }, []);

  const onPaymentCredited = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('payment_credited', callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off('payment_credited', callback);
      }
    };
  }, []);

  const onBalanceUpdated = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('balance_updated', callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off('balance_updated', callback);
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    joinPaymentSession,
    leavePaymentSession,
    joinUserRoom,
    onPaymentDetected,
    onPaymentConfirmed,
    onPaymentCredited,
    onBalanceUpdated,
  };
}
