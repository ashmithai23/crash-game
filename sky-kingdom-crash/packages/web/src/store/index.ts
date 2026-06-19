// ============================================================
// Redux Store
// ============================================================

import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import walletReducer from './walletSlice';
import characterReducer from './characterSlice';
import websocketReducer from './websocketSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    wallet: walletReducer,
    character: characterReducer,
    websocket: websocketReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['websocket/setSocket'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;