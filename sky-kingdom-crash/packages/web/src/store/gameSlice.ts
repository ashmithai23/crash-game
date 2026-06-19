// ============================================================
// Game State Slice
// ============================================================

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GameState } from '@sky-kingdom/shared';
import type { WorldId, AnimationState } from '@sky-kingdom/shared';

interface GameStateData {
  roundId: string | null;
  roundNumber: number;
  state: GameState;
  currentMultiplier: number;
  crashMultiplier: number | null;
  elapsed: number;
  world: WorldId;
  animation: AnimationState;
  countdown: number;
  lastCrashMultiplier: number | null;
  roundHistory: Array<{
    roundNumber: number;
    crashMultiplier: number;
  }>;
}

const initialState: GameStateData = {
  roundId: null,
  roundNumber: 0,
  state: GameState.WAITING,
  currentMultiplier: 1.0,
  crashMultiplier: null,
  elapsed: 0,
  world: 'low_sky',
  animation: 'IDLE',
  countdown: 0,
  lastCrashMultiplier: null,
  roundHistory: [],
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setRoundState(state, action: PayloadAction<Partial<GameStateData>>) {
      return { ...state, ...action.payload };
    },

    setGameState(state, action: PayloadAction<GameState>) {
      state.state = action.payload;
    },

    setMultiplier(state, action: PayloadAction<{ multiplier: number; elapsed: number; world: WorldId; animation: AnimationState }>) {
      state.currentMultiplier = action.payload.multiplier;
      state.elapsed = action.payload.elapsed;
      state.world = action.payload.world;
      state.animation = action.payload.animation;
    },

    setRoundId(state, action: PayloadAction<string>) {
      state.roundId = action.payload;
    },

    onCrash(state, action: PayloadAction<{ crashMultiplier: number }>) {
      state.state = GameState.CRASHED;
      state.crashMultiplier = action.payload.crashMultiplier;
      state.lastCrashMultiplier = action.payload.crashMultiplier;
    },

    onRoundStart(state, action: PayloadAction<{ roundId: string; roundNumber: number; startsAt: number; bettingTime: number }>) {
      state.roundId = action.payload.roundId;
      state.roundNumber = action.payload.roundNumber;
      state.state = GameState.BETTING;
      state.currentMultiplier = 1.0;
      state.elapsed = 0;
      state.world = 'low_sky';
      state.animation = 'COUNTDOWN';
      state.crashMultiplier = null;
    },

    onRoundEnd(state, action: PayloadAction<{ roundNumber: number; crashMultiplier: number }>) {
      state.roundHistory.unshift({
        roundNumber: action.payload.roundNumber,
        crashMultiplier: action.payload.crashMultiplier,
      });
      // Keep last 20 rounds
      if (state.roundHistory.length > 20) {
        state.roundHistory.pop();
      }
    },

    setCountdown(state, action: PayloadAction<number>) {
      state.countdown = action.payload;
    },

    setWorld(state, action: PayloadAction<WorldId>) {
      state.world = action.payload;
    },
  },
});

export const {
  setRoundState,
  setGameState,
  setMultiplier,
  setRoundId,
  onCrash,
  onRoundStart,
  onRoundEnd,
  setCountdown,
  setWorld,
} = gameSlice.actions;

export default gameSlice.reducer;