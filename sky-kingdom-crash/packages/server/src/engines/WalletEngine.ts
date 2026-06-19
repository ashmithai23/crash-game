// ============================================================
// WalletEngine — Atomic Balance Management
// ============================================================
// Handles all money operations with strict safety guarantees:
//
// 1. Balance Reservation — Lock funds when placing a bet
// 2. Atomic Settlement — Credit winnings, release reserves
// 3. Rollback Protection — Can reverse failed operations
// 4. Idempotency — Duplicate operations are safe
// 5. Concurrency Safety — Mutex per user for race prevention
// ============================================================

import { GAME_CONFIG } from '@sky-kingdom/shared';
import type { Transaction, TransactionType, TransactionStatus, WalletData } from '@sky-kingdom/shared';
import { v4 as uuidv4 } from 'uuid';

interface WalletCache {
  userId: string;
  balance: number;
  reservedBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalBets: number;
  totalWinnings: number;
  updatedAt: number;
}

interface OperationLog {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  idempotencyKey: string;
  status: 'PENDING' | 'COMMITTED' | 'ROLLED_BACK';
  timestamp: number;
}

export class WalletEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public userId?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'WalletEngineError';
  }
}

export class WalletEngine {
  // In-memory wallet store (replace with Redis/DB in production)
  private wallets: Map<string, WalletCache> = new Map();
  private operationLogs: Map<string, OperationLog> = new Map();
  private userLocks: Map<string, Promise<void>> = new Map();
  private processedKeys: Set<string> = new Set();

  private readonly minBet = GAME_CONFIG.MIN_BET;
  private readonly maxBet = GAME_CONFIG.MAX_BET;

  // ─── Locking ───────────────────────────────────────────────

  /**
   * Acquire a per-user mutex to prevent concurrent balance operations.
   */
  private async acquireLock(userId: string): Promise<() => void> {
    let release: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Chain locks: wait for previous to complete, then add new
    const prev = this.userLocks.get(userId) ?? Promise.resolve();
    this.userLocks.set(userId, prev.then(() => lock));

    await prev;
    return release!;
  }

  // ─── Wallet Operations ─────────────────────────────────────

  /**
   * Get or create a wallet for a user.
   */
  async getOrCreateWallet(userId: string, initialBalance: number = 0): Promise<WalletData> {
    const release = await this.acquireLock(userId);
    try {
      if (!this.wallets.has(userId)) {
        this.wallets.set(userId, {
          userId,
          balance: initialBalance,
          reservedBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalBets: 0,
          totalWinnings: 0,
          updatedAt: Date.now(),
        });
      }
      return this.toWalletData(this.wallets.get(userId)!);
    } finally {
      release();
    }
  }

  /**
   * Get wallet data (read-only snapshot).
   */
  async getWallet(userId: string): Promise<WalletData | null> {
    const cached = this.wallets.get(userId);
    if (!cached) return null;
    return this.toWalletData(cached);
  }

