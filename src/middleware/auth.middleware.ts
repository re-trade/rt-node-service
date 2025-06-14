import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import configLoader from '../configs/config-loader.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token is required',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, configLoader.config.JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, configLoader.config.JWT_SECRET) as any;
      req.user = decoded;
    } catch (error) {
      console.warn('Invalid token provided, continuing without authentication');
    }
  }

  next();
};

export const generateToken = (payload: {
  id: string;
  username: string;
  email?: string;
}): string => {
  return jwt.sign(payload, configLoader.config.JWT_SECRET, {
    expiresIn: '24h',
  });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, configLoader.config.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};
