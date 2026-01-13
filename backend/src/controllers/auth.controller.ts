import { Request, Response } from 'express';
import { SiweMessage, generateNonce } from 'siwe';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

export class AuthController {
  async getNonce(req: Request, res: Response) {
    const nonce = generateNonce();
    req.session.nonce = nonce;

    logger.debug('SIWE nonce generated', {
      ip: req.ip,
      nonce: nonce.substring(0, 8) + '...',
    });

    res.json({ nonce });
  }

  async verify(req: Request, res: Response) {
    const { message, signature } = req.body;

    if (!message || !signature) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Message and signature are required',
      });
    }

    if (!req.session.nonce) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No nonce found in session. Call /auth/nonce first.',
      });
    }

    try {
      const siweMessage = new SiweMessage(message);
      
      logger.info('[SIWE Verification] Attempting verification', {
        messageAddress: siweMessage.address?.substring(0, 10) + '...',
        messageChainId: siweMessage.chainId,
        messageNonce: siweMessage.nonce,
        sessionNonce: req.session.nonce?.substring(0, 8) + '...',
        noncesMatch: siweMessage.nonce === req.session.nonce,
      });

      const verifiedMessage = await siweMessage.verify({
        signature,
        nonce: req.session.nonce,
      });

      if (!verifiedMessage.success) {
        logger.error('[SIWE Verification] Verification returned failure', {
          error: verifiedMessage.error?.type,
          errorMessage: (verifiedMessage.error as any)?.expected 
            ? `Expected: ${(verifiedMessage.error as any).expected}, Received: ${(verifiedMessage.error as any).received}`
            : String(verifiedMessage.error),
          ip: req.ip,
        });
        return res.status(401).json({
          error: 'Unauthorized',
          message: `Verification failed: ${verifiedMessage.error?.type || 'Unknown error'}`,
        });
      }

      const walletAddress = verifiedMessage.data.address.toLowerCase();

      logger.info('[SIWE Verification] Decoded message from SIWE', {
        message: message.substring(0, 100) + '...',
        address: siweMessage.address.substring(0, 10) + '...',
        chainId: siweMessage.chainId,
        nonce: siweMessage.nonce,
      });

      let user = await db.query.users.findFirst({
        where: eq(users.walletAddress, walletAddress),
      });

      if (!user) {
        const now = new Date();
        const [newUser] = await db
          .insert(users)
          .values({
            walletAddress,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        user = newUser;
        logger.info('New user created via SIWE', { walletAddress });
      } else {
        logger.info('Existing user authenticated via SIWE', { walletAddress });
      }

      req.session.siwe = {
        address: walletAddress,
        chainId: verifiedMessage.data.chainId,
      };
      delete req.session.nonce;

      logger.info('[SIWE Verification] Success', {
        walletAddress,
        chainId: verifiedMessage.data.chainId,
        ip: req.ip,
      });

      res.json({
        walletAddress: user.walletAddress,
        ensName: user.ensName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('[SIWE Verification] Failed', {
        errorName: err.name,
        errorMessage: err.message,
        errorStack: err.stack?.split('\n').slice(0, 3).join('\n'),
        ip: req.ip,
      });

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid signature',
      });
    }
  }

  async getUser(req: Request, res: Response) {
    if (!req.session.siwe?.address) {
      logger.debug('Get user request: not authenticated', { ip: req.ip });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, req.session.siwe.address),
    });

    if (!user) {
      logger.warn('Session user not found in database', {
        walletAddress: req.session.siwe.address,
      });
      req.session.destroy(() => {});
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    logger.debug('Get user request', { walletAddress: user.walletAddress });

    res.json({
      walletAddress: user.walletAddress,
      ensName: user.ensName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async logout(req: Request, res: Response) {
    const walletAddress = req.session.siwe?.address;
    logger.info('User logout initiated', { walletAddress, ip: req.ip });

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destroy error', {
          error: err.message,
          walletAddress,
        });
        return res.status(500).json({
          error: 'InternalServerError',
          message: 'Failed to logout',
        });
      }

      logger.info('User logged out successfully', { walletAddress });
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  }

  async getStatus(req: Request, res: Response) {
    const authenticated = !!req.session.siwe?.address;
    logger.debug('Auth status check', {
      authenticated,
      walletAddress: req.session.siwe?.address || null,
      ip: req.ip,
    });

    if (!authenticated) {
      return res.json({ authenticated: false, user: null });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, req.session.siwe!.address),
    });

    res.json({
      authenticated: true,
      user: user
        ? {
            walletAddress: user.walletAddress,
            ensName: user.ensName,
          }
        : null,
    });
  }
}

export const authController = new AuthController();
