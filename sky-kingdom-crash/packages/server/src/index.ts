// ============================================================
// Sky Kingdom Crash — Server Entry Point
// ============================================================

import express from 'express';
import { createServer } from 'node:http';
import helmet from 'helmet';
import cors from 'cors';
import { GAME_CONFIG } from '@sky-kingdom/shared';
import { roundEngine } from './engines/RoundEngine.js';
import { SocketManager } from './websocket/SocketManager.js';
import { redisClient } from './redis/RedisClient.js';
import routes from './api/routes.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';

// ─── Configuration ────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// ─── Express App ──────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Allow WebSocket connections
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));

// Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (global)
app.use('/api', apiRateLimiter);

// API Routes
app.use('/api', routes);

// Health check at root
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Sky Kingdom Crash',
      version: '1.0.0',
      status: 'running',
    },
  });
});

// ─── Socket.IO ────────────────────────────────────────────────

const socketManager = new SocketManager(httpServer);

// ─── Start Server ─────────────────────────────────────────────

async function start(): Promise<void> {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Sky Kingdom Crash — Game Server          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  // Connect to Redis (non-blocking — server works without it)
  try {
    const connected = await redisClient.ping();
    if (connected) {
      console.log('[OK] Redis connected');
    } else {
      console.log('[WARN] Redis not available — running in memory-only mode');
    }
  } catch {
    console.log('[WARN] Redis not available — running in memory-only mode');
  }

  // Start HTTP server
  httpServer.listen(PORT, HOST, () => {
    console.log(`[OK] HTTP server listening on http://${HOST}:${PORT}`);
    console.log(`[OK] WebSocket server ready on ws://${HOST}:${PORT}`);
    console.log(`[OK] API available at http://${HOST}:${PORT}/api`);
    console.log();

    // Start the game loop
    console.log(`[GAME] Starting game loop...`);
    console.log(`[GAME] Tick rate: ${GAME_CONFIG.TICK_RATE}ms`);
    console.log(`[GAME] Betting window: ${GAME_CONFIG.ROUND_BETTING_TIME}ms`);
    console.log(`[GAME] Max multiplier: ${GAME_CONFIG.MAX_MULTIPLIER}x`);
    console.log(`[GAME] House edge: ${(GAME_CONFIG.HOUSE_EDGE * 100)}%`);
    console.log();

    roundEngine.start();
    console.log('[GAME] Round engine started');
    console.log('[READY] Sky Kingdom Crash is live!');
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[SHUTDOWN] Received ${signal}. Shutting down gracefully...`);

  roundEngine.stop();
  console.log('[SHUTDOWN] Round engine stopped');

  await redisClient.disconnect();
  console.log('[SHUTDOWN] Redis disconnected');

  httpServer.close(() => {
    console.log('[SHUTDOWN] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  shutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

// ─── Start ───────────────────────────────────────────────────

start();