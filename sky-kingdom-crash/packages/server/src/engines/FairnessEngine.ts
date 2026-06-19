// ============================================================
// FairnessEngine — Provably Fair Crash Point Generator
// ============================================================
// Uses a SHA-512 based commitment scheme.
//
// Every round:
//   1. serverSeed is generated and hashed → serverSeedHash is revealed
//   2. clientSeed is provided by the player (or generated)
//   3. nonce increments each round
//   4. roundHash = HMAC-SHA512(serverSeed, clientSeed + nonce)
//   5. crashPoint = f(roundHash)
//
// After the round, the raw serverSeed is revealed so the
// player can verify the result independently.
// ============================================================

import crypto from 'node:crypto';
import { GAME_CONFIG } from '@sky-kingdom/shared';
import type { SeedPair, RoundSeedData, VerificationResult } from '@sky-kingdom/shared';

export class FairnessEngine {
  private readonly algorithm = 'sha512';
  private readonly maxCrashPoint = GAME_CONFIG.MAX_MULTIPLIER;
  private readonly houseEdge = GAME_CONFIG.HOUSE_EDGE;

  // ─── Seed Generation ──────────────────────────────────────

  /**
   * Generate a cryptographically secure random server seed (64 bytes → hex).
   */
  generateServerSeed(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate a cryptographically secure random client seed.
   */
  generateClientSeed(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Compute the SHA-512 hash of a seed value.
   */
  hashSeed(seed: string): string {
    return crypto.createHash(this.algorithm).update(seed, 'utf8').digest('hex');
  }

  /**
   * Create a full seed pair with hashed server seed.
   */
  createSeedPair(clientSeed?: string): SeedPair {
    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.hashSeed(serverSeed);
    return {
      serverSeed,
      serverSeedHash,
      clientSeed: clientSeed ?? this.generateClientSeed(),
      nonce: 0,
    };
  }

  // ─── Round Hash Generation ─────────────────────────────────

  /**
   * Generate the round hash using HMAC-SHA512.
   *
   * roundHash = HMAC-SHA512(serverSeed, `${clientSeed}:${nonce}`)
   */
  generateRoundHash(serverSeed: string, clientSeed: string, nonce: number): string {
    const hmac = crypto.createHmac(this.algorithm, serverSeed);
    hmac.update(`${clientSeed}:${nonce}`);
    return hmac.digest('hex');
  }

  // ─── Crash Point Calculation ───────────────────────────────

  /**
   * Calculate the crash point from a round hash.
   *
   * This uses the standard provably-fair crash algorithm:
   * 1. Take first 13 hex chars → 52-bit integer h
   * 2. crashPoint = max(1, (2^52 - h) / (2^52 - 1) * (1 - houseEdge))
   * 3. Floor to 2 decimal places
   *
   * The house edge means the expected value is slightly below 1,
   * which is standard for crash games.
   */
  calculateCrashPoint(roundHash: string): number {
    // Take first 13 hex chars (52 bits)
    const hex = roundHash.substring(0, 13);
    const h = parseInt(hex, 16);
    const e = Math.pow(2, 52);

    // Standard crash point formula
    const rawCrash = (e - h) / (e - 1);

    // Apply house edge: crash point is multiplied by (1 - houseEdge)
    // This means the game has a slight house advantage
    const withEdge = rawCrash * (1 - this.houseEdge);

    // Floor to 2 decimal places, minimum 1.00
    const crashPoint = Math.max(1.0, Math.floor(withEdge * 100) / 100);

    // Cap at max multiplier to prevent absurd values
    return Math.min(crashPoint, this.maxCrashPoint);
  }

  // ─── Full Round Seed Generation ───────────────────────────

  /**
   * Generate all seed data for a round.
   */
  createRoundSeedData(
    roundId: string,
    roundNumber: number,
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string,
    nonce: number,
  ): RoundSeedData {
    const roundHash = this.generateRoundHash(serverSeed, clientSeed, nonce);
    const crashPoint = this.calculateCrashPoint(roundHash);

    return {
      roundId,
      roundNumber,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      roundHash,
      crashPoint,
      revealed: false,
    };
  }

  /**
   * Generate a fresh round seed (with new server seed).
   */
  generateRoundSeed(
    roundId: string,
    roundNumber: number,
    clientSeed?: string,
  ): RoundSeedData {
    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.hashSeed(serverSeed);
    return this.createRoundSeedData(
      roundId,
      roundNumber,
      serverSeed,
      serverSeedHash,
      clientSeed ?? this.generateClientSeed(),
      0,
    );
  }

  // ─── Verification ──────────────────────────────────────────

  /**
   * Verify a round after the server seed has been revealed.
   * This allows any player to independently verify the crash point
   * was generated fairly.
   */
  verifyRound(
    roundId: string,
    roundNumber: number,
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    expectedCrashPoint: number,
  ): VerificationResult {
    // 1. Verify the round hash
    const roundHash = this.generateRoundHash(serverSeed, clientSeed, nonce);

    // 2. Recalculate crash point
    const calculatedCrashPoint = this.calculateCrashPoint(roundHash);

    // 3. Compare
    const verified = Math.abs(calculatedCrashPoint - expectedCrashPoint) < 0.001;

    return {
      roundId,
      roundNumber,
      serverSeed,
      clientSeed,
      nonce,
      roundHash,
      crashPoint: calculatedCrashPoint,
      verified,
    };
  }

  /**
   * Verify that the server seed hash matches the revealed server seed.
   */
  verifyServerSeedHash(serverSeed: string, claimedHash: string): boolean {
    const actualHash = this.hashSeed(serverSeed);
    return actualHash === claimedHash;
  }

  // ─── Seed Rotation ─────────────────────────────────────────

  /**
   * Generate the next seed pair for a new round, incrementing nonce
   * and optionally rotating the server seed.
   */
  nextSeed(
    currentServerSeed: string,
    currentNonce: number,
    rotateServerSeed: boolean = false,
    clientSeed?: string,
  ): SeedPair {
    if (rotateServerSeed) {
      return this.createSeedPair(clientSeed);
    }
    return {
      serverSeed: currentServerSeed,
      serverSeedHash: this.hashSeed(currentServerSeed),
      clientSeed: clientSeed ?? this.generateClientSeed(),
      nonce: currentNonce + 1,
    };
  }

  /**
   * Reveal the server seed (called after the round ends).
   */
  revealServerSeed(roundSeedData: RoundSeedData): RoundSeedData {
    return {
      ...roundSeedData,
      revealed: true,
    };
  }

  /**
   * Generate a round hash from seed pair (static convenience).
   */
  static hashRound(serverSeed: string, clientSeed: string, nonce: number): string {
    const hmac = crypto.createHmac('sha512', serverSeed);
    hmac.update(`${clientSeed}:${nonce}`);
    return hmac.digest('hex');
  }

  /**
   * Static crash point calculation (convenience for client-side verification).
   */
  static crashPointFromHash(roundHash: string, houseEdge: number = 0.01): number {
    const hex = roundHash.substring(0, 13);
    const h = parseInt(hex, 16);
    const e = Math.pow(2, 52);
    const rawCrash = (e - h) / (e - 1);
    const withEdge = rawCrash * (1 - houseEdge);
    return Math.max(1.0, Math.floor(withEdge * 100) / 100);
  }

  /**
   * Full client-side verification.
   */
  static verify(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    crashPoint: number,
    houseEdge: number = 0.01,
  ): boolean {
    const hash = FairnessEngine.hashRound(serverSeed, clientSeed, nonce);
    const calculated = FairnessEngine.crashPointFromHash(hash, houseEdge);
    return Math.abs(calculated - crashPoint) < 0.001;
  }
}

// ─── Production Singleton ─────────────────────────────────────
export const fairnessEngine = new FairnessEngine();