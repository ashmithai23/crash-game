// ============================================================
// Character State Slice
// ============================================================

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CharacterId, AnimationState, WorldId } from '@sky-kingdom/shared';

interface CharacterState {
  selectedCharacter: CharacterId;
  unlockedCharacters: CharacterId[];
  animationState: AnimationState;
  flightProgress: number;  // 0-100, how far along the flight path
  isFlying: boolean;
  skinId: string | null;
  effects: {
    trail: boolean;
    boost: boolean;
    particles: boolean;
    glow: boolean;
  };
}

const initialState: CharacterState = {
  selectedCharacter: 'baby_trump',
  unlockedCharacters: ['baby_trump', 'baby_modi'],
  animationState: 'IDLE',
  flightProgress: 0,
  isFlying: false,
  skinId: null,
  effects: {
    trail: true,
    boost: false,
    particles: true,
    glow: false,
  },
};

const characterSlice = createSlice({
  name: 'character',
  initialState,
  reducers: {
    selectCharacter(state, action: PayloadAction<CharacterId>) {
      state.selectedCharacter = action.payload;
    },

    setAnimationState(state, action: PayloadAction<AnimationState>) {
      state.animationState = action.payload;
    },

    setFlightProgress(state, action: PayloadAction<number>) {
      state.flightProgress = Math.min(100, Math.max(0, action.payload));
    },

    setFlying(state, action: PayloadAction<boolean>) {
      state.isFlying = action.payload;
    },

    setSkin(state, action: PayloadAction<string | null>) {
      state.skinId = action.payload;
    },

    setEffects(state, action: PayloadAction<Partial<CharacterState['effects']>>) {
      state.effects = { ...state.effects, ...action.payload };
    },

    unlockCharacter(state, action: PayloadAction<CharacterId>) {
      if (!state.unlockedCharacters.includes(action.payload)) {
        state.unlockedCharacters.push(action.payload);
      }
    },

    resetCharacter(state) {
      state.animationState = 'IDLE';
      state.flightProgress = 0;
      state.isFlying = false;
      state.effects = { trail: true, boost: false, particles: true, glow: false };
    },
  },
});

export const {
  selectCharacter,
  setAnimationState,
  setFlightProgress,
  setFlying,
  setSkin,
  setEffects,
  unlockCharacter,
  resetCharacter,
} = characterSlice.actions;

export default characterSlice.reducer;