// ============================================================
// RoundEngine — Server-Authoritative Game Loop
// ============================================================
// Manages the complete round lifecycle:
//
//   WAITING → BETTING → LOCKED → COUNTDOWN → LAUNCH → FLYING → CRASHED → RESULTS → RESTARTING
//
// The server controls:
//   - crash point (from FairnessEngine)
//   - multiplier tick rate (50ms)
//   - round state transitions
//   - broadcast timing
// ============================================================

import { GAME_CONFIG, GameState } from '@sky-kingdom/shared';
import type {
  RoundStartPayload,
  RoundLockPayload,
  MultiplierUpdatePayload,
  CrashEventPayload,
  RoundResultPayload,
  RoundSeedData,
  WorldId,
  AnimationState,
} from '@sky-kingdom/shared';
import { fairnessEngine } from './FairnessEngine.js';
import { MULTIPLIER_THRESHOLDS } from '@sky-kingdom/shared';
import { EventEmitter } from 'node:events';

// ─── Types ───────────────────────────────────────────────────

export interface RoundState {
  roundId: string;
  roundNumber: number;
  state: GameState;
  crashMultiplier: number | null;
  currentMultiplier: number;
  elapsed: number;           // ms since launch
  seedData: RoundSeedData | null;
  totalBets: number;
  totalPayouts: number;
  activePlayers: number;
  startedAt: number | null;
  launchedAt: number | null;
  crashedAt: number | null;
  endedAt: number | null;
  world: WorldId;
  animation: AnimationState;
}

export type RoundEventType =
  | 'ROUND_START'
  | 'ROUND_LOCK'
  | 'COUNTDOWN_TICK'
  | 'LAUNCH'
  | 'MULTIPLIER_UPDATE'
  | 'THRESHOLD_CROSSED'
  | 'CRASH'
  | 'ROUND_END'
  | 'RESTART';

export interface RoundEvent {
  type: RoundEventType;
  roundId: string;
  timestamp: number;
  data?: unknown;
}

// ─── Engine ───────────────────────────────────────────────────

export class RoundEngine extends EventEmitter {
  private currentRound: RoundState | null = null;
  private roundCounter: number = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private stateTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private readonly tickRate = GAME_CONFIG.TICK_RATE;          // 50ms
  private readonly bettingTime = GAME_CONFIG.ROUND_BETTING_TIME;  // 5s
  private readonly lockDelay = GAME_CONFIG.ROUND_LOCK_DELAY;      // 1s
  private readonly countdownDuration = GAME_CONFIG.ROUND_COUNTDOWN; // 3s
  private readonly launchDuration = GAME_CONFIG.ROUND_LAUNCH_DURATION; // 0.5s
  private readonly restartDelay = GAME_CONFIG.ROUND_RESTART_DELAY; // 3s

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  // ─── Public API ───────────────────────────────────────────────

  getCurrentRound(): RoundState | null {
    return this.currentRound;
  }

  getRoundId(): string | null {
    return this.currentRound?.roundId ?? null;
  }

  getCurrentMultiplier(): number {
    return this.currentRound?.currentMultiplier ?? 0;
  }

  getGameState(): GameState {
    return this.currentRound?.state ?? GameState.WAITING;
  }

  isBettingOpen(): boolean {
    return this.currentRound?.state === GameState.BETTING;
  }

  /**
   * Start the game loop (first round).
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startNextRound();
  }

  /**
   * Stop the game loop gracefully.
   */
  stop(): void {
    this.isRunning = false;
    this.clearAllTimers();
    this.stopTickInterval();
    this.currentRound = null;
  }

  // ─── Round Lifecycle ─────────────────────────────────────────

  private startNextRound(): void {
    if (!this.isRunning) return;

    this.roundCounter++;
    const roundId = this.generateRoundId();

    const seedData = fairnessEngine.generateRoundSeed(
      roundId,
      this.roundCounter,
    );

    this.currentRound = {
      roundId,
      roundNumber: this.roundCounter,
      state: GameState.WAITING,
      crashMultiplier: seedData.crashPoint,
      currentMultiplier: 1.0,
      elapsed: 0,
      seedData,
      totalBets: 0,
      totalPayouts: 0,
      activePlayers: 0,
      startedAt: null,
      launchedAt: null,
      crashedAt: null,
      endedAt: null,
      world: 'low_sky',
      animation: 'IDLE',
    };

    // Emit round start (reveals server seed hash, not raw seed)
    this.emit('ROUND_START', {
      roundId,
      roundNumber: this.roundCounter,
      startsAt: Date.now(),
      bettingTime: this.bettingTime,
      seedData: {
        roundId: seedData.roundId,
        roundNumber: seedData.roundNumber,
        serverSeedHash: seedData.serverSeedHash,
        clientSeed: seedData.clientSeed,
        nonce: seedData.nonce,
        roundHash: seedData.roundHash,
      },
    } as RoundStartPayload & { seedData: Partial<RoundSeedData> });

    // Move to BETTING after a brief WAITING period
    this.scheduleStateTransition(GameState.BETTING, 500);
  }

