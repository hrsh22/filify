import { Request, Response } from 'express';
import passport from 'passport';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class AuthController {
  async githubAuth(req: Request, res: Response) {
    logger.info('GitHub OAuth initiated', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    passport.authenticate('github', { scope: ['user:email', 'repo'] })(req, res);
  }

  async githubCallback(req: Request, res: Response) {
    logger.debug('GitHub OAuth callback received');
    passport.authenticate('github', (err: Error | null, user: Express.User | false) => {
      if (err) {
        logger.error('GitHub OAuth error:', {
          error: err.message,
          stack: err.stack,
          ip: req.ip,
        });
        return res.redirect(`${env.FRONTEND_URL}/#/auth/error?message=${encodeURIComponent(err.message)}`);
      }

      if (!user) {
        logger.warn('GitHub OAuth callback: user not found', {
          ip: req.ip,
        });
        return res.redirect(`${env.FRONTEND_URL}/#/auth/error?message=Authentication failed`);
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          logger.error('Login error:', {
            error: loginErr.message,
            stack: loginErr.stack,
            userId: user.id,
          });
          return res.redirect(`${env.FRONTEND_URL}/#/auth/error?message=${encodeURIComponent(loginErr.message)}`);
        }

        logger.info('User authenticated successfully', {
          userId: user.id,
          githubUsername: user.githubUsername,
          ip: req.ip,
        });
        // Redirect to frontend with success
        return res.redirect(`${env.FRONTEND_URL}/#/auth/success`);
      });
    })(req, res);
  }

  async getUser(req: Request, res: Response) {
    if (!req.user) {
      logger.debug('Get user request: not authenticated', {
        ip: req.ip,
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }

    logger.debug('Get user request', {
      userId: req.user.id,
      githubUsername: req.user.githubUsername,
    });

    // Don't expose sensitive data
    const user = req.user;
    res.json({
      id: user.id,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
      githubEmail: user.githubEmail,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async logout(req: Request, res: Response) {
    const userId = (req.user as any)?.id;
    logger.info('User logout initiated', {
      userId,
      ip: req.ip,
    });

    req.logout((err) => {
      if (err) {
        logger.error('Logout error:', {
          error: err.message,
          stack: err.stack,
          userId,
        });
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to logout',
        });
      }

      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          logger.error('Session destroy error:', {
            error: sessionErr.message,
            stack: sessionErr.stack,
            userId,
          });
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to destroy session',
          });
        }

        logger.info('User logged out successfully', {
          userId,
        });
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      });
    });
  }

  async getStatus(req: Request, res: Response) {
    const authenticated = req.isAuthenticated();
    logger.debug('Auth status check', {
      authenticated,
      userId: req.user?.id || null,
      ip: req.ip,
    });

    res.json({
      authenticated,
      user: req.user
        ? {
          id: req.user.id,
          githubUsername: req.user.githubUsername,
          avatarUrl: req.user.avatarUrl,
        }
        : null,
    });
  }
}

export const authController = new AuthController();

