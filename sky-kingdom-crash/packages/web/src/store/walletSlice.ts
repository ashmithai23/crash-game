// ============================================================
// Wallet State Slice
// ============================================================

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WalletState {
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  isConnected: boolean;
  betAmount: number;
  autoCashoutMultiplier: number | null;
  dualBetEnabled: boolean;
  dualBetAmount: number;
  dualAutoCashoutMultiplier: number | null;
  autoBetEnabled: boolean;
  autoBetConfig: {
    baseAmount: number;
    multiplier: number;
    autoCashoutMultiplier: number | null;
    onLoss: 'same' | 'double' | 'reset';
    onWin: 'same' | 'increase' | 'reset';
    maxRounds: number;
  } | null;
}

const initialState: WalletState = {
  balance: 0,
  reservedBalance: 0,
  availableBalance: 0,
  isConnected: false,
  betAmount: 10,
  autoCashoutMultiplier: null,
  dualBetEnabled: false,
  dualBetAmount: 5,
  dualAutoCashoutMultiplier: null,
  autoBetEnabled: false,
  autoBetConfig: null,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalance(state, action: PayloadAction<{
      balance: number;
      reservedBalance: number;
      availableBalance: number;
    }>) {
      state.balance = action.payload.balance;
      state.reservedBalance = action.payload.reservedBalance;
      state.availableBalance = action.payload.availableBalance;
      state.isConnected = true;
    },

    setBetAmount(state, action: PayloadAction<number>) {
      state.betAmount = Math.max(1, action.payload);
    },

    setAutoCashoutMultiplier(state, action: PayloadAction<number | null>) {
      state.autoCashoutMultiplier = action.payload;
    },

    toggleDualBet(state) {
      state.dualBetEnabled = !state.dualBetEnabled;
    },

    setDualBetAmount(state, action: PayloadAction<number>) {
      state.dualBetAmount = Math.max(1, action.payload);
    },

    setDualAutoCashoutMultiplier(state, action: PayloadAction<number | null>) {
      state.dualAutoCashoutMultiplier = action.payload;
    },

    toggleAutoBet(state) {
      state.autoBetEnabled = !state.autoBetEnabled;
    },

    setAutoBetConfig(state, action: PayloadAction<WalletState['autoBetConfig']>) {
      state.autoBetConfig = action.payload;
    },
  },
});

export const {
  setBalance,
  setBetAmount,
  setAutoCashoutMultiplier,
  toggleDualBet,
  setDualBetAmount,
  setDualAutoCashoutMultiplier,
  toggleAutoBet,
  setAutoBetConfig,
} = walletSlice.actions;

export default walletSlice.reducer;