// ============================================================
// BetEngine — Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { BetEngine, BetEngineError } from '../engines/BetEngine.js';

describe('BetEngine', () => {
  let betEngine: BetEngine;

  beforeEach(() => {
    betEngine = new BetEngine();
  });

  describe('Place Bet', () => {
    it('should place a single bet successfully', () => {
      const bet = betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
      });

      expect(bet.betId).toBeTruthy();
      expect(bet.userId).toBe('user-1');
      expect(bet.roundId).toBe('round-1');
      expect(bet.amount).toBe(100);
      expect(bet.status).toBe('ACTIVE');
    });

    it('should place a bet with auto cashout', () => {
      const bet = betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
        autoCashoutMultiplier: 2.5,
      });

      expect(bet.autoCashoutAt).toBe(2.5);
    });

    it('should place a dual bet', () => {
      const bet = betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
        dualBetAmount: 50,
        dualAutoCashoutMultiplier: 3.0,
      });

      expect(bet.dualBetConfig).toBeTruthy();
      expect(bet.dualBetConfig!.amount).toBe(50);
      expect(bet.dualBetConfig!.autoCashoutAt).toBe(3.0);
    });

    it('should reject bet below minimum', () => {
      expect(() =>
        betEngine.placeBet({
          userId: 'user-1',
          roundId: 'round-1',
          amount: -1,
        }),
      ).toThrow(BetEngineError);
    });

    it('should track user active bets', () => {
      betEngine.placeBet({ userId: 'user-1', roundId: 'round-1', amount: 100 });
      betEngine.placeBet({ userId: 'user-1', roundId: 'round-1', amount: 200 });

      const activeBets = betEngine.getUserActiveBets('user-1');
      expect(activeBets).toHaveLength(2);
    });
  });

  describe('Cashout', () => {
    it('should cashout a bet correctly', () => {
      const bet = betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
      });

      const result = betEngine.cashout(bet.betId, 2.5);
      expect(result).toBeTruthy();
      expect(result!.amount).toBe(100);
      expect(result!.multiplier).toBe(2.5);
      expect(result!.payout).toBe(250); // 100 * 2.5
    });

    it('should return null for non-existent bet', () => {
      const result = betEngine.cashout('nonexistent', 1.5);
      expect(result).toBeNull();
    });

    it('should return null for already cashed-out bet', () => {
      const bet = betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
      });

      betEngine.cashout(bet.betId, 2.0);
      const second = betEngine.cashout(bet.betId, 3.0);
      expect(second).toBeNull();
    });
  });

  describe('Auto Cashout Detection', () => {
    it('should detect auto cashout trigger', () => {
      betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
        autoCashoutMultiplier: 2.0,
      });

      const toCashout = betEngine.checkAutoCashouts(2.0);
      expect(toCashout).toHaveLength(1);
      expect(toCashout[0].autoCashoutAt).toBe(2.0);
    });

    it('should not trigger below threshold', () => {
      betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
        autoCashoutMultiplier: 5.0,
      });

      const toCashout = betEngine.checkAutoCashouts(3.0);
      expect(toCashout).toHaveLength(0);
    });

    it('should not trigger bets without auto cashout', () => {
      betEngine.placeBet({
        userId: 'user-1',
        roundId: 'round-1',
        amount: 100,
      });

      const toCashout = betEngine.checkAutoCashouts(999);
      expect(toCashout).toHaveLength(0);
    });
  });

  describe('Round End Settlement', () => {
    it('should settle all remaining bets as lost', () => {
      betEngine.placeBet({ userId: 'user-1', roundId: 'round-1', amount: 100 });
      betEngine.placeBet({ userId: 'user-2', roundId: 'round-1', amount: 200 });

      const lost = betEngine.settleRemainingBets('round-1');
      expect(lost).toHaveLength(2);
      expect(lost[0].status).toBe('LOST');
      expect(lost[1].status).toBe('LOST');
    });

    it('should not affect bets on other rounds', () => {
      betEngine.placeBet({ userId: 'user-1', roundId: 'round-1', amount: 100 });
      betEngine.placeBet({ userId: 'user-1', roundId: 'round-2', amount: 200 });

      const lost = betEngine.settleRemainingBets('round-1');
      expect(lost).toHaveLength(1);

      const activeBets = betEngine.getUserActiveBets('user-1');
      expect(activeBets).toHaveLength(1);
      expect(activeBets[0].roundId).toBe('round-2');
    });
  });

  describe('Auto Bet Configuration', () => {
    it('should set and retrieve auto bet config', () => {
      betEngine.setAutoBet({
        userId: 'user-1',
        enabled: true,
        baseAmount: 100,
        multiplier: 2,
        autoCashoutMultiplier: 2.5,
        onLoss: 'double',
        onWin: 'reset',
        maxRounds: 10,
        currentRounds: 0,
      });

      const config = betEngine.getAutoBet('user-1');
      expect(config).toBeTruthy();
      expect(config!.baseAmount).toBe(100);
    });

    it('should disable auto bet', () => {
      betEngine.setAutoBet({
        userId: 'user-1',
        enabled: true,
        baseAmount: 100,
        multiplier: 1,
        autoCashoutMultiplier: null,
        onLoss: 'same',
        onWin: 'same',
        maxRounds: 10,
        currentRounds: 0,
      });

      betEngine.disableAutoBet('user-1');
      const config = betEngine.getAutoBet('user-1');
      expect(config!.enabled).toBe(false);
    });

    it('should calculate next bet after win', () => {
      betEngine.setAutoBet({
        userId: 'user-1',
        enabled: true,
        baseAmount: 100,
        multiplier: 2,
        autoCashoutMultiplier: null,
        onLoss: 'double',
        onWin: 'increase',
        maxRounds: 10,
        currentRounds: 0,
      });

      const next = betEngine.calculateNextBetAmount('user-1', true, 100);
      expect(next).toBe(200); // onWin: 'increase' means 2 * 100
    });

    it('should calculate next bet after loss', () => {
      betEngine.setAutoBet({
        userId: 'user-1',
        enabled: true,
        baseAmount: 100,
        multiplier: 1,
        autoCashoutMultiplier: null,
        onLoss: 'double',
        onWin: 'same',
        maxRounds: 10,
        currentRounds: 0,
      });

      const next = betEngine.calculateNextBetAmount('user-1', false, 100);
      expect(next).toBe(200); // onLoss: 'double' means 2 * 100
    });

    it('should return null when max rounds reached', () => {
      betEngine.setAutoBet({
        userId: 'user-1',
        enabled: true,
        baseAmount: 100,
        multiplier: 1,
        autoCashoutMultiplier: null,
        onLoss: 'same',
        onWin: 'same',
        maxRounds: 1,
        currentRounds: 1,
      });

      const next = betEngine.calculateNextBetAmount('user-1', true, 100);
      expect(next).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should clean up all user bets', () => {
      betEngine.placeBet({ userId: 'user-1', roundId: 'round-1', amount: 100 });
      betEngine.cleanUserBets('user-1');

      const activeBets = betEngine.getUserActiveBets('user-1');
      expect(activeBets).toHaveLength(0);
    });
  });
});