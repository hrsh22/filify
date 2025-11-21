import { Request, Response } from 'express';
import passport from 'passport';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class AuthController {
  async githubAuth(req: Request, res: Response) {
    passport.authenticate('github', { scope: ['user:email', 'repo'] })(req, res);
  }

  async githubCallback(req: Request, res: Response) {
    passport.authenticate('github', (err: Error | null, user: Express.User | false) => {
      if (err) {
        logger.error('GitHub OAuth error:', err);
        return res.redirect(`${env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(err.message)}`);
      }

      if (!user) {
        return res.redirect(`${env.FRONTEND_URL}/auth/error?message=Authentication failed`);
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          logger.error('Login error:', loginErr);
          return res.redirect(`${env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(loginErr.message)}`);
        }

        // Redirect to frontend with success
        return res.redirect(`${env.FRONTEND_URL}/auth/success`);
      });
    })(req, res);
  }

  async getUser(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }

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
    req.logout((err) => {
      if (err) {
        logger.error('Logout error:', err);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to logout',
        });
      }

      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          logger.error('Session destroy error:', sessionErr);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to destroy session',
          });
        }

        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      });
    });
  }

  async getStatus(req: Request, res: Response) {
    res.json({
      authenticated: req.isAuthenticated(),
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

