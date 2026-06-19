// ============================================================
// REST API Routes
// ============================================================

import { Router, Response } from 'express';
import { AuthRequest, requireAuth, requireAdmin } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimiter.js';
import { fairnessEngine } from '../engines/FairnessEngine.js';
import { walletEngine } from '../engines/WalletEngine.js';
import { roundEngine } from '../engines/RoundEngine.js';
import { betEngine } from '../engines/BetEngine.js';
import { redisClient } from '../redis/RedisClient.js';
import type { ApiResponse, VerificationResult, RoundHistoryEntry } from '@sky-kingdom/shared';

const router = Router();
router.use(apiRateLimiter);

// ─── Health Check ──────────────────────────────────────────

router.get('/health', (_req, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      gameState: roundEngine.getGameState(),
      roundId: roundEngine.getRoundId(),
    },
  });
});

// ─── Round Info ────────────────────────────────────────────

router.get('/round/current', (_req, res: Response<ApiResponse>) => {
  const round = roundEngine.getCurrentRound();
  if (!round) {
    res.json({ success: true, data: { state: 'WAITING', message: 'Next round starting soon' } });
    return;
  }

  res.json({
    success: true,
    data: {
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      state: round.state,
      currentMultiplier: round.currentMultiplier,
      crashMultiplier: round.crashMultiplier,
      elapsed: round.elapsed,
      world: round.world,
      animation: round.animation,
      isBettingOpen: roundEngine.isBettingOpen(),
      startedAt: round.startedAt,
    },
  });
});

// ─── Wallet ────────────────────────────────────────────────

router.get('/wallet', requireAuth, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const wallet = await walletEngine.getWallet(req.userId!);
    if (!wallet) {
      res.json({
        success: true,
        data: await walletEngine.getOrCreateWallet(req.userId!),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...wallet,
        availableBalance: wallet.balance - wallet.reservedBalance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Fairness Verification API ─────────────────────────────

router.get('/verify/round/:roundId', async (req, res: Response<ApiResponse>) => {
  try {
    const { serverSeed, clientSeed, nonce, crashPoint } = req.query;

    if (!serverSeed || !clientSeed || nonce === undefined || !crashPoint) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: serverSeed, clientSeed, nonce, crashPoint',
      });
      return;
    }

    const result: VerificationResult = fairnessEngine.verifyRound(
      req.params.roundId,
      0,
      serverSeed as string,
      clientSeed as string,
      parseInt(nonce as string, 10),
      parseFloat(crashPoint as string),
    );

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Client-side Verification Helper ───────────────────────

router.get('/verify/calculate', (req, res: Response<ApiResponse>) => {
  try {
    const { serverSeed, clientSeed, nonce } = req.query;

    if (!serverSeed || !clientSeed || nonce === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: serverSeed, clientSeed, nonce',
      });
      return;
    }

    const roundHash = fairnessEngine.generateRoundHash(
      serverSeed as string,
      clientSeed as string,
      parseInt(nonce as string, 10),
    );
    const crashPoint = fairnessEngine.calculateCrashPoint(roundHash);

    res.json({
      success: true,
      data: { roundHash, crashPoint },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Server Seed Hash ─────────────────────────────────────

router.get('/round/server-seed-hash', (_req, res: Response<ApiResponse>) => {
  const round = roundEngine.getCurrentRound();
  if (!round?.seedData) {
    res.json({ success: true, data: { serverSeedHash: null } });
    return;
  }

  res.json({
    success: true,
    data: {
      serverSeedHash: round.seedData.serverSeedHash,
      clientSeed: round.seedData.clientSeed,
      nonce: round.seedData.nonce,
      roundHash: round.seedData.roundHash,
    },
  });
});

// ─── Bets ─────────────────────────────────────────────────

router.get('/bets/active', requireAuth, (req: AuthRequest, res: Response<ApiResponse>) => {
  const activeBets = betEngine.getUserActiveBets(req.userId!);
  res.json({ success: true, data: activeBets });
});

router.get('/bets/history', requireAuth, (req: AuthRequest, res: Response<ApiResponse>) => {
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const history = betEngine.getUserCompletedBets(req.userId!, limit);
  res.json({ success: true, data: history });
});

// ─── Leaderboard ──────────────────────────────────────────

router.get('/leaderboard', async (req, res: Response<ApiResponse>) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const entries = await redisClient.getLeaderboard(limit, offset);
    res.json({ success: true, data: entries });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Online Stats ─────────────────────────────────────────

router.get('/stats/online', async (_req, res: Response<ApiResponse>) => {
  try {
    const count = await redisClient.getOnlineCount();
    res.json({ success: true, data: { onlineCount: count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Deposit / Withdraw (Stub — Replace with Payment Provider) ──

router.post('/wallet/deposit', requireAuth, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const { amount, idempotencyKey } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Invalid amount' });
      return;
    }

    const wallet = await walletEngine.deposit(req.userId!, amount, idempotencyKey);
    res.json({
      success: true,
      data: {
        ...wallet,
        availableBalance: wallet.balance - wallet.reservedBalance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Admin Routes ─────────────────────────────────────────

router.get('/admin/status', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response<ApiResponse>) => {
  const round = roundEngine.getCurrentRound();
  const onlineCount = await redisClient.getOnlineCount();

  res.json({
    success: true,
    data: {
      gameState: roundEngine.getGameState(),
      round: round
        ? {
            roundId: round.roundId,
            roundNumber: round.roundNumber,
            state: round.state,
            currentMultiplier: round.currentMultiplier,
            crashMultiplier: round.crashMultiplier,
            activePlayers: round.activePlayers,
            totalBets: round.totalBets,
            totalPayouts: round.totalPayouts,
          }
        : null,
      onlineUsers: onlineCount,
      uptime: process.uptime(),
    },
  });
});

export default router;