// AnalyticsService.ts
// Central service for tracking game analytics with database integration

import { betEngine } from '../engines/BetEngine';  // Reference existing BetEngine
import { roundEngine } from '../engines/RoundEngine';  // Track round-level data
import { walletEngine } from '../engines/WalletEngine';  // For deposit/withdrawal events
import { client } from '../drizzle/client';
import { v4 as uuidv4 } from 'uuid';

// Analytics data structure
class AnalyticsData {
  id: string;
  roundId: string | null;
  userId: string | null;
  betAmount: number;
  payout: number;
  cashoutType: 'CASHOUT' | 'LOSS' | null;
  depositAmount: number;
  withdrawalAmount: number;
  walletBalanceChange: number;
  createdAt: Date;
}

// Drizzle transaction handler
async function handleDrizzleTransaction(tx: any, data: AnalyticsData) {
  try {
    // Insert/upsert player stats
    await tx.insertOrUpdate({
      table: 'player_stats',
      where: { userId: data.userId },
      data: {
        totalBets: { '+': data.betAmount || 0 },
        totalWinnings: { '+': data.payout || 0 },
        deposits: { '+': data.depositAmount || 0 },
        withdrawals: { '+': data.withdrawalAmount || 0 }
      }
    });

    // Update revenue metrics
    const today = new Date(data.createdAt).toISOString().split('T')[0];
    await tx.insertOrUpdate({
      table: 'revenue_metrics',
      where: { date: today },
      data: {
        totalDeposits: { '+': data.depositAmount || 0 },
        totalWithdrawals: { '+': data.withdrawalAmount || 0 },
        totalRevenue: { '+': data.payout || 0 }
      }
    },

    // Create RTP snapshot if round ended
    if (data.roundId) {
      const rtp = AnalyticsService.getRTPForRound(data.roundId);
      await tx.insertOne({
        table: 'rtp_snapshots',
        data: { id: uuidv4(), createdAt: data.createdAt, rtpPercentage: rtp }
      });
    }
  } catch (error) {
    console.error('Analytics database error:', error);
    throw new Error('Failed to write analytics data');
  }
}

// Event handlers with Drizzle integration
const analyticsListeners = {
  // BetEngine events
  cashout: (data) => handleBetEvent('CASHOUT', data),
  loss: (data) => handleBetEvent('LOSS', data),

  // RoundEngine events
  'ROUND_END': (data) => handleRoundEnd(data),
  'MULTIPLIER_UPDATE': (data) => updateMultiplier(data),

  // WalletEngine events
  deposit: (data) => handleWalletEvent('DEPOSIT', data),
  withdrawal: (data) => handleWalletEvent('WITHDRAWAL', data),
};

// Event handlers implementation
async function handleBetEvent(type: string, data: any) {
  const record = new AnalyticsData();
  record.id = uuidv4();
  record.roundId = data.roundId || null;
  record.userId = data.userId || null;
  record.betAmount = data.amount || 0;
  record.payout = type === 'CASHOUT' ? data.payout || 0 : 0;
  record.cashoutType = type;
  record.depositAmount = 0;
  record.withdrawalAmount = 0;
  record.walletBalanceChange = type === 'CASHOUT' ? (data.finalMultiplier || 1) * data.amount - data.amount : 0;
  record.createdAt = new Date();

  await handleDrizzleTransaction(client.$transaction, record);
}

async function handleRoundEnd(data: any) {
  const record = new AnalyticsData();
  record.id = uuidv4();
  record.roundId = data.roundId;
  record.userId = null;
  record.betAmount = data.totalBets || 0;
  record.payout = data.totalPayouts || 0;
  record.cashoutType = null;
  record.depositAmount = 0;
  record.withdrawalAmount = 0;
  record.walletBalanceChange = data.totalPayouts - data.totalBets;
  record.createdAt = new Date(data.timestamp || Date.now());

  await handleDrizzleTransaction(client.$transaction, record);
}

async function handleWalletEvent(type: string, data: any) {
  const record = new AnalyticsData();
  record.id = uuidv4();
  record.roundId = null;
  record.userId = data.userId || null;
  record.betAmount = 0;
  record.payout = 0;
  record.cashoutType = null;
  record.depositAmount = type === 'DEPOSIT' ? data.amount || 0 : 0;
  record.withdrawalAmount = type === 'WITHDRAWAL' ? data.amount || 0 : 0;
  record.walletBalanceChange = type === 'DEPOSIT' ? data.amount : -data.amount;
  record.createdAt = new Date();

  await handleDrizzleTransaction(client.$transaction, record);
}

function updateMultiplier(data: any) {}

// Export analytics API
export class AnalyticsService {
  static getRTP(): number {
    if (!analyticsRecords.length) return 0;
    const totalBets = analyticsRecords.reduce((sum, r) => sum + (r.betAmount || 0), 0);
    const totalPayouts = analyticsRecords.reduce((sum, r) => sum + (r.payout || 0), 0);
    return (totalPayouts / totalBets) * 100 || 0;
  }

  static getRTPForRound(roundId: string): number {
    const roundRecords = analyticsRecords.filter(r => r.roundId === roundId);
    if (roundRecords.length === 0) return 0;
    const totalBets = roundRecords.reduce((sum, r) => sum + (r.betAmount || 0), 0);
    const totalPayouts = roundRecords.reduce((sum, r) => sum + (r.payout || 0), 0);
    return (totalPayouts / totalBets) * 100 || 0;
  }

  static getRevenueMetrics(): { deposits: number; withdrawals: number } {
    const today = new Date().toISOString().split('T')[0];
    const todayMetrics = await client.$select({
      table: 'revenue_metrics',
      where: { date: today }
    });
    return todayMetrics[0] || { deposits: 0, withdrawals: 0 };
  }

  static getPlayerStats(userId: string): {
    totalBets: number;
    totalWinnings: number;
    winRate: number;
    deposits: number;
    withdrawals: number;
  } {
    const userStats = await client.$select({
      table: 'player_stats',
      where: { userId }
    });
    return userStats[0] || {
      totalBets: 0,
      totalWinnings: 0,
      winRate: 0,
      deposits: 0,
      withdrawals: 0
    };
  }
}

// Start tracking automatically
analyticsListeners.deposit = handleWalletEvent('DEPOSIT');
analyticsListeners.withdrawal = handleWalletEvent('WITHDRAWAL');