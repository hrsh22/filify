import { Request, Response } from 'express';
import { db } from '../db';
import { projects } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../utils/generateId';
import { githubService } from '../services/github.service';
import { logger } from '../utils/logger';
import { webhookSecretService } from '../services/webhook-secret.service';
import { env } from '../config/env';

const WEBHOOK_ENDPOINT = '/api/webhooks/github';

function getWebhookUrl() {
  return new URL(WEBHOOK_ENDPOINT, env.BACKEND_URL).toString();
}

export class ProjectsController {
  async list(req: Request, res: Response) {
    const userId = (req.user as any).id;

    logger.debug('Listing projects', { userId });

    try {
      const userProjects = await db.query.projects.findMany({
        where: eq(projects.userId, userId),
        with: {
          deployments: {
            limit: 1,
            orderBy: (deployments: any, { desc }: any) => [desc(deployments.createdAt)],
          },
        },
      });

      logger.info('Projects listed successfully', {
        userId,
        count: userProjects.length,
      });

      res.json(userProjects);
    } catch (error) {
      logger.error('Failed to list projects:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch projects',
      });
    }
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;

    logger.debug('Getting project by ID', { projectId: id, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          deployments: {
            orderBy: (deployments: any, { desc }: any) => [desc(deployments.createdAt)],
            limit: 10,
          },
        },
      });

      if (!project) {
        logger.warn('Project not found', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      logger.debug('Project retrieved successfully', {
        projectId: id,
        projectName: project.name,
        userId,
      });

      res.json(project);
    } catch (error) {
      logger.error('Failed to get project:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: id,
        userId,
      });
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
      ensOwnerAddress,
      ethereumRpcUrl,
      buildCommand,
      outputDir,
      frontendDir,
    } = req.body;

    const normalizedOwnerAddress = ensOwnerAddress.toLowerCase();

    logger.info('Creating new project', {
      userId,
      projectName: name,
      repoName,
      repoBranch: repoBranch || 'main',
      ensName,
      ensOwnerAddress: normalizedOwnerAddress,
    });

    try {
      // Validate repository access
      const [owner, repo] = repoName.split('/');
      logger.debug('Validating repository access', { owner, repo, userId });
      await githubService.getRepository(user.githubToken, owner, repo);
      logger.debug('Repository access validated', { owner, repo });

      const secretPlain = webhookSecretService.generate();
      const encryptedSecret = webhookSecretService.encrypt(secretPlain);
      const webhookUrl = getWebhookUrl();
      const selectedBranch = repoBranch || 'main';

      logger.debug('Registering GitHub webhook during project creation', {
        repoName,
        webhookUrl,
        selectedBranch,
      });
      await githubService.registerWebhook(user.githubToken, repoName, webhookUrl, secretPlain);
      logger.info('Webhook registered automatically for project', {
        repoName,
        webhookUrl,
        selectedBranch,
      });

      const projectId = generateId();
      const project = await db
        .insert(projects)
        .values({
          id: projectId,
          userId,
          name,
          repoName,
          repoUrl,
          repoBranch: selectedBranch,
          autoDeployBranch: selectedBranch,
          ensName,
          ensOwnerAddress: normalizedOwnerAddress,
          ethereumRpcUrl,
          buildCommand: buildCommand || null,
          outputDir: outputDir || null,
          frontendDir: frontendDir || null,
          webhookEnabled: true,
          webhookSecret: encryptedSecret,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      logger.info('Project created successfully', {
        projectId,
        projectName: name,
        repoName,
        userId,
      });

      res.status(201).json(project[0]);
    } catch (error) {
      logger.error('Failed to create project:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectName: name,
        repoName,
        userId,
      });
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

    logger.info('Updating project', {
      projectId: id,
      userId,
      updateFields: Object.keys(updates),
    });

    try {
      // Verify ownership
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        logger.warn('Project not found for update', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      if (updates.ensOwnerAddress) {
        updates.ensOwnerAddress = updates.ensOwnerAddress.toLowerCase();
      }

      const updated = await db
        .update(projects)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      logger.info('Project updated successfully', {
        projectId: id,
        projectName: updated[0]?.name,
        userId,
      });

      res.json(updated[0]);
    } catch (error) {
      logger.error('Failed to update project:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: id,
        userId,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update project',
      });
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;

    logger.info('Deleting project', { projectId: id, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        logger.warn('Project not found for deletion', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      await db.delete(projects).where(eq(projects.id, id));

      logger.info('Project deleted successfully', {
        projectId: id,
        projectName: project.name,
        userId,
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete project:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: id,
        userId,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete project',
      });
    }
  }

  async enableWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { branch } = req.body as { branch?: string };

    logger.info('Enabling webhook for project', { projectId: id, userId, branch });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          user: true,
        },
      });

      if (!project) {
        logger.warn('Project not found for webhook enable', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const secretPlain = webhookSecretService.generate();
      const encryptedSecret = webhookSecretService.encrypt(secretPlain);
      const webhookUrl = getWebhookUrl();

      logger.debug('Registering webhook with GitHub', {
        projectId: id,
        repoName: project.repoName,
        webhookUrl,
      });

      await githubService.registerWebhook(project.user.githubToken, project.repoName, webhookUrl, secretPlain);

      const selectedBranch = branch || project.autoDeployBranch || project.repoBranch || 'main';

      const [updated] = await db
        .update(projects)
        .set({
          webhookEnabled: true,
          webhookSecret: encryptedSecret,
          autoDeployBranch: selectedBranch,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      logger.info('Webhook enabled successfully', {
        projectId: id,
        repoName: project.repoName,
        autoDeployBranch: selectedBranch,
        userId,
      });

      res.json({
        webhookEnabled: true,
        autoDeployBranch: updated?.autoDeployBranch ?? selectedBranch,
      });
    } catch (error) {
      logger.error('Failed to enable webhook:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: id,
        userId,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to enable webhook',
      });
    }
  }

  async disableWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req.user as any).id;

    logger.info('Disabling webhook for project', { projectId: id, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          user: true,
        },
      });

      if (!project) {
        logger.warn('Project not found for webhook disable', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const webhookUrl = getWebhookUrl();

      logger.debug('Unregistering webhook from GitHub', {
        projectId: id,
        repoName: project.repoName,
        webhookUrl,
      });

      try {
        await githubService.unregisterWebhook(project.user.githubToken, project.repoName, webhookUrl);
        logger.debug('Webhook unregistered from GitHub', { projectId: id });
      } catch (unregisterError) {
        logger.warn('Failed to unregister webhook from GitHub:', {
          error: unregisterError instanceof Error ? unregisterError.message : String(unregisterError),
          projectId: id,
        });
      }

      const [updated] = await db
        .update(projects)
        .set({
          webhookEnabled: false,
          webhookSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      logger.info('Webhook disabled successfully', {
        projectId: id,
        repoName: project.repoName,
        userId,
      });

      res.json({
        webhookEnabled: updated?.webhookEnabled ?? false,
      });
    } catch (error) {
      logger.error('Failed to disable webhook:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId: id,
        userId,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to disable webhook',
      });
    }
  }
}

export const projectsController = new ProjectsController();




