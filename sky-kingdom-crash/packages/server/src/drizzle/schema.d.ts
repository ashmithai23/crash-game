// Drizzle schema for analytics

export const config = {
  // Analytics tables
  analytics: {
    revenue_metrics: {
      engine: 'redis',
      tableName: 'revenue_metrics',
      schema: {
        id: { primaryKey: true, type: 'uuid' },
        date: { type: 'date' },
        totalDeposits: { type: 'number' },
        totalWithdrawals: { type: 'number' },
        totalRevenue: { type: 'number' }
      }
    },

    player_stats: {
      engine: 'redis',
      tableName: 'player_stats',
      schema: {
        id: { primaryKey: true, type: 'uuid' },
        userId: { type: 'string' },
        totalBets: { type: 'number' },
        totalWinnings: { type: 'number' },
        winRate: { type: 'number' },
        deposits: { type: 'number' },
        withdrawals: { type: 'number' }
      },
      relations: {
        userId: { references: 'wallets.userId' }
      }
    },

    rtp_snapshots: {
      engine: 'redis',
      tableName: 'rtp_snapshots',
      schema: {
        id: { primaryKey: true, type: 'uuid' },
        createdAt: { type: 'date' },
        rtpPercentage: { type: 'number' }
      }
    }
  }
};

// Drizzle relations
const relations = {
  player_stats: {
    userId: { table: 'wallets', column: 'userId' }
  }
};
export { config, relations };