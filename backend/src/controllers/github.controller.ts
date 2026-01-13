import { Request, Response } from 'express';
import { db } from '../db';
import { githubInstallations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { githubAppService } from '../services/github-app.service';
import { generateId } from '../utils/generateId';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class GitHubController {
  async getInstallUrl(req: Request, res: Response) {
    const userId = req.userId!;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const returnPath = (req.query.returnPath as string) || '/dashboard';
    const state = Buffer.from(JSON.stringify({ userId, returnPath })).toString('base64url');
    const url = githubAppService.getInstallUrl(state);

    res.json({ url });
  }

  async handleCallback(req: Request, res: Response) {
    const { installation_id, setup_action, state } = req.query;

    if (setup_action === 'install' && installation_id && state) {
      try {
        const decoded = JSON.parse(
          Buffer.from(state as string, 'base64url').toString('utf8')
        );
        const userId = decoded.userId;
        const returnPath = decoded.returnPath || '/dashboard';

        if (!userId) {
          logger.error('GitHub callback: missing userId in state');
          return res.redirect(`${env.FRONTEND_URL}/#/github/error?message=Invalid state`);
        }

        const installation = await githubAppService.getInstallation(
          Number(installation_id)
        );

        const existing = await db.query.githubInstallations.findFirst({
          where: eq(githubInstallations.installationId, Number(installation_id)),
        });

        if (existing) {
          if (existing.userId !== userId) {
            logger.warn('Installation already linked to different user', {
              installationId: installation_id,
              existingUserId: existing.userId,
              newUserId: userId,
            });
          }
          return res.redirect(`${env.FRONTEND_URL}/#/github/success?returnPath=${encodeURIComponent(returnPath)}`);
        }

        const account = installation.account as { login?: string; name?: string; type?: string; avatar_url?: string } | null;
        const accountLogin = account?.login || account?.name || 'unknown';
        const accountType = account?.type || 'User';
        const accountAvatarUrl = account?.avatar_url || null;

        await db.insert(githubInstallations).values({
          id: generateId(),
          userId,
          installationId: Number(installation_id),
          accountLogin,
          accountType,
          accountAvatarUrl,
          createdAt: new Date(),
        });

        logger.info('GitHub installation saved', {
          userId,
          installationId: installation_id,
          accountLogin,
        });

        return res.redirect(`${env.FRONTEND_URL}/#/github/success?returnPath=${encodeURIComponent(returnPath)}`);
      } catch (error) {
        logger.error('GitHub callback error', {
          error: (error as Error).message,
          installation_id,
        });
        return res.redirect(
          `${env.FRONTEND_URL}/#/github/error?message=${encodeURIComponent(
            (error as Error).message
          )}`
        );
      }
    }

    if (setup_action === 'update') {
      return res.redirect(`${env.FRONTEND_URL}/#/github/success`);
    }

    res.redirect(`${env.FRONTEND_URL}/#/dashboard`);
  }

  async listInstallations(req: Request, res: Response) {
    const userId = req.userId!;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const installations = await db.query.githubInstallations.findMany({
      where: eq(githubInstallations.userId, userId),
    });

    const validInstallations: (typeof githubInstallations.$inferSelect)[] = [];
    const staleIds: string[] = [];

    for (const installation of installations) {
      try {
        await githubAppService.getInstallation(installation.installationId);
        validInstallations.push(installation);
      } catch (error: unknown) {
        const status = (error as { status?: number })?.status;
        if (status === 404) {
          logger.info('Removing stale GitHub installation', {
            id: installation.id,
            installationId: installation.installationId,
            accountLogin: installation.accountLogin,
          });
          staleIds.push(installation.id);
        } else {
          logger.warn('Failed to validate GitHub installation', {
            installationId: installation.installationId,
            error: (error as Error).message,
          });
          validInstallations.push(installation);
        }
      }
    }

    if (staleIds.length > 0) {
      for (const id of staleIds) {
        await db.delete(githubInstallations).where(eq(githubInstallations.id, id));
      }
    }

    res.json(
      validInstallations.map((i) => ({
        id: i.id,
        installationId: i.installationId,
        accountLogin: i.accountLogin,
        accountType: i.accountType,
        accountAvatarUrl: i.accountAvatarUrl,
        createdAt: i.createdAt,
      }))
    );
  }

  async removeInstallation(req: Request, res: Response) {
    const userId = req.userId!;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const installation = await db.query.githubInstallations.findFirst({
      where: and(
        eq(githubInstallations.id, id),
        eq(githubInstallations.userId, userId)
      ),
    });

    if (!installation) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.id, id));

    logger.info('GitHub installation removed', {
      userId,
      installationId: installation.installationId,
    });

    res.json({ message: 'Installation removed' });
  }

  async listRepos(req: Request, res: Response) {
    const userId = req.userId!;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const installations = await db.query.githubInstallations.findMany({
      where: eq(githubInstallations.userId, userId),
    });

    if (installations.length === 0) {
      return res.json([]);
    }

    const allRepos = [];
    for (const installation of installations) {
      try {
        const repos = await githubAppService.listInstallationRepos(
          installation.installationId
        );
        allRepos.push(
          ...repos.map((r) => ({
            ...r,
            installationId: installation.id,
            accountLogin: installation.accountLogin,
          }))
        );
      } catch (error) {
        logger.warn('Failed to list repos for installation', {
          installationId: installation.installationId,
          error: (error as Error).message,
        });
      }
    }

    res.json(allRepos);
  }

  async listBranches(req: Request, res: Response) {
    const userId = req.session.siwe?.address;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { installationId, owner, repo } = req.params;

    const installation = await db.query.githubInstallations.findFirst({
      where: and(
        eq(githubInstallations.id, installationId),
        eq(githubInstallations.userId, userId)
      ),
    });

    if (!installation) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    try {
      const branches = await githubAppService.listBranches(
        installation.installationId,
        owner,
        repo
      );
      res.json(branches);
    } catch (error) {
      logger.error('Failed to list branches', {
        installationId,
        owner,
        repo,
        error: (error as Error).message,
      });
      res.status(500).json({ error: 'Failed to list branches' });
    }
  }
}

export const githubController = new GitHubController();
