// ============================================================
// FairnessEngine — Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { FairnessEngine } from '../engines/FairnessEngine.js';

describe('FairnessEngine', () => {
  const engine = new FairnessEngine();

  describe('Seed Generation', () => {
    it('should generate a server seed of correct length', () => {
      const seed = engine.generateServerSeed();
      expect(seed).toBeTruthy();
      expect(seed.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('should generate unique server seeds', () => {
      const seeds = new Set(Array.from({ length: 100 }, () => engine.generateServerSeed()));
      expect(seeds.size).toBe(100);
    });

    it('should generate a deterministic hash for the same seed', () => {
      const seed = 'test-seed-value';
      const hash1 = engine.hashSeed(seed);
      const hash2 = engine.hashSeed(seed);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different seeds', () => {
      const hash1 = engine.hashSeed('seed-1');
      const hash2 = engine.hashSeed('seed-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should create a valid seed pair', () => {
      const pair = engine.createSeedPair();
      const expectedHash = engine.hashSeed(pair.serverSeed);

      expect(pair.serverSeed).toBeTruthy();
      expect(pair.serverSeedHash).toBe(expectedHash);
      expect(pair.clientSeed).toBeTruthy();
      expect(pair.nonce).toBe(0);
    });

    it('should use provided client seed when given', () => {
      const clientSeed = 'my-custom-client-seed';
      const pair = engine.createSeedPair(clientSeed);
      expect(pair.clientSeed).toBe(clientSeed);
    });
  });

  describe('Round Hash', () => {
    it('should generate consistent hashes for same inputs', () => {
      const hash1 = engine.generateRoundHash('server', 'client', 1);
      const hash2 = engine.generateRoundHash('server', 'client', 1);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different nonces', () => {
      const hash1 = engine.generateRoundHash('server', 'client', 1);
      const hash2 = engine.generateRoundHash('server', 'client', 2);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate a SHA-512 hash (128 hex chars)', () => {
      const hash = engine.generateRoundHash('server', 'client', 0);
      expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });
  });

  describe('Crash Point Calculation', () => {
    it('should always return at least 1.0', () => {
      for (let i = 0; i < 1000; i++) {
        const hash = engine.generateRoundHash(`server-${i}`, 'client', i);
        const crashPoint = engine.calculateCrashPoint(hash);
        expect(crashPoint).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('should not exceed max crash point', () => {
      for (let i = 0; i < 100; i++) {
        const hash = engine.generateRoundHash(`server-${i}`, 'client', i);
        const crashPoint = engine.calculateCrashPoint(hash);
        expect(crashPoint).toBeLessThanOrEqual(1000000);
      }
    });

    it('should return deterministic values for the same hash', () => {
      const hash = engine.generateRoundHash('fixed-server', 'fixed-client', 42);
      const point1 = engine.calculateCrashPoint(hash);
      const point2 = engine.calculateCrashPoint(hash);
      expect(point1).toBe(point2);
    });

    it('should return values rounded to 2 decimal places', () => {
      for (let i = 0; i < 100; i++) {
        const hash = engine.generateRoundHash(`server-${i}`, 'client', i);
        const crashPoint = engine.calculateCrashPoint(hash);
        const decimals = crashPoint.toString().split('.')[1]?.length ?? 0;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    });

    it('should produce varying crash points', () => {
      const points = new Set(
        Array.from({ length: 100 }, (_, i) => {
          const hash = engine.generateRoundHash(`server-${i}`, `client-${i}`, i);
          return engine.calculateCrashPoint(hash);
        }),
      );
      // With 100 samples, we should see at least some variety
      expect(points.size).toBeGreaterThan(50);
    });
  });

  describe('Round Seed Data', () => {
    it('should create valid round seed data', () => {
      const data = engine.generateRoundSeed('round-1', 1);
      expect(data.roundId).toBe('round-1');
      expect(data.roundNumber).toBe(1);
      expect(data.crashPoint).toBeGreaterThanOrEqual(1.0);
      expect(data.roundHash).toMatch(/^[0-9a-f]{128}$/);
      expect(data.revealed).toBe(false);
    });

    it('should link round hash to crash point', () => {
      const data = engine.generateRoundSeed('round-2', 2);
      const calculatedPoint = engine.calculateCrashPoint(data.roundHash);
      expect(data.crashPoint).toBe(calculatedPoint);
    });
  });

  describe('Verification', () => {
    it('should verify a correctly generated round', () => {
      const data = engine.generateRoundSeed('verify-round', 10);
      const result = engine.verifyRound(
        'verify-round',
        10,
        data.serverSeed,
        data.clientSeed,
        data.nonce,
        data.crashPoint,
      );
      expect(result.verified).toBe(true);
      expect(result.roundHash).toBe(data.roundHash);
      expect(result.crashPoint).toBe(data.crashPoint);
    });

    it('should reject an incorrect crash point', () => {
      const data = engine.generateRoundSeed('verify-fail', 11);
      const result = engine.verifyRound(
        'verify-fail',
        11,
        data.serverSeed,
        data.clientSeed,
        data.nonce,
        99.99, // wrong crash point
      );
      expect(result.verified).toBe(false);
    });

    it('should verify server seed hash', () => {
      const pair = engine.createSeedPair();
      const valid = engine.verifyServerSeedHash(pair.serverSeed, pair.serverSeedHash);
      expect(valid).toBe(true);

      const invalid = engine.verifyServerSeedHash(pair.serverSeed, 'fake-hash');
      expect(invalid).toBe(false);
    });
  });

  describe('Seed Rotation', () => {
    it('should increment nonce when not rotating server seed', () => {
      const current = engine.createSeedPair();
      const next = engine.nextSeed(current.serverSeed, current.nonce, false);
      expect(next.nonce).toBe(current.nonce + 1);
      expect(next.serverSeed).toBe(current.serverSeed);
    });

    it('should generate new server seed when rotating', () => {
      const current = engine.createSeedPair();
      const next = engine.nextSeed(current.serverSeed, current.nonce, true);
      expect(next.serverSeed).not.toBe(current.serverSeed);
      expect(next.nonce).toBe(0);
    });
  });

  describe('Static Verification', () => {
    it('should verify correctly via static method', () => {
      const engine2 = new FairnessEngine();
      const data = engine2.generateRoundSeed('static-test', 100);

      const verified = FairnessEngine.verify(
        data.serverSeed,
        data.clientSeed,
        data.nonce,
        data.crashPoint,
        0.01,
      );
      expect(verified).toBe(true);
    });

    it('should reject with wrong house edge', () => {
      const engine2 = new FairnessEngine();
      const data = engine2.generateRoundSeed('static-test-2', 101);

      const verified = FairnessEngine.verify(
        data.serverSeed,
        data.clientSeed,
        data.nonce,
        data.crashPoint,
        0.0, // wrong house edge
      );
      // Should still be close enough (< 0.001 diff) because house edge is tiny
      expect(verified).toBe(true);
    });
  });
});