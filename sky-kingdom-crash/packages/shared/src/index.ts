// ============================================================
// Sky Kingdom Crash — Shared Types & Constants
// ============================================================

// ─── Game States ──────────────────────────────────────────────
export enum GameState {
  WAITING = 'WAITING',
  BETTING = 'BETTING',
  LOCKED = 'LOCKED',
  COUNTDOWN = 'COUNTDOWN',
  LAUNCH = 'LAUNCH',
  FLYING = 'FLYING',
  CRASHED = 'CRASHED',
  RESULTS = 'RESULTS',
  RESTARTING = 'RESTARTING',
}

// ─── Character Definitions ────────────────────────────────────
export type CharacterId =
  | 'baby_trump'
  | 'baby_modi'
  | 'baby_boris'
  | 'baby_trudeau'
  | 'baby_shinzo';

export type AnimationState =
  | 'IDLE'
  | 'COUNTDOWN'
  | 'LAUNCH'
  | 'FLYING'
  | 'BOOST'
  | 'SUPERSONIC'
  | 'VICTORY'
  | 'CRASH'
  | 'RESPAWN';

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  animations: Record<AnimationState, string>;
  boostColor: string;
  trailColor: string;
}

export interface SkinConfig {
  id: string;
  characterId: CharacterId;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  previewUrl: string;
  unlocked: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// ─── Environment Definitions ──────────────────────────────────
export type WorldId =
  | 'low_sky'
  | 'cloud_layer'
  | 'storm_zone'
  | 'stratosphere'
  | 'space'
  | 'cosmic_dimension';

export interface EnvironmentConfig {
  id: WorldId;
  name: string;
  minMultiplier: number;
  backgroundColor: string;
  backgroundGradient: string[];
  particles: boolean;
  particleCount: number;
  effects: string[];
  musicTrack: string;
}

export const ENVIRONMENTS: Record<WorldId, EnvironmentConfig> = {
  low_sky: {
    id: 'low_sky',
    name: 'Low Sky',
    minMultiplier: 1.0,
    backgroundColor: '#87CEEB',
    backgroundGradient: ['#87CEEB', '#4A90D9'],
    particles: true,
    particleCount: 20,
    effects: ['clouds', 'sun_rays'],
    musicTrack: 'peaceful_sky',
  },
  cloud_layer: {
    id: 'cloud_layer',
    name: 'Cloud Layer',
    minMultiplier: 2.0,
    backgroundColor: '#C8D8E8',
    backgroundGradient: ['#C8D8E8', '#A0B8D0'],
    particles: true,
    particleCount: 40,
    effects: ['volumetric_clouds', 'wind'],
    musicTrack: 'cloud_journey',
  },
  storm_zone: {
    id: 'storm_zone',
    name: 'Storm Zone',
    minMultiplier: 5.0,
    backgroundColor: '#2C3E50',
    backgroundGradient: ['#2C3E50', '#1A1A2E'],
    particles: true,
    particleCount: 80,
    effects: ['lightning', 'rain', 'turbulence'],
    musicTrack: 'storm_ascent',
  },
  stratosphere: {
    id: 'stratosphere',
    name: 'Stratosphere',
    minMultiplier: 25.0,
    backgroundColor: '#0D0D2B',
    backgroundGradient: ['#0D0D2B', '#1B1B4B'],
    particles: true,
    particleCount: 60,
    effects: ['aurora', 'sun_rays', 'ice_crystals'],
    musicTrack: 'stratospheric',
  },
  space: {
    id: 'space',
    name: 'Space',
    minMultiplier: 50.0,
    backgroundColor: '#000011',
    backgroundGradient: ['#000011', '#0A0A2E'],
    particles: true,
    particleCount: 150,
    effects: ['stars', 'nebula', 'space_dust'],
    musicTrack: 'space_journey',
  },
  cosmic_dimension: {
    id: 'cosmic_dimension',
    name: 'Cosmic Dimension',
    minMultiplier: 100.0,
    backgroundColor: '#000000',
    backgroundGradient: ['#000000', '#1A0033'],
    particles: true,
    particleCount: 300,
    effects: ['galaxy', 'cosmic_dust', 'star_bursts', 'time_warp'],
    musicTrack: 'cosmic_ascension',
  },
};

// ─── Multiplier Thresholds ────────────────────────────────────
export const MULTIPLIER_THRESHOLDS = [
  { min: 1.0, max: 2.0, animation: 'FLYING' as AnimationState, world: 'low_sky' as WorldId },
  { min: 2.0, max: 5.0, animation: 'FLYING' as AnimationState, world: 'cloud_layer' as WorldId },
  { min: 5.0, max: 10.0, animation: 'BOOST' as AnimationState, world: 'storm_zone' as WorldId },
  { min: 10.0, max: 25.0, animation: 'SUPERSONIC' as AnimationState, world: 'storm_zone' as WorldId },
  { min: 25.0, max: 50.0, animation: 'SUPERSONIC' as AnimationState, world: 'stratosphere' as WorldId },
  { min: 50.0, max: 100.0, animation: 'SUPERSONIC' as AnimationState, world: 'space' as WorldId },
  { min: 100.0, max: Infinity, animation: 'SUPERSONIC' as AnimationState, world: 'cosmic_dimension' as WorldId },
];

// ─── WebSocket Events ─────────────────────────────────────────
export enum WsEvent {
  CONNECT = 'CONNECT',
  DISCONNECT = 'DISCONNECT',
  ROUND_START = 'ROUND_START',
  ROUND_LOCK = 'ROUND_LOCK',
  ROUND_STATE = 'ROUND_STATE',
  MULTIPLIER_UPDATE = 'MULTIPLIER_UPDATE',
  PLACE_BET = 'PLACE_BET',
  BET_CONFIRMED = 'BET_CONFIRMED',
  BET_ERROR = 'BET_ERROR',
  AUTO_BET = 'AUTO_BET',
  AUTO_CASHOUT = 'AUTO_CASHOUT',
  MANUAL_CASHOUT = 'MANUAL_CASHOUT',
  CASHOUT_SUCCESS = 'CASHOUT_SUCCESS',
  CRASH_EVENT = 'CRASH_EVENT',
  ROUND_RESULT = 'ROUND_RESULT',
  BALANCE_UPDATE = 'BALANCE_UPDATE',
  LEADERBOARD_UPDATE = 'LEADERBOARD_UPDATE',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_HISTORY = 'CHAT_HISTORY',
  ERROR = 'ERROR',
}

// ─── WebSocket Payloads ───────────────────────────────────────
export interface RoundStartPayload {
  roundId: string;
  roundNumber: number;
  startsAt: number;
  bettingTime: number;
}

export interface RoundLockPayload {
  roundId: string;
  lockedAt: number;
}

export interface MultiplierUpdatePayload {
  roundId: string;
  multiplier: number;
  elapsed: number;
  world: WorldId;
  animation: AnimationState;
}

export interface PlaceBetPayload {
  roundId: string;
  amount: number;
  autoCashoutMultiplier?: number;
  dualBet?: boolean;
  dualBetAmount?: number;
  dualAutoCashout?: number;
}

export interface BetConfirmedPayload {
  betId: string;
  roundId: string;
  amount: number;
  autoCashoutMultiplier?: number;
  confirmedAt: number;
}

export interface CashoutPayload {
  roundId: string;
  betId: string;
}

export interface CashoutSuccessPayload {
  betId: string;
  roundId: string;
  amount: number;
  multiplier: number;
  payout: number;
}

export interface CrashEventPayload {
  roundId: string;
  crashMultiplier: number;
  crashedAt: number;
}

export interface RoundResultPayload {
  roundId: string;
  roundNumber: number;
  crashMultiplier: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  roundHash: string;
  totalBets: number;
  totalPayouts: number;
}

export interface BalanceUpdatePayload {
  userId: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalProfit: number;
  totalBets: number;
  winRate: number;
  biggestWin: number;
  highestMultiplier: number;
}

export interface ChatMessagePayload {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
}

// ─── Seed / Fairness Types ────────────────────────────────────
export interface SeedPair {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RoundSeedData extends SeedPair {
  roundId: string;
  roundNumber: number;
  roundHash: string;
  crashPoint: number;
  revealed: boolean;
}

export interface VerificationResult {
  roundId: string;
  roundNumber: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  roundHash: string;
  crashPoint: number;
  verified: boolean;
}

// ─── Bet Types ────────────────────────────────────────────────
export type BetStatus = 'PENDING' | 'ACTIVE' | 'CASHED_OUT' | 'LOST' | 'REFUNDED';

export interface BetData {
  id: string;
  userId: string;
  roundId: string;
  amount: number;
  autoCashoutMultiplier: number | null;
  dualBetAmount: number | null;
  dualCashoutMultiplier: number | null;
  status: BetStatus;
  cashoutMultiplier: number | null;
  payout: number | null;
  placedAt: number;
  cashedOutAt: number | null;
}

// ─── Transaction Types ────────────────────────────────────────
export type TransactionType = 'BET' | 'CASHOUT' | 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND' | 'BONUS';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  referenceId?: string;
  idempotencyKey?: string;
  description?: string;
  createdAt: number;
  completedAt?: number;
}

// ─── User Types ────────────────────────────────────────────────
export interface UserData {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  googleId: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  selectedCharacter: CharacterId;
  unlockedCharacters: CharacterId[];
  createdAt: number;
  lastLoginAt: number;
}

export interface WalletData {
  userId: string;
  balance: number;
  reservedBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalBets: number;
  totalWinnings: number;
  updatedAt: number;
}

// ─── API Response Types ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Round History ────────────────────────────────────────────
export interface RoundHistoryEntry {
  roundId: string;
  roundNumber: number;
  crashMultiplier: number;
  totalBets: number;
  totalPlayers: number;
  endedAt: number;
}

// ─── Auth Types ───────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: UserData;
  wallet: WalletData;
  tokens: AuthTokens;
}

// ─── Configuration Constants ──────────────────────────────────
export const GAME_CONFIG = {
  ROUND_BETTING_TIME: 5000,    // 5 seconds betting phase
  ROUND_LOCK_DELAY: 1000,     // 1 second lock
  ROUND_COUNTDOWN: 3000,      // 3 second countdown
  ROUND_LAUNCH_DURATION: 500, // 0.5 second launch animation
  ROUND_RESTART_DELAY: 3000,  // 3 seconds between rounds
  TICK_RATE: 50,              // 50ms tick rate
  MAX_MULTIPLIER: 1000000,    // 1,000,000x cap
  MIN_BET: 1,
  MAX_BET: 100000,
  HOUSE_EDGE: 0.01,           // 1% house edge
  MAX_PLAYERS_PER_ROUND: 1000,
  AUTO_CASHOUT_MIN: 1.01,
  AUTO_CASHOUT_MAX: 10000,
  CHAT_MAX_LENGTH: 200,
  CHAT_COOLDOWN_MS: 1000,
  LEADERBOARD_UPDATE_INTERVAL: 10000,
} as const;