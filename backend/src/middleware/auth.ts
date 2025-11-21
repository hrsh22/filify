import { Request, Response, NextFunction } from 'express';

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'You must be logged in to access this resource',
  });
}

export function attachUser(req: Request, res: Response, next: NextFunction) {
  // Make user available in req for authenticated routes
  if (req.user) {
    req.userId = req.user.id;
  }
  next();
}




