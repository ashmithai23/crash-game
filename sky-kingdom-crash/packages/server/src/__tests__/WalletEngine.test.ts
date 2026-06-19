// ============================================================
// WalletEngine — Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { WalletEngine, WalletEngineError } from '../engines/WalletEngine.js';

describe('WalletEngine', () => {
  let wallet: WalletEngine;

  beforeEach(() => {
    wallet = new WalletEngine();
  });

  describe('Wallet Creation', () => {
    it('should create a wallet with initial balance', async () => {
      const w = await wallet.getOrCreateWallet('user-1', 10000);
      expect(w.userId).toBe('user-1');
      expect(w.balance).toBe(10000);
      expect(w.reservedBalance).toBe(0);
    });

    it('should return existing wallet without resetting', async () => {
      await wallet.getOrCreateWallet('user-1', 5000);
      const w = await wallet.getOrCreateWallet('user-1', 9999);
      expect(w.balance).toBe(5000); // original balance, not overwritten
    });

    it('should return null for non-existent wallet', async () => {
      const w = await wallet.getWallet('nonexistent');
      expect(w).toBeNull();
    });
  });

  describe('Balance Operations', () => {
    beforeEach(async () => {
      await wallet.getOrCreateWallet('user-1', 10000);
    });

    it('should get available balance', async () => {
      const avail = await wallet.getAvailableBalance('user-1');
      expect(avail).toBe(10000);
    });

    it('should reserve balance successfully', async () => {
      const result = await wallet.reserveBalance('user-1', 1000, 'reserve-1');
      expect(result.balanceBefore).toBe(10000);
      expect(result.balanceAfter).toBe(9000); // balance decreases, reserved increases

      const w = await wallet.getWallet('user-1');
      expect(w!.reservedBalance).toBe(1000);
      expect(w!.balance).toBe(9000);
    });

    it('should reject reserve when insufficient balance', async () => {
      await expect(
        wallet.reserveBalance('user-1', 99999, 'reserve-fail'),
      ).rejects.toThrow(WalletEngineError);
    });

    it('should reject reserve below minimum bet', async () => {
      await expect(
        wallet.reserveBalance('user-1', 0, 'reserve-too-small'),
      ).rejects.toThrow(WalletEngineError);
    });

    it('should settle cashout correctly', async () => {
      const reservation = await wallet.reserveBalance('user-1', 1000, 'cashout-r1');
      const w = await wallet.settleCashout('user-1', 1000, 2500, reservation.reservationId, 'cashout-settle');

      expect(w.balance).toBe(11500); // 10000 - 1000 + 2500 = 11500
      expect(w.reservedBalance).toBe(0);
      expect(w.totalWinnings).toBe(2500);
    });

    it('should settle loss correctly', async () => {
      const reservation = await wallet.reserveBalance('user-1', 500, 'loss-r1');
      const w = await wallet.settleLoss('user-1', 500, reservation.reservationId, 'loss-settle');

      expect(w.balance).toBe(9500); // balance was deducted during reservation
      expect(w.reservedBalance).toBe(0);
    });

    it('should rollback reservation correctly', async () => {
      await wallet.reserveBalance('user-1', 2000, 'rollback-r1');
      const w = await wallet.rollbackReservation('user-1', 2000, 'rollback-exec');

      expect(w.reservedBalance).toBe(0);
      expect(w.balance).toBe(10000);
    });
  });

  describe('Idempotency', () => {
    beforeEach(async () => {
      await wallet.getOrCreateWallet('user-1', 10000);
    });

    it('should not double-process the same idempotency key', async () => {
      const r1 = await wallet.reserveBalance('user-1', 500, 'same-key');
      const r2 = await wallet.reserveBalance('user-1', 500, 'same-key');

      expect(r1.balanceBefore).toBe(r2.balanceBefore);
      expect(r1.balanceAfter).toBe(r2.balanceAfter);

      const w = await wallet.getWallet('user-1');
      expect(w!.reservedBalance).toBe(500); // Only reserved once
    });
  });

  describe('Concurrency Safety', () => {
    it('should handle concurrent reservations correctly', async () => {
      await wallet.getOrCreateWallet('concurrent-user', 10000);

      const promises = Array.from({ length: 10 }, (_, i) =>
        wallet.reserveBalance('concurrent-user', 1000, `concurrent-${i}`),
      );

      await expect(Promise.all(promises)).resolves.toHaveLength(10);

      const w = await wallet.getWallet('concurrent-user');
      expect(w!.reservedBalance).toBe(10000); // All 10 * 1000 reserved
      expect(w!.balance).toBe(0);
    });

    it('should reject when concurrent reservations exceed balance', async () => {
      await wallet.getOrCreateWallet('over-user', 3000);

      const promises = Array.from({ length: 5 }, (_, i) =>
        wallet.reserveBalance('over-user', 1000, `over-${i}`),
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(3); // 3 * 1000 = 3000 limit
      expect(rejected.length).toBe(2);  // 2 beyond limit
    });
  });

  describe('Deposit and Withdrawal', () => {
    beforeEach(async () => {
      await wallet.getOrCreateWallet('user-2', 5000);
    });

    it('should deposit funds', async () => {
      const w = await wallet.deposit('user-2', 1000, 'deposit-1');
      expect(w.balance).toBe(6000);
      expect(w.totalDeposited).toBe(1000);
    });

    it('should withdraw funds', async () => {
      const w = await wallet.withdraw('user-2', 2000, 'withdraw-1');
      expect(w.balance).toBe(3000);
      expect(w.totalWithdrawn).toBe(2000);
    });

    it('should reject withdrawal exceeding available balance', async () => {
      await expect(
        wallet.withdraw('user-2', 99999, 'withdraw-fail'),
      ).rejects.toThrow(WalletEngineError);
    });
  });
});