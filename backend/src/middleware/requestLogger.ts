import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;
  const userAgent = req.get('user-agent') || 'unknown';

  // Log request start
  logger.info(`${method} ${originalUrl}`, {
    ip,
    userAgent,
    userId: (req.user as any)?.id || 'anonymous',
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](`${method} ${originalUrl} ${statusCode}`, {
      duration: `${duration}ms`,
      statusCode,
      ip,
      userId: (req.user as any)?.id || 'anonymous',
    });
  });

  next();
}