  private enterBettingPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.BETTING;
    this.currentRound.startedAt = Date.now();
    this.currentRound.animation = 'COUNTDOWN';

    this.emit('ROUND_LOCK', {
      roundId: this.currentRound.roundId,
      lockedAt: Date.now(),
      bettingDeadline: Date.now() + this.bettingTime,
    } as RoundLockPayload & { bettingDeadline: number });

    // After betting phase, lock and countdown
    this.scheduleStateTransition(GameState.LOCKED, this.bettingTime);
  }

  private enterLockedPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.LOCKED;

    this.emit('ROUND_LOCK', {
      roundId: this.currentRound.roundId,
      lockedAt: Date.now(),
    } as RoundLockPayload);

    // Brief lock period then countdown
    this.scheduleStateTransition(GameState.COUNTDOWN, this.lockDelay);
  }

  private enterCountdownPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.COUNTDOWN;
    this.currentRound.animation = 'COUNTDOWN';

    // Emit countdown start
    this.emit('COUNTDOWN_TICK', {
      roundId: this.currentRound.roundId,
      countdownFrom: 3,
    });

    // After countdown, launch
    this.scheduleStateTransition(GameState.LAUNCH, this.countdownDuration);
  }

  private enterLaunchPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.LAUNCH;
    this.currentRound.animation = 'LAUNCH';
    this.currentRound.launchedAt = Date.now();

    this.emit('LAUNCH', {
      roundId: this.currentRound.roundId,
      launchedAt: this.currentRound.launchedAt,
    });

    // After brief launch animation, start flying
    this.scheduleStateTransition(GameState.FLYING, this.launchDuration);
  }

  private enterFlyingPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.FLYING;
    this.currentRound.animation = 'FLYING';
    this.currentRound.currentMultiplier = 1.0;
    this.currentRound.elapsed = 0;

    // Start multiplier ticks
    this.startTickInterval();
  }

  private enterCrashedPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.CRASHED;
    this.currentRound.animation = 'CRASH';
    this.currentRound.crashedAt = Date.now();

    this.stopTickInterval();

    const crashMultiplier = this.currentRound.crashMultiplier!;

    this.emit('CRASH', {
      roundId: this.currentRound.roundId,
      crashMultiplier,
      crashedAt: this.currentRound.crashedAt,
      finalMultiplier: this.currentRound.currentMultiplier,
    } as CrashEventPayload & { finalMultiplier: number });

    // Move to results
    this.scheduleStateTransition(GameState.RESULTS, 500);
  }

  private enterResultsPhase(): void {
    if (!this.currentRound) return;
    this.currentRound.state = GameState.RESULTS;
    this.currentRound.endedAt = Date.now();

    // Reveal the server seed
    if (this.currentRound.seedData) {
      this.currentRound.seedData = fairnessEngine.revealServerSeed(
        this.currentRound.seedData,
      );
    }

    this.emit('ROUND_END', {
      roundId: this.currentRound.roundId,
      roundNumber: this.currentRound.roundNumber,
      crashMultiplier: this.currentRound.crashMultiplier,
      serverSeed: this.currentRound.seedData?.serverSeed,
      serverSeedHash: this.currentRound.seedData?.serverSeedHash,
      clientSeed: this.currentRound.seedData?.clientSeed,
      nonce: this.currentRound.seedData?.nonce,
      roundHash: this.currentRound.seedData?.roundHash,
      totalBets: this.currentRound.totalBets,
      totalPayouts: this.currentRound.totalPayouts,
    } as RoundResultPayload);

    // Restart after delay
    this.scheduleStateTransition(GameState.RESTARTING, this.restartDelay);
  }

  private enterRestartingPhase(): void {
    this.currentRound = null;
    this.startNextRound();
  }

  // ─── Multiplier Ticking ─────────────────────────────────────

  private startTickInterval(): void {
    if (this.tickInterval) return;

    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.tickRate);
  }

  private stopTickInterval(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Main tick function — 50ms intervals.
   * Uses a logarithmic multiplier curve.
   */
  private tick(): void {
    if (!this.currentRound) return;
    if (this.currentRound.state !== GameState.FLYING) return;

    this.currentRound.elapsed += this.tickRate;

    // Logarithmic multiplier growth: e^(elapsed / divisor)
    // At 50ms ticks, this gives a smooth curve
    const seconds = this.currentRound.elapsed / 1000;
    const multiplier = Math.exp(seconds * 0.06); // ~e^(0.06t)
    const rounded = Math.round(multiplier * 100) / 100;

    this.currentRound.currentMultiplier = rounded;

    // Update world and animation based on multiplier
    this.updateVisualState(rounded);

    // Check crash condition
    if (rounded >= this.currentRound.crashMultiplier!) {
      this.enterCrashedPhase();
      return;
    }

    // Emit multiplier update
    this.emit('MULTIPLIER_UPDATE', {
      roundId: this.currentRound.roundId,
      multiplier: rounded,
      elapsed: this.currentRound.elapsed,
      world: this.currentRound.world,
      animation: this.currentRound.animation,
    } as MultiplierUpdatePayload);
  }

  // ─── Visual State Updates ────────────────────────────────────

  private updateVisualState(multiplier: number): void {
    if (!this.currentRound) return;

    for (const threshold of MULTIPLIER_THRESHOLDS) {
      if (multiplier >= threshold.min && multiplier < threshold.max) {
        const worldChanged = this.currentRound.world !== threshold.world;
        const animChanged = this.currentRound.animation !== threshold.animation;

        if (worldChanged || animChanged) {
          this.currentRound.world = threshold.world;
          this.currentRound.animation = threshold.animation;

          if (worldChanged) {
            this.emit('THRESHOLD_CROSSED', {
              roundId: this.currentRound.roundId,
              multiplier,
              world: threshold.world,
              animation: threshold.animation,
              elapsed: this.currentRound.elapsed,
            });
          }
        }
        break;
      }
    }
  }

  // ─── State Management ────────────────────────────────────────

  private scheduleStateTransition(nextState: GameState, delayMs: number): void {
    const timerKey = `transition_${nextState}`;
    const timer = setTimeout(() => {
      this.stateTimers.delete(timerKey);
      this.executeStateTransition(nextState);
    }, delayMs);

    this.stateTimers.set(timerKey, timer);
  }

  private executeStateTransition(nextState: GameState): void {
    switch (nextState) {
      case GameState.BETTING:
        this.enterBettingPhase();
        break;
      case GameState.LOCKED:
        this.enterLockedPhase();
        break;
      case GameState.COUNTDOWN:
        this.enterCountdownPhase();
        break;
      case GameState.LAUNCH:
        this.enterLaunchPhase();
        break;
      case GameState.FLYING:
        this.enterFlyingPhase();
        break;
      case GameState.CRASHED:
        this.enterCrashedPhase();
        break;
      case GameState.RESULTS:
        this.enterResultsPhase();
        break;
      case GameState.RESTARTING:
        this.enterRestartingPhase();
        break;
    }
  }

  private clearAllTimers(): void {
    for (const timer of this.stateTimers.values()) {
      clearTimeout(timer);
    }
    this.stateTimers.clear();
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private generateRoundId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `rd_${timestamp}${random}`;
  }

  /**
   * Register a bet on this round (tracking only — money handled by WalletEngine).
   */
  registerBet(amount: number): void {
    if (!this.currentRound) return;
    this.currentRound.totalBets += amount;
    this.currentRound.activePlayers += 1;
  }

  /**
   * Register a cashout on this round.
   */
  registerCashout(amount: number): void {
    if (!this.currentRound) return;
    this.currentRound.totalPayouts += amount;
  }

  /**
   * Check if a player can still place a bet.
   */
  canPlaceBet(): boolean {
    if (!this.currentRound) return false;
    return (
      this.currentRound.state === GameState.BETTING &&
      this.currentRound.activePlayers < GAME_CONFIG.MAX_PLAYERS_PER_ROUND
    );
  }
}

// ─── Production Singleton ─────────────────────────────────────
export const roundEngine = new RoundEngine();