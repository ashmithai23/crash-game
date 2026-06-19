// ============================================================
// BetEngine — Bet Lifecycle Management
// ============================================================
// Handles:
//   - Single bets
//   - Dual bets (two bets per round)
//   - Auto-bet sequences
//   - Auto-cashout triggers
//   - Conditional rebet logic
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { GAME_CONFIG } from '@sky-kingdom/shared';
import type { BetData, BetStatus } from '@sky-kingdom/shared';

interface ActiveBet {
  betId: string;
  userId: string;
  roundId: string;
  amount: number;
  autoCashoutAt: number | null;
  dualBetConfig: {
    amount: number;
    autoCashoutAt: number | null;
  } | null;
  placedAt: number;
  status: 'ACTIVE';
}

interface AutoBetConfig {
  userId: string;
  enabled: boolean;
  baseAmount: number;
  multiplier: number;
  autoCashoutMultiplier: number | null;
  onLoss: 'same' | 'double' | 'reset';
  onWin: 'same' | 'increase' | 'reset';
  maxRounds: number;
  currentRounds: number;
}

export class BetEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'BetEngineError';
  }
}

export class BetEngine {
  private activeBets: Map<string, ActiveBet> = new Map();
  private userActiveBets: Map<string, string[]> = new Map();   // userId → betIds
  private autoBetConfigs: Map<string, AutoBetConfig> = new Map();
  private completedBets: BetData[] = [];

  // ─── Place Bet ─────────────────────────────────────────────

  /**
   * Place a bet on the current round.
   */
  placeBet(params: {
    userId: string;
    roundId: string;
    amount: number;
    autoCashoutMultiplier?: number;
    dualBetAmount?: number;
    dualAutoCashoutMultiplier?: number;
  }): ActiveBet {
    const {
      userId,
      roundId,
      amount,
      autoCashoutMultiplier,
      dualBetAmount,
      dualAutoCashoutMultiplier,
    } = params;

    // Validate bet amount
    if (amount < GAME_CONFIG.MIN_BET || amount > GAME_CONFIG.MAX_BET) {
      throw new BetEngineError(
        `Bet amount must be between ${GAME_CONFIG.MIN_BET} and ${GAME_CONFIG.MAX_BET}`,
        'INVALID_AMOUNT',
        { amount },
      );
    }

    // Validate auto cashout
    if (autoCashoutMultiplier !== undefined) {
      if (
        autoCashoutMultiplier < GAME_CONFIG.AUTO_CASHOUT_MIN ||
        autoCashoutMultiplier > GAME_CONFIG.AUTO_CASHOUT_MAX
      ) {
        throw new BetEngineError(
          `Auto cashout must be between ${GAME_CONFIG.AUTO_CASHOUT_MIN}x and ${GAME_CONFIG.AUTO_CASHOUT_MAX}x`,
          'INVALID_AUTO_CASHOUT',
          { autoCashoutMultiplier },
        );
      }
    }

    // Validate dual bet
    if (dualBetAmount !== undefined && dualBetAmount !== null) {
      if (dualBetAmount < GAME_CONFIG.MIN_BET || dualBetAmount > GAME_CONFIG.MAX_BET) {
        throw new BetEngineError(
          `Dual bet amount must be between ${GAME_CONFIG.MIN_BET} and ${GAME_CONFIG.MAX_BET}`,
          'INVALID_DUAL_AMOUNT',
          { dualBetAmount },
        );
      }
    }

    const betId = this.generateBetId();

    const bet: ActiveBet = {
      betId,
      userId,
      roundId,
      amount,
      autoCashoutAt: autoCashoutMultiplier ?? null,
      dualBetConfig: dualBetAmount
        ? {
            amount: dualBetAmount,
            autoCashoutAt: dualAutoCashoutMultiplier ?? null,
          }
        : null,
      placedAt: Date.now(),
      status: 'ACTIVE',
    };

    this.activeBets.set(betId, bet);

    // Track user's active bets
    const userBets = this.userActiveBets.get(userId) ?? [];
    userBets.push(betId);
    this.userActiveBets.set(userId, userBets);

    return bet;
  }

