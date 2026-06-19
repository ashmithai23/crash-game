// Analytics API routes (Hardened)

import express from 'express';
import { AnalyticsService } from '../analytics/AnalyticsService';
import type { Request, Response } from 'express';
import { validateUserId, validateDate, validateTimeframe } from '../utils/validators';
import { RateLimiterMiddleware } from '../middleware/rateLimiter';
import type { RateLimitConfig } from '../config/types';

const router = express.Router();

// Rate limiter config
const rateLimitConfig: RateLimitConfig = {
  analytics: {
    maxRequests: 100,
    windowMs: 60 * 1000
  }
};

// Validation middleware
const validationMiddleware = (req: Request, res: Response, next: any) => {
  try {
    // Validate userId (UUID format)
    if (req.params && req.params.userId) {
      validateUserId(req.params.userId);
    }

    // Validate date queries
    if (req.query && req.query.date) {
      validateDate(req.query.date as string);
    }

    // Validate timeframe queries
    if (req.query && req.query.timeframe) {
      validateTimeframe(req.query.timeframe as string);
    }

    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid request parameters' });
  }
};

// RTP Endpoint
router.get('/rtp', RateLimiterMiddleware(rateLimitConfig.analytics), validationMiddleware, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;

    if (date) {
      // Historical RTP
      const rtp = await AnalyticsService.getRTPForDate(date as string);
      res.json({ rtpPercentage: rtp });
    } else {
      // Current RTP
      const currentRTP = AnalyticsService.getRTP();
      res.json({ currentRTPPercentage: currentRTP });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RTP data' });
  }
});

// Revenue Endpoint
router.get('/revenue', RateLimiterMiddleware(rateLimitConfig.analytics), validationMiddleware, async (req: Request, res: Response) => {
  try {
    const { timeframe } = req.query as { timeframe: 'daily' | 'weekly' | 'monthly' };

    if (!timeframe) {
      return res.status(400).json({ error: 'Timeframe parameter required' });
    }

    switch (timeframe) {
      case 'daily':
        const dailyRevenue = await AnalyticsService.getDailyRevenue({ limit: req.query.limit, offset: req.query.offset });
        res.json({ dailyRevenue });
        break;
      case 'weekly':
        const weeklyRevenue = await AnalyticsService.getWeeklyRevenue({ sort: req.query.sort });
        res.json({ weeklyRevenue });
        break;
      case 'monthly':
        const monthlyRevenue = await AnalyticsService.getMonthlyRevenue({ fromDate: req.query.fromDate, toDate: req.query.toDate });
        res.json({ monthlyRevenue });
        break;
      default:
        res.status(400).json({ error: 'Invalid timeframe parameter' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// Player Statistics Endpoint
router.get('/player/:userId', RateLimiterMiddleware(rateLimitConfig.analytics), validationMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { limit, offset } = req.query;

    const playerStats = await AnalyticsService.getPlayerStats(userId, { limit: parseInt(limit || '10'), offset: parseInt(offset || '0') });
    res.json(playerStats);
  } catch (error) {
    res.status(404).json({ error: 'Player not found' });
  }
});

// Dashboard Endpoint
router.get('/dashboard', RateLimiterMiddleware(rateLimitConfig.analytics), validationMiddleware, async (req: Request, res: Response) => {
  try {
    const dashboardData = {
      globalRTP: AnalyticsService.getRTP(),
      activePlayers: await AnalyticsService.getActivePlayers(),
      revenueSummary: await AnalyticsService.getRevenueSummary(),
      totalWagers: await AnalyticsService.getTotalWagers(),
      totalPayouts: await AnalyticsService.getTotalPayouts()
    };
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;