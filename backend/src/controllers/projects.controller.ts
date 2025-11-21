import { Request, Response } from 'express';
import { db } from '../db';
import { projects } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../utils/generateId';
import { encryptionService } from '../services/encryption.service';
import { githubService } from '../services/github.service';
import { logger } from '../utils/logger';

export class ProjectsController {
  async list(req: Request, res: Response) {
    const userId = (req.user as any).id;

    try {
      const userProjects = await db.query.projects.findMany({
        where: eq(projects.userId, userId),
        with: {
          deployments: {
            limit: 1,
            orderBy: (deployments, { desc }) => [desc(deployments.createdAt)],
          },
        },
      });

      res.json(userProjects);
    } catch (error) {
      logger.error('Failed to list projects:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch projects',
      });
    }
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          deployments: {
            orderBy: (deployments, { desc }) => [desc(deployments.createdAt)],
            limit: 10,
          },
        },
      });

      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      res.json(project);
    } catch (error) {
      logger.error('Failed to get project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch project',
      });
    }
  }

  async create(req: Request, res: Response) {
    const userId = (req.user as any).id;
    const user = req.user as any;
    const {
      name,
      repoName,
      repoUrl,
      repoBranch,
      ensName,
      ensPrivateKey,
      ethereumRpcUrl,
      buildCommand,
      outputDir,
    } = req.body;

    try {
      // Validate repository access
      const [owner, repo] = repoName.split('/');
      await githubService.getRepository(user.githubToken, owner, repo);

      // Encrypt sensitive data
      const encryptedENSKey = encryptionService.encrypt(ensPrivateKey);

      const project = await db
        .insert(projects)
        .values({
          id: generateId(),
          userId,
          name,
          repoName,
          repoUrl,
          repoBranch: repoBranch || 'main',
          ensName,
          ensPrivateKey: encryptedENSKey,
          ethereumRpcUrl,
          buildCommand: buildCommand || null,
          outputDir: outputDir || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json(project[0]);
    } catch (error) {
      logger.error('Failed to create project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create project',
      });
    }
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const updates = req.body;

    try {
      // Verify ownership
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      // Encrypt ENS key if provided
      if (updates.ensPrivateKey) {
        updates.ensPrivateKey = encryptionService.encrypt(updates.ensPrivateKey);
      }

      const updated = await db
        .update(projects)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      logger.error('Failed to update project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update project',
      });
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      await db.delete(projects).where(eq(projects.id, id));

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete project',
      });
    }
  }
}

export const projectsController = new ProjectsController();