  // ─── Cashout ────────────────────────────────────────────────

  /**
   * Cash out a specific bet.
   * @returns Cashout details including final amount and payout.
   */
  cashout(betId: string, currentMultiplier: number): {
    betId: string;
    amount: number;
    multiplier: number;
    payout: number;
    dualBetAmount: number | null;
    dualPayout: number | null;
  } | null {
    const bet = this.activeBets.get(betId);
    if (!bet) return null;

    const payout = this.calculatePayout(bet.amount, currentMultiplier);
    let dualPayout: number | null = null;

    if (bet.dualBetConfig) {
      dualPayout = this.calculatePayout(bet.dualBetConfig.amount, currentMultiplier);
    }

    // Move to completed
    this.completedBets.push({
      id: bet.betId,
      userId: bet.userId,
      roundId: bet.roundId,
      amount: bet.amount,
      autoCashoutMultiplier: bet.autoCashoutAt,
      dualBetAmount: bet.dualBetConfig?.amount ?? null,
      dualCashoutMultiplier: bet.dualBetConfig?.autoCashoutAt ?? null,
      status: 'CASHED_OUT',
      cashoutMultiplier: currentMultiplier,
      payout,
      placedAt: bet.placedAt,
      cashedOutAt: Date.now(),
    });

    this.activeBets.delete(betId);

    return {
      betId: bet.betId,
      amount: bet.amount,
      multiplier: currentMultiplier,
      payout,
      dualBetAmount: bet.dualBetConfig?.amount ?? null,
      dualPayout,
    };
  }

  // ─── Auto Cashout Check ─────────────────────────────────────

  /**
   * Check all active bets for auto-cashout triggers at the current multiplier.
   * Returns list of bets that should be cashed out.
   */
  checkAutoCashouts(currentMultiplier: number): Array<{
    betId: string;
    userId: string;
    autoCashoutAt: number;
  }> {
    const toCashout: Array<{
      betId: string;
      userId: string;
      autoCashoutAt: number;
    }> = [];

    for (const [betId, bet] of this.activeBets) {
      if (bet.autoCashoutAt !== null && currentMultiplier >= bet.autoCashoutAt) {
        toCashout.push({
          betId,
          userId: bet.userId,
          autoCashoutAt: bet.autoCashoutAt,
        });
      }

      // Check dual bet auto-cashout
      if (
        bet.dualBetConfig?.autoCashoutAt !== null &&
        bet.dualBetConfig?.autoCashoutAt !== undefined &&
        currentMultiplier >= bet.dualBetConfig.autoCashoutAt
      ) {
        toCashout.push({
          betId,
          userId: bet.userId,
          autoCashoutAt: bet.dualBetConfig.autoCashoutAt,
        });
      }
    }

    return toCashout;
  }

  // ─── Round End / Loss Processing ───────────────────────────

  /**
   * Settle all remaining active bets for a round (they lose).
   */
  settleRemainingBets(roundId: string): BetData[] {
    const lostBets: BetData[] = [];

    for (const [betId, bet] of this.activeBets) {
      if (bet.roundId !== roundId) continue;

      const lostBet: BetData = {
        id: bet.betId,
        userId: bet.userId,
        roundId: bet.roundId,
        amount: bet.amount,
        autoCashoutMultiplier: bet.autoCashoutAt,
        dualBetAmount: bet.dualBetConfig?.amount ?? null,
        dualCashoutMultiplier: bet.dualBetConfig?.autoCashoutAt ?? null,
        status: 'LOST',
        cashoutMultiplier: null,
        payout: null,
        placedAt: bet.placedAt,
        cashedOutAt: null,
      };

      this.completedBets.push(lostBet);
      this.activeBets.delete(betId);
      lostBets.push(lostBet);

      // Clean up user tracking
      const userBets = this.userActiveBets.get(bet.userId) ?? [];
      this.userActiveBets.set(
        bet.userId,
        userBets.filter((b) => b !== betId),
      );
    }

    return lostBets;
  }

