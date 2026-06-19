// ============================================================
// RedisClient — Live State Management
// ============================================================
// Redis stores transient game data that doesn't need PostgreSQL:
//   - active round state
//   - current multiplier
//   - active bets
//   - online users
//   - socket ↔ user mappings
//   - temporary leaderboards
//   - chat state
// ============================================================

import Redis from 'ioredis';

export class RedisClient {
  private client: Redis;
  private subscriber: Redis;
  private isConnected: boolean = false;

  // Key prefix constants
  private readonly PREFIX = 'skc:';  // Sky Kingdom Crash

  constructor(redisUrl?: string) {
    const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';

    this.client = new Redis(url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    });

    this.subscriber = new Redis(url, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[Redis] Connected');
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });
  }

  // ─── Connection ──────────────────────────────────────────

  get connected(): boolean {
    return this.isConnected;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.client.quit(), this.subscriber.quit()]);
    this.isConnected = false;
  }

  // ─── Active Round ────────────────────────────────────────

  async setActiveRound(roundId: string, data: Record<string, unknown>): Promise<void> {
    const key = `${this.PREFIX}round:active`;
    await this.client.hset(key, data);
    await this.client.expire(key, 300); // 5 min TTL
  }

  async getActiveRound(): Promise<Record<string, string> | null> {
    const key = `${this.PREFIX}round:active`;
    const data = await this.client.hgetall(key);
    return Object.keys(data).length > 0 ? data : null;
  }

  async clearActiveRound(): Promise<void> {
    await this.client.del(`${this.PREFIX}round:active`);
  }

  // ─── Current Multiplier ─────────────────────────────────

  async setMultiplier(roundId: string, multiplier: number): Promise<void> {
    const key = `${this.PREFIX}multiplier:${roundId}`;
    await this.client.set(key, multiplier.toString());
    await this.client.expire(key, 300);
  }

  async getMultiplier(roundId: string): Promise<number | null> {
    const key = `${this.PREFIX}multiplier:${roundId}`;
    const val = await this.client.get(key);
    return val ? parseFloat(val) : null;
  }

  // ─── Active Bets ─────────────────────────────────────────

  async addActiveBet(betId: string, roundId: string, data: Record<string, unknown>): Promise<void> {
    const key = `${this.PREFIX}round:${roundId}:bets`;
    await this.client.hset(key, betId, JSON.stringify(data));
    await this.client.expire(key, 600);
  }

  async removeActiveBet(betId: string, roundId: string): Promise<void> {
    const key = `${this.PREFIX}round:${roundId}:bets`;
    await this.client.hdel(key, betId);
  }

  async getActiveBets(roundId: string): Promise<Record<string, string>> {
    const key = `${this.PREFIX}round:${roundId}:bets`;
    return this.client.hgetall(key);
  }

  // ─── Online Users ────────────────────────────────────────

  async addOnlineUser(userId: string, socketId: string): Promise<void> {
    const key = `${this.PREFIX}online:users`;
    await this.client.hset(key, userId, socketId);
    await this.client.expire(key, 3600); // 1 hour max (renewed on activity)
  }

  async removeOnlineUser(userId: string): Promise<void> {
    await this.client.hdel(`${this.PREFIX}online:users`, userId);
  }

  async getOnlineUsers(): Promise<Record<string, string>> {
    return this.client.hgetall(`${this.PREFIX}online:users`);
  }

  async getOnlineCount(): Promise<number> {
    const key = `${this.PREFIX}online:users`;
    return this.client.hlen(key);
  }

  // ─── Socket Mappings ─────────────────────────────────────

  async setSocketUser(socketId: string, userId: string): Promise<void> {
    const key = `${this.PREFIX}socket:${socketId}`;
    await this.client.setex(key, 3600, userId);
  }

  async getSocketUser(socketId: string): Promise<string | null> {
    const key = `${this.PREFIX}socket:${socketId}`;
    return this.client.get(key);
  }

  async removeSocketMapping(socketId: string): Promise<void> {
    await this.client.del(`${this.PREFIX}socket:${socketId}`);
  }

  // ─── Leaderboard (Live) ─────────────────────────────────

  async updateLeaderboardScore(
    userId: string,
    profit: number,
  ): Promise<void> {
    const key = `${this.PREFIX}leaderboard:live`;
    await this.client.zincrby(key, profit, userId);
    await this.client.expire(key, 86400); // 24h
  }

  async getLeaderboard(
    limit: number = 50,
    offset: number = 0,
  ): Promise<Array<{ userId: string; score: number }>> {
    const key = `${this.PREFIX}leaderboard:live`;
    const results = await this.client.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES');
    const entries: Array<{ userId: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        userId: results[i],
        score: parseFloat(results[i + 1]),
      });
    }
    return entries;
  }

  // ─── Pub/Sub (for internal server communication) ────────

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) callback(msg);
    });
  }

  // ─── Rate Limiting ──────────────────────────────────────

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const redisKey = `${this.PREFIX}ratelimit:${key}`;
    const current = await this.client.incr(redisKey);

    if (current === 1) {
      await this.client.expire(redisKey, windowSeconds);
    }

    const ttl = await this.client.ttl(redisKey);
    const resetAt = Date.now() + ttl * 1000;

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetAt,
    };
  }

  // ─── Cache Helpers ──────────────────────────────────────

  async cacheGet(key: string): Promise<string | null> {
    return this.client.get(`${this.PREFIX}cache:${key}`);
  }

  async cacheSet(key: string, value: string, ttl: number = 60): Promise<void> {
    await this.client.setex(`${this.PREFIX}cache:${key}`, ttl, value);
  }

  async cacheDelete(key: string): Promise<void> {
    await this.client.del(`${this.PREFIX}cache:${key}`);
  }
}

// ─── Singleton ────────────────────────────────────────────────
export const redisClient = new RedisClient();