  /**
   * Get available (unreserved) balance.
   */
  async getAvailableBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    if (!wallet) return 0;
    return wallet.balance - wallet.reservedBalance;
  }

  // ─── Balance Reservation (Bet Placement) ───────────────────

  /**
   * Reserve funds for a bet.
   * This reduces available balance and marks funds as reserved.
   * Returns the reservation reference ID.
   *
   * @throws WalletEngineError if insufficient funds
   */
  async reserveBalance(
    userId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<{
    reservationId: string;
    balanceBefore: number;
    balanceAfter: number;
  }> {
    // Idempotency check
    if (this.processedKeys.has(idempotencyKey)) {
      const existing = this.operationLogs.get(idempotencyKey);
      if (existing) {
        return {
          reservationId: existing.id,
          balanceBefore: existing.balanceBefore,
          balanceAfter: existing.balanceAfter,
        };
      }
    }

    // Validate amount
    if (amount < this.minBet) {
      throw new WalletEngineError(
        `Minimum bet is ${this.minBet}`,
        'INSUFFICIENT_BET',
        userId,
        { minBet: this.minBet, amount },
      );
    }
    if (amount > this.maxBet) {
      throw new WalletEngineError(
        `Maximum bet is ${this.maxBet}`,
        'BET_EXCEEDS_MAX',
        userId,
        { maxBet: this.maxBet, amount },
      );
    }

    const release = await this.acquireLock(userId);
    try {
      const wallet = this.wallets.get(userId);
      if (!wallet) {
        throw new WalletEngineError('Wallet not found', 'WALLET_NOT_FOUND', userId);
      }

      const availableBalance = wallet.balance;
      if (amount > availableBalance) {
        throw new WalletEngineError(
          'Insufficient available balance',
          'INSUFFICIENT_BALANCE',
          userId,
          { available: availableBalance, required: amount },
        );
      }

      const reservationId = uuidv4();
      const balanceBefore = wallet.balance;
      const reservedBefore = wallet.reservedBalance;

      wallet.balance -= amount;
      wallet.reservedBalance += amount;
      wallet.totalBets += 1;
      wallet.updatedAt = Date.now();

      const log: OperationLog = {
        id: reservationId,
        userId,
        type: 'RESERVE',
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        reservedBefore,
        reservedAfter: wallet.reservedBalance,
        idempotencyKey,
        status: 'COMMITTED',
        timestamp: Date.now(),
      };
      this.operationLogs.set(idempotencyKey, log);
      this.processedKeys.add(idempotencyKey);

      return { reservationId, balanceBefore, balanceAfter: wallet.balance };
    } finally {
      release();
    }
  }

  // ─── Cashout / Win Settlement ──────────────────────────────

  /**
   * Settle a winning cashout.
   * Credits the winnings to the balance and releases any reserved funds.
   *
   * @returns The updated wallet data
   */
  async settleCashout(
    userId: string,
    betAmount: number,
    payoutAmount: number,
    reservationId: string,
    idempotencyKey: string,
  ): Promise<WalletData> {
    // Idempotency check
    if (this.processedKeys.has(idempotencyKey)) {
      const wallet = this.wallets.get(userId);
      if (wallet) return this.toWalletData(wallet);
    }

    const release = await this.acquireLock(userId);
    try {
      const wallet = this.wallets.get(userId);
      if (!wallet) {
        throw new WalletEngineError('Wallet not found', 'WALLET_NOT_FOUND', userId);
      }

      // Validate reserved balance is sufficient
      if (wallet.reservedBalance < betAmount) {
        throw new WalletEngineError(
          'Reserved balance mismatch',
          'RESERVE_MISMATCH',
          userId,
          { reserved: wallet.reservedBalance, expectedReserved: betAmount },
        );
      }

      const balanceBefore = wallet.balance;
      const reservedBefore = wallet.reservedBalance;

      // Release reservation and credit payout
      wallet.reservedBalance -= betAmount;
      wallet.balance += payoutAmount;
      wallet.totalWinnings += payoutAmount;
      wallet.updatedAt = Date.now();

      const log: OperationLog = {
        id: uuidv4(),
        userId,
        type: 'CASHOUT',
        amount: payoutAmount,
        balanceBefore,
        balanceAfter: wallet.balance,
        reservedBefore,
        reservedAfter: wallet.reservedBalance,
        idempotencyKey,
        status: 'COMMITTED',
        timestamp: Date.now(),
      };
      this.operationLogs.set(idempotencyKey, log);
      this.processedKeys.add(idempotencyKey);

      return this.toWalletData(wallet);
    } finally {
      release();
    }
  }

  // ─── Loss Settlement ───────────────────────────────────────

  /**
   * Settle a loss: the reserved amount is forfeited.
   */
  async settleLoss(
    userId: string,
    betAmount: number,
    reservationId: string,
    idempotencyKey: string,
  ): Promise<WalletData> {
    if (this.processedKeys.has(idempotencyKey)) {
      const wallet = this.wallets.get(userId);
      if (wallet) return this.toWalletData(wallet);
    }

    const release = await this.acquireLock(userId);
    try {
      const wallet = this.wallets.get(userId);
      if (!wallet) {
        throw new WalletEngineError('Wallet not found', 'WALLET_NOT_FOUND', userId);
      }

      if (wallet.reservedBalance < betAmount) {
        throw new WalletEngineError(
          'Reserved balance mismatch',
          'RESERVE_MISMATCH',
          userId,
          { reserved: wallet.reservedBalance, expectedReserved: betAmount },
        );
      }

      const balanceBefore = wallet.balance;
      const reservedBefore = wallet.reservedBalance;

      // Reserved amount is lost, just release it
      wallet.reservedBalance -= betAmount;
      // Balance stays the same (the reserved amount was already subtracted
      // from available balance, now it's just gone)
      wallet.updatedAt = Date.now();

      const log: OperationLog = {
        id: uuidv4(),
        userId,
        type: 'LOSS',
        amount: betAmount,
        balanceBefore,
        balanceAfter: wallet.balance,
        reservedBefore,
        reservedAfter: wallet.reservedBalance,
        idempotencyKey,
        status: 'COMMITTED',
        timestamp: Date.now(),
      };
      this.operationLogs.set(idempotencyKey, log);
      this.processedKeys.add(idempotencyKey);

      return this.toWalletData(wallet);
    } finally {
      release();
    }
  }

  // ─── Rollback / Refund ─────────────────────────────────────

  /**
   * Rollback a reservation (refund), returning funds to available balance.
   */
  async rollbackReservation(
    userId: string,
    betAmount: number,
    idempotencyKey: string,
  ): Promise<WalletData> {
    if (this.processedKeys.has(idempotencyKey)) {
      const wallet = this.wallets.get(userId);
      if (wallet) return this.toWalletData(wallet);
    }

    const release = await this.acquireLock(userId);
    try {
      const wallet = this.wallets.get(userId);
      if (!wallet) {
        throw new WalletEngineError('Wallet not found', 'WALLET_NOT_FOUND', userId);
      }

      if (wallet.reservedBalance < betAmount) {
        // Already partially or fully released — this is a no-op
        return this.toWalletData(wallet);
      }

      const balanceBefore = wallet.balance;
      const reservedBefore = wallet.reservedBalance;

      wallet.balance += betAmount;
      wallet.reservedBalance -= betAmount;
      wallet.updatedAt = Date.now();

      const log: OperationLog = {
        id: uuidv4(),
        userId,
        type: 'ROLLBACK',
        amount: betAmount,
        balanceBefore,
        balanceAfter: wallet.balance,
        reservedBefore,
        reservedAfter: wallet.reservedBalance,
        idempotencyKey,
        status: 'ROLLED_BACK',
        timestamp: Date.now(),
      };
      this.operationLogs.set(idempotencyKey, log);
      this.processedKeys.add(idempotencyKey);

      return this.toWalletData(wallet);
    } finally {
      release();
    }
  }

  // ─── Deposit / Withdrawal ──────────────────────────────────

  /**
   * Deposit funds into a wallet.
   */
  async deposit(
    userId: string,
    amount: number,
    idempotencyKey: string,
    description?: string,
  ): Promise<WalletData> {
    if (this.processedKeys.has(idempotencyKey)) {
      const wallet = this.wallets.get(userId);
      if (wallet) return this.toWalletData(wallet);
    }

    const release = await this.acquireLock(userId);
    try {
      let wallet = this.wallets.get(userId);
      if (!wallet) {
        wallet = {
          userId,
          balance: 0,
          reservedBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalBets: 0,
          totalWinnings: 0,
          updatedAt: Date.now(),
        };
        this.wallets.set(userId, wallet);
      }

      const balanceBefore = wallet.balance;
      wallet.balance += amount;
      wallet.totalDeposited += amount;
      wallet.updatedAt = Date.now();

      const log: OperationLog = {
        id: uuidv4(),
        userId,
        type: 'DEPOSIT',
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        reservedBefore: wallet.reservedBalance,
        reservedAfter: wallet.reservedBalance,
        idempotencyKey,
        status: 'COMMITTED',
        timestamp: Date.now(),
      };
      this.operationLogs.set(idempotencyKey, log);
      this.processedKeys.add(idempotencyKey);

      return this.toWalletData(wallet);
    } finally {
      release();
    }
  }

  /**
   * Withdraw funds from a wallet.
   */
  async withdraw(
    userId: string,
    amount: number,
    idempotencyKey: string,
    description?: string,
  ): Promise<WalletData> {
    if (this.processedKeys.has(idempotencyKey)) {
      const wallet = this.wallets.get(userId);
      if (wallet) return this.toWalletData(wallet);
    }

    const release = await this.acquireLock(userId);
    try {
      const wallet = this.wallets.get(userId);
      if (!wallet) {
        throw new WalletEngineError('Wallet not found', 'WALLET_NOT_FOUND', userId);
      }

      const availableBalance = wallet.balance;
      if (amount > availableBalance) {
        throw new WalletEngineError(
          'Insufficient available balance for withdrawal',
          'INSUFFICIENT_BALANCE',
          userId,
          { available: availableBalance, required: amount },
        );
      }

      const balanceBefore = wallet.balance;
      wallet.balance -= amount;
      wallet.totalWithdrawn += amount;
      wallet.updatedAt = Date.now();

      const log: OperationLog = {
        id: uuidv4(),
        userId,
        type: 'WITHDRAWAL',
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        reservedBefore: wallet.reservedBalance,
        reservedAfter: wallet.reservedBalance,
        idempotencyKey,
        status: 'COMMITTED',
        timestamp: Date.now(),
      };
      this.operationLogs.set(idempotencyKey, log);
      this.processedKeys.add(idempotencyKey);

      return this.toWalletData(wallet);
    } finally {
      release();
    }
  }

  // ─── Internal Helpers ──────────────────────────────────────

  private toWalletData(cache: WalletCache): WalletData {
    return {
      userId: cache.userId,
      balance: cache.balance,
      reservedBalance: cache.reservedBalance,
      totalDeposited: cache.totalDeposited,
      totalWithdrawn: cache.totalWithdrawn,
      totalBets: cache.totalBets,
      totalWinnings: cache.totalWinnings,
      updatedAt: cache.updatedAt,
    };
  }

  /**
   * Get all pending transaction logs for a user (for debugging / audits).
   */
  async getUserLogs(userId: string): Promise<OperationLog[]> {
    const logs: OperationLog[] = [];
    for (const log of this.operationLogs.values()) {
      if (log.userId === userId) {
        logs.push(log);
      }
    }
    return logs.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Check idempotency (has this key been processed?).
   */
  hasProcessed(idempotencyKey: string): boolean {
    return this.processedKeys.has(idempotencyKey);
  }
}

// ─── Production Singleton ─────────────────────────────────────
export const walletEngine = new WalletEngine();