  // ─── User & Round Queries ──────────────────────────────────

  /**
   * Get all active bets for a user.
   */
  getUserActiveBets(userId: string): ActiveBet[] {
    const betIds = this.userActiveBets.get(userId) ?? [];
    return betIds
      .map((id) => this.activeBets.get(id))
      .filter((bet): bet is ActiveBet => bet !== undefined);
  }

  /**
   * Check if a user has active bets on the current round.
   */
  hasActiveBets(userId: string): boolean {
    const betIds = this.userActiveBets.get(userId) ?? [];
    return betIds.some((id) => this.activeBets.has(id));
  }

  /**
   * Get completed bets for a user.
   */
  getUserCompletedBets(userId: string, limit: number = 20): BetData[] {
    return this.completedBets
      .filter((b) => b.userId === userId)
      .reverse()
      .slice(0, limit);
  }

  /**
   * Get all active bets on a round.
   */
  getRoundActiveBets(roundId: string): ActiveBet[] {
    const bets: ActiveBet[] = [];
    for (const bet of this.activeBets.values()) {
      if (bet.roundId === roundId) {
        bets.push(bet);
      }
    }
    return bets;
  }

  // ─── Auto Bet Configuration ────────────────────────────────

  /**
   * Configure auto-bet for a user.
   */
  setAutoBet(config: AutoBetConfig): void {
    this.autoBetConfigs.set(config.userId, config);
  }

  /**
   * Get auto-bet config for a user.
   */
  getAutoBet(userId: string): AutoBetConfig | undefined {
    return this.autoBetConfigs.get(userId);
  }

  /**
   * Disable auto-bet for a user.
   */
  disableAutoBet(userId: string): void {
    const config = this.autoBetConfigs.get(userId);
    if (config) {
      config.enabled = false;
      this.autoBetConfigs.set(userId, config);
    }
  }

  /**
   * Calculate the next bet amount based on win/loss and auto-bet strategy.
   */
  calculateNextBetAmount(
    userId: string,
    lastRoundWon: boolean,
    lastBetAmount: number,
  ): number | null {
    const config = this.autoBetConfigs.get(userId);
    if (!config || !config.enabled) return null;

    if (config.currentRounds >= config.maxRounds) {
      this.disableAutoBet(userId);
      return null;
    }

    let nextAmount: number;

    if (lastRoundWon) {
      switch (config.onWin) {
        case 'same':
          nextAmount = config.baseAmount;
          break;
        case 'increase':
          nextAmount = lastBetAmount * config.multiplier;
          break;
        case 'reset':
          nextAmount = config.baseAmount;
          break;
        default:
          nextAmount = config.baseAmount;
      }
    } else {
      switch (config.onLoss) {
        case 'same':
          nextAmount = config.baseAmount;
          break;
        case 'double':
          nextAmount = lastBetAmount * 2;
          break;
        case 'reset':
          nextAmount = config.baseAmount;
          break;
        default:
          nextAmount = config.baseAmount;
      }
    }

    config.currentRounds += 1;
    this.autoBetConfigs.set(userId, config);

    return Math.min(nextAmount, GAME_CONFIG.MAX_BET);
  }

  // ─── Helpers ───────────────────────────────────────────────

  private generateBetId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `bt_${timestamp}${random}`;
  }

  private calculatePayout(amount: number, multiplier: number): number {
    return Math.round(amount * multiplier * 100) / 100;
  }

  /**
   * Clean up stale bets (safety net for disconnects).
   */
  cleanUserBets(userId: string): void {
    const betIds = this.userActiveBets.get(userId) ?? [];
    for (const betId of betIds) {
      this.activeBets.delete(betId);
    }
    this.userActiveBets.delete(userId);
    this.autoBetConfigs.delete(userId);
  }
}

// ─── Production Singleton ─────────────────────────────────────
export const betEngine = new BetEngine();