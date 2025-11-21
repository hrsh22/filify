import { Request, Response } from 'express';
import { githubService } from '../services/github.service';
import { logger } from '../utils/logger';

export class RepositoriesController {
  async list(req: Request, res: Response) {
    const user = req.user as any;

    try {
      const repos = await githubService.listRepositories(user.githubToken);
      res.json(repos);
    } catch (error) {
      logger.error('Failed to list repositories:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch repositories',
      });
    }
  }

  async getBranches(req: Request, res: Response) {
    const { owner, repo } = req.params;
    const user = req.user as any;

    try {
      const branches = await githubService.listBranches(user.githubToken, owner, repo);
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




