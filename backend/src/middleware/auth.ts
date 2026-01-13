import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    nonce?: string;
    siwe?: {
      address: string;
      chainId: number;
    };
  }
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.siwe?.address) {
    req.userId = req.session.siwe.address;
    return next();
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'You must be logged in to access this resource',
  });
}

export function attachUser(req: Request, res: Response, next: NextFunction) {
  if (req.session.siwe?.address) {
    req.userId = req.session.siwe.address;
  }
  next();
}
