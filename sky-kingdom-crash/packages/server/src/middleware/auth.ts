// ============================================================
// Auth Middleware — JWT Verification
// ============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  isAdmin?: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'skc-jwt-secret-change-in-production';

/**
 * Require a valid JWT access token.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      username: string;
      isAdmin?: boolean;
    };
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.isAdmin = decoded.isAdmin ?? false;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Require admin privileges.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.isAdmin) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Optional auth — sets user info if token present, but doesn't block.
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        username: string;
        isAdmin?: boolean;
      };
      req.userId = decoded.userId;
      req.username = decoded.username;
      req.isAdmin = decoded.isAdmin ?? false;
    } catch {
      // Token invalid, continue without auth
    }
  }
  next();
}