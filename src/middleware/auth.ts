import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types';

// Extend the Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: 'admin' | 'user';
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({
        success: false,
        message: 'JWT secret is not configured'
      });
      return;
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          res.status(401).json({
            success: false,
            message: 'Access token has expired'
          });
          return;
        }
        
        if (err.name === 'JsonWebTokenError') {
          res.status(401).json({
            success: false,
            message: 'Invalid access token'
          });
          return;
        }

        res.status(401).json({
          success: false,
          message: 'Token verification failed'
        });
        return;
      }

      const payload = decoded as JwtPayload;
      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      };

      next();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  next();
};

// Optional authentication - sets user if token is valid but doesn't fail if not
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      next();
      return;
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (!err && decoded) {
        const payload = decoded as JwtPayload;
        req.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role
        };
      }
      next();
    });
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Generate JWT token
export const generateToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRE || '7d';

  if (!secret) {
    throw new Error('JWT secret is not configured');
  }
// @ts-ignore
  return jwt.sign(payload, secret, { expiresIn });
};

// Verify and decode token without middleware
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    return null;
  }
};
