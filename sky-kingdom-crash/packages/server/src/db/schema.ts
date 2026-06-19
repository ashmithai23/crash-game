// ============================================================
// Database Schema — Drizzle ORM (PostgreSQL)
// ============================================================
// All tables for permanent data storage.
// Only finalized events are persisted.
// Live state lives in Redis.
// ============================================================

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  uniqueIndex,
  index,
  jsonb,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Users ───────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: varchar('username', { length: 32 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    googleId: text('google_id').unique(),
    isAdmin: boolean('is_admin').notNull().default(false),
    isBanned: boolean('is_banned').notNull().default(false),
    selectedCharacter: text('selected_character').notNull().default('baby_trump'),
    unlockedCharacters: jsonb('unlocked_characters').notNull().default(['baby_trump']),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at').notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
    googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId),
  }),
);

// ─── Wallets ─────────────────────────────────────────────────

export const wallets = pgTable(
  'wallets',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .primaryKey(),
    balance: decimal('balance', { precision: 20, scale: 2 }).notNull().default('0'),
    reservedBalance: decimal('reserved_balance', { precision: 20, scale: 2 }).notNull().default('0'),
    totalDeposited: decimal('total_deposited', { precision: 20, scale: 2 }).notNull().default('0'),
    totalWithdrawn: decimal('total_withdrawn', { precision: 20, scale: 2 }).notNull().default('0'),
    totalBets: decimal('total_bets', { precision: 20, scale: 2 }).notNull().default('0'),
    totalWinnings: decimal('total_winnings', { precision: 20, scale: 2 }).notNull().default('0'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex('wallets_user_id_idx').on(table.userId),
  }),
);

// ─── Sessions ────────────────────────────────────────────────

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    accessTokenIdx: uniqueIndex('sessions_access_token_idx').on(table.accessToken),
    refreshTokenIdx: uniqueIndex('sessions_refresh_token_idx').on(table.refreshToken),
  }),
);

// ─── Rounds (Permanent Record) ──────────────────────────────

export const rounds = pgTable(
  'rounds',
  {
    id: text('id').primaryKey(),
    roundNumber: integer('round_number').notNull(),
    crashMultiplier: decimal('crash_multiplier', { precision: 10, scale: 2 }).notNull(),
    serverSeedHash: text('server_seed_hash').notNull(),
    clientSeed: text('client_seed').notNull(),
    nonce: integer('nonce').notNull(),
    roundHash: text('round_hash').notNull(),
    totalBets: decimal('total_bets', { precision: 20, scale: 2 }).notNull().default('0'),
    totalPayouts: decimal('total_payouts', { precision: 20, scale: 2 }).notNull().default('0'),
    activePlayers: integer('active_players').notNull().default(0),
    startedAt: timestamp('started_at').notNull(),
    launchedAt: timestamp('launched_at'),
    crashedAt: timestamp('crashed_at'),
    endedAt: timestamp('ended_at').notNull(),
    duration: integer('duration').notNull(), // ms
  },
  (table) => ({
    roundNumberIdx: index('rounds_round_number_idx').on(table.roundNumber),
    endedAtIdx: index('rounds_ended_at_idx').on(table.endedAt),
  }),
);

// ─── Round Seeds (Audit Trail) ──────────────────────────────

export const roundSeeds = pgTable(
  'round_seeds',
  {
    id: text('id').primaryKey(),
    roundId: text('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    serverSeed: text('server_seed').notNull(),    // revealed after round
    serverSeedHash: text('server_seed_hash').notNull(),
    clientSeed: text('client_seed').notNull(),
    nonce: integer('nonce').notNull(),
    roundHash: text('round_hash').notNull(),
    crashPoint: decimal('crash_point', { precision: 10, scale: 2 }).notNull(),
    revealedAt: timestamp('revealed_at'),
  },
  (table) => ({
    roundIdIdx: uniqueIndex('round_seeds_round_id_idx').on(table.roundId),
  }),
);

// ─── Bets ────────────────────────────────────────────────────

export const bets = pgTable(
  'bets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roundId: text('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 20, scale: 2 }).notNull(),
    autoCashoutMultiplier: decimal('auto_cashout_multiplier', { precision: 10, scale: 2 }),
    dualBetAmount: decimal('dual_bet_amount', { precision: 20, scale: 2 }),
    dualCashoutMultiplier: decimal('dual_cashout_multiplier', { precision: 10, scale: 2 }),
    status: text('status', { enum: ['PENDING', 'ACTIVE', 'CASHED_OUT', 'LOST', 'REFUNDED'] }).notNull(),
    cashoutMultiplier: decimal('cashout_multiplier', { precision: 10, scale: 2 }),
    payout: decimal('payout', { precision: 20, scale: 2 }),
    placedAt: timestamp('placed_at').notNull(),
    cashedOutAt: timestamp('cashed_out_at'),
  },
  (table) => ({
    userIdIdx: index('bets_user_id_idx').on(table.userId),
    roundIdIdx: index('bets_round_id_idx').on(table.roundId),
    statusIdx: index('bets_status_idx').on(table.status),
    userIdStatusIdx: index('bets_user_id_status_idx').on(table.userId, table.status),
  }),
);

// ─── Transactions ────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['BET', 'CASHOUT', 'DEPOSIT', 'WITHDRAWAL', 'REFUND', 'BONUS'],
    }).notNull(),
    amount: decimal('amount', { precision: 20, scale: 2 }).notNull(),
    balanceBefore: decimal('balance_before', { precision: 20, scale: 2 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 20, scale: 2 }).notNull(),
    status: text('status', { enum: ['PENDING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'] }).notNull(),
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key'),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    userIdIdx: index('transactions_user_id_idx').on(table.userId),
    typeIdx: index('transactions_type_idx').on(table.type),
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
    idempotencyKeyIdx: uniqueIndex('transactions_idempotency_key_idx').on(table.idempotencyKey),
  }),
);

// ─── Leaderboards (Materialized Snapshot) ────────────────────

export const leaderboards = pgTable(
  'leaderboards',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    period: text('period', { enum: ['daily', 'weekly', 'monthly', 'all_time'] }).notNull(),
    totalProfit: decimal('total_profit', { precision: 20, scale: 2 }).notNull().default('0'),
    totalBets: integer('total_bets').notNull().default(0),
    winRate: decimal('win_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    biggestWin: decimal('biggest_win', { precision: 20, scale: 2 }).notNull().default('0'),
    highestMultiplier: decimal('highest_multiplier', { precision: 10, scale: 2 }).notNull().default('0'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdPeriodIdx: uniqueIndex('leaderboard_user_id_period_idx').on(table.userId, table.period),
    periodProfitIdx: index('leaderboard_period_profit_idx').on(table.period, table.totalProfit),
  }),
);

// ─── Chat Messages ───────────────────────────────────────────

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
  }),
);

// ─── Analytics Events ────────────────────────────────────────

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    eventTypeIdx: index('analytics_event_type_idx').on(table.eventType),
    createdAtIdx: index('analytics_created_at_idx').on(table.createdAt),
  }),
);

// ─── Audit Logs ──────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    targetId: text('target_id'),
    targetType: text('target_type').notNull(),
    changes: jsonb('changes'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    actorIdx: index('audit_logs_actor_idx').on(table.actorId),
  }),
);