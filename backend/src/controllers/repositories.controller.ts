import { Request, Response } from 'express';
import { db } from '../db';
import { githubInstallations } from '../db/schema';
import { eq } from 'drizzle-orm';
import { githubAppService } from '../services/github-app.service';
import { logger } from '../utils/logger';

export class RepositoriesController {
  async list(req: Request, res: Response) {
    const userId = req.userId!;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
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
    } catch (error) {
      logger.error('Failed to list repositories:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch repositories',
      });
    }
  }

  async getBranches(req: Request, res: Response) {
    const { owner, repo, installationId } = req.params;
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const installation = await db.query.githubInstallations.findFirst({
        where: eq(githubInstallations.id, installationId),
      });

      if (!installation || installation.userId !== userId) {
        return res.status(404).json({ error: 'Installation not found' });
      }

      const branches = await githubAppService.listBranches(
        installation.installationId,
        owner,
        repo
      );
      res.json(branches);
    } catch (error) {
      logger.error('Failed to list branches:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch branches',
      });
    }
  }
}

export const repositoriesController = new RepositoriesController();
