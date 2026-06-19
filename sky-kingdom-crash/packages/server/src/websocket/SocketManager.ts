// ============================================================
// SocketManager — Real-Time WebSocket Communication
// ============================================================
// Handles all WebSocket events with Socket.IO.
// Provides:
//   - Event routing to game engines
//   - Authentication on connect
//   - Rate limiting per event
//   - Broadcast to round participants
//   - Connection state management
// ============================================================

import { Server as HTTPServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { WsEvent, GAME_CONFIG } from '@sky-kingdom/shared';
import type { PlaceBetPayload, CashoutPayload, ChatMessagePayload } from '@sky-kingdom/shared';
import { roundEngine } from '../engines/RoundEngine.js';
import { walletEngine } from '../engines/WalletEngine.js';
import { betEngine } from '../engines/BetEngine.js';
import { redisClient } from '../redis/RedisClient.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export class SocketManager {
  private io: Server;
  private rateLimitMap: Map<string, Map<string, number[]>> = new Map();
  private readonly jwtSecret: string;

  constructor(httpServer: HTTPServer) {
    this.jwtSecret = process.env.JWT_SECRET ?? 'skc-jwt-secret-change-in-production';

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingInterval: 30000,
      pingTimeout: 10000,
      maxHttpBufferSize: 1e6, // 1MB
    });

    this.setupAuthMiddleware();
    this.setupConnectionHandler();
    this.setupGameEventForwarding();
  }

  // ─── Auth Middleware ────────────────────────────────────────

  private setupAuthMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ??
          socket.handshake.query?.token as string;

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, this.jwtSecret) as {
          userId: string;
          username: string;
        };

        (socket as AuthenticatedSocket).userId = decoded.userId;
        (socket as AuthenticatedSocket).username = decoded.username;
        next();
      } catch (err) {
        next(new Error('Invalid or expired token'));
      }
    });
  }

  // ─── Connection Handler ─────────────────────────────────────

  private setupConnectionHandler(): void {
    this.io.on('connection', async (rawSocket: Socket) => {
      const socket = rawSocket as AuthenticatedSocket;
      const { userId, username } = socket;

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      console.log(`[WS] User connected: ${username} (${userId})`);

      // Track online status
      await redisClient.addOnlineUser(userId, socket.id);
      await redisClient.setSocketUser(socket.id, userId);

      // Send initial state
      this.sendInitialState(socket);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Join round room if one is active
      const roundId = roundEngine.getRoundId();
      if (roundId) {
        socket.join(`round:${roundId}`);
      }

      // Register event handlers
      this.registerHandlers(socket);

      // Handle disconnect
      socket.on('disconnect', async () => {
        console.log(`[WS] User disconnected: ${username} (${userId})`);
        await redisClient.removeOnlineUser(userId);
        await redisClient.removeSocketMapping(socket.id);

        const onlineCount = await redisClient.getOnlineCount();
        this.io.emit(WsEvent.LEADERBOARD_UPDATE, { onlineCount });
      });
    });
  }

  // ─── Initial State ──────────────────────────────────────────

  private async sendInitialState(socket: AuthenticatedSocket): Promise<void> {
    // Send current round state
    const round = roundEngine.getCurrentRound();
    if (round) {
      socket.emit(WsEvent.ROUND_STATE, {
        roundId: round.roundId,
        roundNumber: round.roundNumber,
        state: round.state,
        currentMultiplier: round.currentMultiplier,
        crashMultiplier: round.crashMultiplier,
        elapsed: round.elapsed,
        world: round.world,
        animation: round.animation,
      });
    }

    // Send user's active bets
    const wallet = await walletEngine.getWallet(socket.userId!);
    if (wallet) {
      socket.emit(WsEvent.BALANCE_UPDATE, {
        userId: socket.userId,
        balance: wallet.balance,
        reservedBalance: wallet.reservedBalance,
        availableBalance: wallet.balance - wallet.reservedBalance,
      });
    }

    // Send online count
    const onlineCount = await redisClient.getOnlineCount();
    socket.emit(WsEvent.LEADERBOARD_UPDATE, { onlineCount });
  }

  // ─── Event Handlers ────────────────────────────────────────

  private registerHandlers(socket: AuthenticatedSocket): void {
    // Place Bet
    socket.on(WsEvent.PLACE_BET, async (payload: PlaceBetPayload, callback) => {
      try {
        if (!this.checkRateLimit(socket, 'place_bet', 10, 1000)) {
          return callback?.({ error: 'Rate limited' });
        }

        if (!roundEngine.canPlaceBet()) {
          return callback?.({ error: 'Betting is not open' });
        }

        // Reserve balance
        const idempotencyKey = `${socket.userId}:${payload.roundId}:${uuidv4()}`;
        const reservation = await walletEngine.reserveBalance(
          socket.userId!,
          payload.amount,
          idempotencyKey,
        );

        // Place bet in engine
        const bet = betEngine.placeBet({
          userId: socket.userId!,
          roundId: payload.roundId,
          amount: payload.amount,
          autoCashoutMultiplier: payload.autoCashoutMultiplier,
          dualBetAmount: payload.dualBetAmount,
          dualAutoCashoutMultiplier: payload.dualAutoCashoutMultiplier,
        });

        // Register on round engine
        roundEngine.registerBet(payload.amount);

        // Store in Redis
        await redisClient.addActiveBet(bet.betId, payload.roundId, {
          userId: socket.userId,
          amount: payload.amount,
          autoCashoutAt: payload.autoCashoutMultiplier,
        });

        // Confirm to user
        callback?.({
          success: true,
          betId: bet.betId,
          amount: payload.amount,
          reservationId: reservation.reservationId,
        });

        socket.emit(WsEvent.BET_CONFIRMED, {
          betId: bet.betId,
          roundId: payload.roundId,
          amount: payload.amount,
          autoCashoutMultiplier: payload.autoCashoutMultiplier,
          confirmedAt: Date.now(),
        });
      } catch (err: any) {
        callback?.({ error: err.message ?? 'Bet placement failed' });
        socket.emit(WsEvent.BET_ERROR, {
          message: err.message ?? 'Bet placement failed',
        });
      }
    });

    // Manual Cashout
    socket.on(WsEvent.MANUAL_CASHOUT, async (payload: CashoutPayload, callback) => {
      try {
        if (!this.checkRateLimit(socket, 'cashout', 5, 1000)) {
          return callback?.({ error: 'Rate limited' });
        }

        const currentMultiplier = roundEngine.getCurrentMultiplier();
        const result = betEngine.cashout(payload.betId, currentMultiplier);

        if (!result) {
          return callback?.({ error: 'Bet not found or already cashed out' });
        }

        // Settle in wallet engine
        const idempotencyKey = `cashout:${payload.betId}:${Date.now()}`;
        await walletEngine.settleCashout(
          socket.userId!,
          result.amount,
          result.payout,
          payload.betId,
          idempotencyKey,
        );

        // Register on round
        roundEngine.registerCashout(result.payout);

        // Remove from Redis
        await redisClient.removeActiveBet(payload.betId, payload.roundId);

        // Update leaderboard
        const profit = result.payout - result.amount;
        await redisClient.updateLeaderboardScore(socket.userId!, profit);

        // Confirm
        callback?.({
          success: true,
          betId: result.betId,
          multiplier: result.multiplier,
          payout: result.payout,
        });

        socket.emit(WsEvent.CASHOUT_SUCCESS, {
          betId: result.betId,
          roundId: payload.roundId,
          amount: result.amount,
          multiplier: result.multiplier,
          payout: result.payout,
        });

        // Update balance
        const wallet = await walletEngine.getWallet(socket.userId!);
        if (wallet) {
          socket.emit(WsEvent.BALANCE_UPDATE, {
            userId: socket.userId,
            balance: wallet.balance,
            reservedBalance: wallet.reservedBalance,
            availableBalance: wallet.balance - wallet.reservedBalance,
          });
        }
      } catch (err: any) {
        callback?.({ error: err.message ?? 'Cashout failed' });
      }
    });

    // Chat Message
    socket.on(WsEvent.CHAT_MESSAGE, async (payload: { message: string }) => {
      try {
        if (!this.checkRateLimit(socket, 'chat', 5, 5000)) {
          return;
        }

        const message = payload.message.trim().substring(0, GAME_CONFIG.CHAT_MAX_LENGTH);
        if (!message) return;

        const chatPayload: ChatMessagePayload = {
          id: uuidv4(),
          userId: socket.userId!,
          username: socket.username ?? 'Unknown',
          message,
          timestamp: Date.now(),
        };

        this.io.emit(WsEvent.CHAT_MESSAGE, chatPayload);
      } catch {
        // Silently fail on chat errors
      }
    });

    // Auto Bet
    socket.on(WsEvent.AUTO_BET, (config: any) => {
      betEngine.setAutoBet({
        userId: socket.userId!,
        enabled: config.enabled ?? true,
        baseAmount: config.baseAmount,
        multiplier: config.multiplier ?? 1,
        autoCashoutMultiplier: config.autoCashoutMultiplier ?? null,
        onLoss: config.onLoss ?? 'same',
        onWin: config.onWin ?? 'same',
        maxRounds: config.maxRounds ?? 100,
        currentRounds: 0,
      });
    });

    socket.on(WsEvent.AUTO_CASHOUT, () => {
      betEngine.disableAutoBet(socket.userId!);
    });
  }

  // ─── Game Event Forwarding ──────────────────────────────────

  private setupGameEventForwarding(): void {
    // Forward round start to all connected clients
    roundEngine.on('ROUND_START', (data) => {
      this.io.emit(WsEvent.ROUND_START, data);
    });

    // Round lock
    roundEngine.on('ROUND_LOCK', (data) => {
      this.io.emit(WsEvent.ROUND_LOCK, data);
    });

    // Multiplier updates — broadcast to all
    roundEngine.on('MULTIPLIER_UPDATE', (data) => {
      this.io.emit(WsEvent.MULTIPLIER_UPDATE, data);
    });

    // Crash event
    roundEngine.on('CRASH', (data) => {
      // Settle all remaining bets
      const round = roundEngine.getCurrentRound();
      if (round) {
        const lostBets = betEngine.settleRemainingBets(round.roundId);
        // Process losses (async, non-blocking)
        for (const lostBet of lostBets) {
          walletEngine.settleLoss(
            lostBet.userId,
            lostBet.amount,
            lostBet.id,
            `loss:${lostBet.id}`,
          ).catch(() => {});
        }
      }

      this.io.emit(WsEvent.CRASH_EVENT, data);
    });

    // Round end with seed reveal
    roundEngine.on('ROUND_END', (data) => {
      this.io.emit(WsEvent.ROUND_RESULT, data);
    });

    // Threshold crossed (environment change)
    roundEngine.on('THRESHOLD_CROSSED', (data) => {
      this.io.emit('THRESHOLD_CROSSED', data);
    });
  }

  // ─── Rate Limiting ───────────────────────────────────────

  private checkRateLimit(
    socket: AuthenticatedSocket,
    action: string,
    maxRequests: number,
    windowMs: number,
  ): boolean {
    const now = Date.now();
    if (!this.rateLimitMap.has(socket.id)) {
      this.rateLimitMap.set(socket.id, new Map());
    }

    const userLimits = this.rateLimitMap.get(socket.id)!;
    if (!userLimits.has(action)) {
      userLimits.set(action, []);
    }

    const timestamps = userLimits.get(action)!;
    const windowStart = now - windowMs;

    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  // ─── Server Management ───────────────────────────────────

  /**
   * Emit an event to all sockets in a specific round room.
   */
  emitToRound(roundId: string, event: string, data: unknown): void {
    this.io.to(`round:${roundId}`).emit(event, data);
  }

  /**
   * Emit an event to a specific user.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected clients.
   */
  broadcast(event: string, data: unknown): void {
    this.io.emit(event, data);
  }

  /**
   * Get the Socket.IO server instance.
   */
  getIO(): Server {
    return this.io;
  }
}