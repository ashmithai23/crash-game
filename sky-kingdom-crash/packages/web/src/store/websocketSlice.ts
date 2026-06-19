// ============================================================
// WebSocket State Slice
// ============================================================

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Socket } from 'socket.io-client';

interface WebsocketState {
  connected: boolean;
  socketId: string | null;
  socket: Socket | null;
  reconnectAttempts: number;
  lastPing: number | null;
  latency: number | null;
}

const initialState: WebsocketState = {
  connected: false,
  socketId: null,
  socket: null,
  reconnectAttempts: 0,
  lastPing: null,
  latency: null,
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
      if (action.payload) {
        state.reconnectAttempts = 0;
      }
    },

    setSocket(state, action: PayloadAction<Socket | null>) {
      state.socket = action.payload;
      state.socketId = action.payload?.id ?? null;
    },

    incrementReconnect(state) {
      state.reconnectAttempts += 1;
    },

    setLatency(state, action: PayloadAction<number>) {
      state.latency = action.payload;
      state.lastPing = Date.now();
    },
  },
});

export const {
  setConnected,
  setSocket,
  incrementReconnect,
  setLatency,
} = websocketSlice.actions;

export default websocketSlice.reducer;