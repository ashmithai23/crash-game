// ============================================================
// WebSocket Hook — Socket.IO Connection Manager
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setConnected, setSocket, setLatency, incrementReconnect } from '../store/websocketSlice';
import { setMultiplier, onCrash, onRoundStart, onRoundEnd } from '../store/gameSlice';
import { setBalance } from '../store/walletSlice';
import { WsEvent } from '@sky-kingdom/shared';

const SOCKET_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

export function useSocket() {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const connected = useAppSelector((state) => state.websocket.connected);
  const socket = useAppSelector((state) => state.websocket.socket);

  useEffect(() => {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem('auth_token');
    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => {
      dispatch(setConnected(true));
      dispatch(setSocket(s));
      console.log('[WS] Connected:', s.id);
    });

    s.on('disconnect', (reason) => {
      dispatch(setConnected(false));
      console.log('[WS] Disconnected:', reason);
    });

    s.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
      dispatch(incrementReconnect());
    });

    // ─── Game Events ─────────────────────────────────────
    s.on(WsEvent.ROUND_START, (data) => {
      dispatch(onRoundStart(data));
    });

    s.on(WsEvent.MULTIPLIER_UPDATE, (data) => {
      dispatch(setMultiplier(data));
    });

    s.on(WsEvent.CRASH_EVENT, (data) => {
      dispatch(onCrash(data));
    });

    s.on(WsEvent.ROUND_RESULT, (data) => {
      dispatch(onRoundEnd(data));
    });

    s.on(WsEvent.BALANCE_UPDATE, (data) => {
      dispatch(setBalance(data));
    });

    // ─── Error Handling ──────────────────────────────────
    s.on(WsEvent.ERROR, (data) => {
      console.error('[WS] Server error:', data);
    });

    s.on('connect_error', () => {
      // Already handled above
    });

    socketRef.current = s;

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      dispatch(setConnected(false));
      dispatch(setSocket(null));
    };
  }, [dispatch]);

  // ─── Event Emitters ────────────────────────────────────
  const emit = useCallback(
    (event: string, data?: unknown, callback?: (response: any) => void) => {
      if (socket?.connected) {
        socket.emit(event, data, callback);
      }
    },
    [socket],
  );

  const placeBet = useCallback(
    (roundId: string, amount: number, autoCashoutMultiplier?: number, dualBetAmount?: number, dualAutoCashoutMultiplier?: number) => {
      return new Promise<{ success: boolean; betId?: string; error?: string }>((resolve) => {
        if (!socket?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }
        socket.emit(WsEvent.PLACE_BET, {
          roundId,
          amount,
          autoCashoutMultiplier,
          dualBetAmount,
          dualAutoCashoutMultiplier,
        } as any, (response: any) => {
          resolve(response ?? { success: false, error: 'No response' });
        });
      });
    },
    [socket],
  );

  const cashout = useCallback(
    (roundId: string, betId: string) => {
      return new Promise<{ success: boolean; payout?: number; error?: string }>((resolve) => {
        if (!socket?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }
        socket.emit(WsEvent.MANUAL_CASHOUT, {
          roundId,
          betId,
        } as any, (response: any) => {
          resolve(response ?? { success: false, error: 'No response' });
        });
      });
    },
    [socket],
  );

  const sendChatMessage = useCallback(
    (message: string) => {
      socket?.emit(WsEvent.CHAT_MESSAGE, { message });
    },
    [socket],
  );

  return {
    connected,
    socket,
    emit,
    placeBet,
    cashout,
    sendChatMessage,
  };
}