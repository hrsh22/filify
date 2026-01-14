import { Request, Response } from 'express';
import { db } from '../db';
import { projects, githubInstallations } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { generateId } from '../utils/generateId';
import { githubAppService } from '../services/github-app.service';
import { logger } from '../utils/logger';
import { webhookSecretService } from '../services/webhook-secret.service';
import { env } from '../config/env';
import { getNetworkConfig, isValidNetwork, type NetworkType } from '../config/network-config';

const WEBHOOK_ENDPOINT = '/api/webhooks/github';

function getWebhookUrl() {
  return new URL(WEBHOOK_ENDPOINT, env.BACKEND_URL).toString();
}

export class ProjectsController {
  async list(req: Request, res: Response) {
    const userId = req.userId!;
    const networkParam = req.query.network as string | undefined;
    const network: NetworkType = networkParam && isValidNetwork(networkParam) ? networkParam : 'mainnet';

    logger.debug('Listing projects', { userId, network });

    try {
      const userProjects = await db.query.projects.findMany({
        where: and(eq(projects.userId, userId), eq(projects.network, network)),
        with: {
          installation: true,
          deployments: {
            limit: 1,
            orderBy: (deployments: any, { desc }: any) => [desc(deployments.createdAt)],
          },
        },
      });

      const validatedProjects = await this.validateProjectsRepoAccess(userProjects);

      logger.info('Projects listed successfully', {
        userId,
        network,
        count: validatedProjects.length,
      });

      res.json({
        projects: validatedProjects,
        githubAppName: env.GITHUB_APP_NAME,
      });
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
    const userId = req.userId!;

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

      res.json({
        ...project,
        githubAppName: env.GITHUB_APP_NAME,
      });
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
    const userId = req.userId!;
    const {
      name,
      repoFullName,
      repoUrl,
      repoBranch,
      installationId,
      network = 'mainnet',
      ensName,
      ensOwnerAddress,
      ethereumRpcUrl,
      buildCommand,
      outputDir,
      frontendDir,
      force
    } = req.body;

    // Only normalize if ENS owner address is provided
    const normalizedOwnerAddress = ensOwnerAddress ? ensOwnerAddress.toLowerCase() : null;
    const networkConfig = getNetworkConfig(network as NetworkType);
    const hasEns = Boolean(ensName && ensOwnerAddress);

    logger.info('Creating new project', {
      userId,
      projectName: name,
      repoFullName,
      repoBranch: repoBranch || 'main',
      installationId,
      network,
      ensName: ensName || '(none)',
      ensOwnerAddress: normalizedOwnerAddress || '(none)',
      hasEns,
      force,
    });

    try {
      // Verify installation belongs to user
      const installation = await db.query.githubInstallations.findFirst({
        where: and(
          eq(githubInstallations.id, installationId),
          eq(githubInstallations.userId, userId)
        ),
      });

      if (!installation) {
        logger.warn('Project creation denied: invalid installation', { userId, installationId });
        return res.status(400).json({
          error: 'InvalidInstallation',
          message: 'Invalid GitHub installation selected',
        });
      }

      // Check for ENS conflict if ENS is provided
      if (hasEns) {
        const existingProject = await db.query.projects.findFirst({
          where: eq(projects.ensName, ensName),
        });

        if (existingProject) {
          if (!force) {
            return res.status(409).json({
              error: 'ENS_ALREADY_LINKED',
              message: `This domain is already linked to project "${existingProject.name}"`,
              existingProjectName: existingProject.name
            });
          }

          // Force unlink from other project
          await db
            .update(projects)
            .set({
              ensName: null,
              ensOwnerAddress: null,
              ethereumRpcUrl: null,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, existingProject.id));

          logger.info('Force unlinked ENS from other project during creation', {
            ensName,
            fromProjectId: existingProject.id,
          });
        }
      }

      // Validate repository access
      const [owner, repo] = repoFullName.split('/');
      logger.debug('Validating repository access', { owner, repo, userId, installationId: installation.installationId });
      await githubAppService.getRepository(installation.installationId, owner, repo);
      logger.debug('Repository access validated', { owner, repo });

      const secretPlain = webhookSecretService.generate();
      const encryptedSecret = webhookSecretService.encrypt(secretPlain);
      const webhookUrl = getWebhookUrl();
      const selectedBranch = repoBranch || 'main';

      logger.debug('Registering GitHub webhook during project creation', {
        repoFullName,
        webhookUrl,
        selectedBranch,
      });
      await githubAppService.registerWebhook(installation.installationId, repoFullName, webhookUrl, secretPlain);
      logger.info('Webhook registered automatically for project', {
        repoFullName,
        webhookUrl,
        selectedBranch,
      });

      const projectId = generateId();
      const project = await db
        .insert(projects)
        .values({
          id: projectId,
          userId,
          installationId: installation.id,
          name,
          repoFullName,
          repoUrl,
          repoBranch: selectedBranch,
          autoDeployBranch: selectedBranch,
          network: network as NetworkType,
          ensName: ensName || null,
          ensOwnerAddress: normalizedOwnerAddress,
          ethereumRpcUrl: hasEns ? (ethereumRpcUrl || networkConfig.rpcUrl) : null,
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
        repoFullName,
        userId,
      });

      res.status(201).json(project[0]);
    } catch (error) {
      logger.error('Failed to create project:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectName: name,
        repoFullName,
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
    const userId = req.userId!;
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
    const userId = req.userId!;

    logger.info('Deleting project', { projectId: id, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          installation: true,
        },
      });

      if (!project) {
        logger.warn('Project not found for deletion', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      // Try to unregister webhook if enabled
      if (project.webhookEnabled && project.installation) {
        try {
          const webhookUrl = getWebhookUrl();
          await githubAppService.unregisterWebhook(project.installation.installationId, project.repoFullName, webhookUrl);
          logger.debug('Webhook unregistered during project deletion', { projectId: id });
        } catch (error) {
          logger.warn('Failed to unregister webhook during deletion', {
            projectId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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
    const userId = req.userId!;
    const { branch } = req.body as { branch?: string };

    logger.info('Enabling webhook for project', { projectId: id, userId, branch });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          installation: true,
        },
      });

      if (!project) {
        logger.warn('Project not found for webhook enable', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      if (!project.installation) {
        return res.status(400).json({
          error: 'NoGitHubInstallation',
          message: 'This project is not linked to a GitHub App installation',
        });
      }

      const secretPlain = webhookSecretService.generate();
      const encryptedSecret = webhookSecretService.encrypt(secretPlain);
      const webhookUrl = getWebhookUrl();

      logger.debug('Registering webhook with GitHub', {
        projectId: id,
        repoFullName: project.repoFullName,
        webhookUrl,
      });

      await githubAppService.registerWebhook(project.installation.installationId, project.repoFullName, webhookUrl, secretPlain);

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
        repoFullName: project.repoFullName,
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
    const userId = req.userId!;

    logger.info('Disabling webhook for project', { projectId: id, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          installation: true,
        },
      });

      if (!project) {
        logger.warn('Project not found for webhook disable', { projectId: id, userId });
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      if (!project.installation) {
        // Just disable in DB if no installation found (might have been removed)
        logger.warn('No installation found for webhook disable, skipping GitHub unregister', { projectId: id });
      } else {
        const webhookUrl = getWebhookUrl();

        logger.debug('Unregistering webhook from GitHub', {
          projectId: id,
          repoFullName: project.repoFullName,
          webhookUrl,
        });

        try {
          await githubAppService.unregisterWebhook(project.installation.installationId, project.repoFullName, webhookUrl);
          logger.debug('Webhook unregistered from GitHub', { projectId: id });
        } catch (unregisterError) {
          logger.warn('Failed to unregister webhook from GitHub:', {
            error: unregisterError instanceof Error ? unregisterError.message : String(unregisterError),
            projectId: id,
          });
        }
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
        repoFullName: project.repoFullName,
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

  // Attach ENS domain to an existing project
  async attachEns(req: Request, res: Response) {
    const { id } = req.params;
    const { ensName, ensOwnerAddress, force } = req.body;
    const userId = req.userId!;

    logger.info('Attaching ENS to project', { projectId: id, ensName, userId, force });

    try {
      // Validate inputs
      if (!ensName || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(ensName)) {
        return res.status(400).json({ error: 'Invalid ENS name format' });
      }
      if (!ensOwnerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ensOwnerAddress)) {
        return res.status(400).json({ error: 'Invalid Ethereum address' });
      }

      const normalizedAddress = ensOwnerAddress.toLowerCase();

      // Check if ENS is already linked to another project
      const existingProject = await db.query.projects.findFirst({
        where: and(eq(projects.ensName, ensName), ne(projects.id, id)),
      });

      if (existingProject) {
        if (!force) {
          return res.status(409).json({
            error: 'ENS_ALREADY_LINKED',
            message: `This domain is already linked to project "${existingProject.name}"`,
            existingProjectName: existingProject.name
          });
        }

        // Force unlink from other project
        await db
          .update(projects)
          .set({
            ensName: null,
            ensOwnerAddress: null,
            ethereumRpcUrl: null,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, existingProject.id));

        logger.info('Force unlinked ENS from other project', {
          ensName,
          fromProjectId: existingProject.id,
          toProjectId: id
        });
      }

      // Find project with latest successful deployment
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
        with: {
          deployments: {
            limit: 1,
            orderBy: (deployments: any, { desc }: any) => [desc(deployments.createdAt)],
          },
        },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const networkConfig = getNetworkConfig(project.network as NetworkType);

      // Update project with ENS details
      await db
        .update(projects)
        .set({
          ensName,
          ensOwnerAddress: normalizedAddress,
          ethereumRpcUrl: networkConfig.rpcUrl,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id));

      // Check if there's a successful deployment with IPFS CID
      const latestDeployment = project.deployments?.[0];
      const hasSuccessfulDeployment = latestDeployment?.status === 'success' && latestDeployment?.ipfsCid;

      if (hasSuccessfulDeployment) {
        // Import ensService dynamically to avoid circular deps
        const { ensService } = await import('../services/ens.service');

        const payload = await ensService.prepareContenthashTx(
          ensName,
          normalizedAddress,
          latestDeployment.ipfsCid!,
          networkConfig.rpcUrl
        );

        logger.info('ENS transaction prepared for existing deployment', {
          projectId: id,
          ensName,
          ipfsCid: latestDeployment.ipfsCid,
        });

        return res.json({
          needsSignature: true,
          deploymentId: latestDeployment.id,
          ipfsCid: latestDeployment.ipfsCid,
          payload,
        });
      }

      // No deployment yet, just save ENS config
      logger.info('ENS attached without signature (no deployment yet)', { projectId: id, ensName });
      return res.json({ needsSignature: false });
    } catch (error) {
      logger.error('Failed to attach ENS:', {
        error: error instanceof Error ? error.message : String(error),
        projectId: id,
        userId,
      });
      res.status(500).json({ error: 'Failed to attach ENS domain' });
    }
  }

  // Confirm ENS attachment after wallet signature
  async confirmEnsAttach(req: Request, res: Response) {
    const { id } = req.params;
    const { txHash, ipfsCid } = req.body;
    const userId = req.userId!;

    logger.info('Confirming ENS attachment', { projectId: id, txHash, userId });

    try {
      if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ error: 'Invalid transaction hash' });
      }

      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.ensName || !project.ethereumRpcUrl) {
        return res.status(400).json({ error: 'No ENS configuration found for this project' });
      }

      const { ensService } = await import('../services/ens.service');

      const result = await ensService.waitForTransaction({
        ensName: project.ensName,
        txHash,
        expectedCid: ipfsCid,
        rpcUrl: project.ethereumRpcUrl,
      });

      logger.info('ENS attachment confirmed', {
        projectId: id,
        txHash: result.txHash,
        verified: result.verified,
      });

      return res.json({
        status: 'success',
        txHash: result.txHash,
        verified: result.verified,
        blockNumber: result.blockNumber,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm ENS transaction';
      logger.error('ENS attachment confirmation failed:', {
        error: message,
        projectId: id,
        userId,
      });

      // Rollback ENS on failure
      await db
        .update(projects)
        .set({
          ensName: null,
          ensOwnerAddress: null,
          ethereumRpcUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id));

      res.status(500).json({ error: message });
    }
  }

  // Remove ENS from project
  async removeEns(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.userId!;

    logger.info('Removing ENS from project', { projectId: id, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await db
        .update(projects)
        .set({
          ensName: null,
          ensOwnerAddress: null,
          ethereumRpcUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id));

      logger.info('ENS removed from project', { projectId: id });
      return res.json({ success: true });
    } catch (error) {
      logger.error('Failed to remove ENS:', {
        error: error instanceof Error ? error.message : String(error),
        projectId: id,
        userId,
      });
      res.status(500).json({ error: 'Failed to remove ENS domain' });
    }
  }

  private async validateProjectsRepoAccess(projectsList: any[]): Promise<any[]> {
    const result: any[] = [];
    const installationReposCache = new Map<number, Set<string>>();

    const disconnectedProjects = projectsList.filter((p) => !p.installation);
    const connectedProjects = projectsList.filter((p) => p.installation);

    let userInstallations: any[] = [];
    if (disconnectedProjects.length > 0 && projectsList.length > 0) {
      const userId = projectsList[0].userId;
      userInstallations = await db.query.githubInstallations.findMany({
        where: eq(githubInstallations.userId, userId),
      });
    }

    for (const project of connectedProjects) {
      const installationId = project.installation.installationId;

      if (!installationReposCache.has(installationId)) {
        try {
          const repos = await githubAppService.listInstallationRepos(installationId);
          installationReposCache.set(installationId, new Set(repos.map((r) => r.fullName)));
        } catch (error: any) {
          logger.warn('Failed to list installation repos, keeping project as-is', {
            projectId: project.id,
            installationId,
            error: error.message || String(error),
          });
          result.push(project);
          continue;
        }
      }

      const accessibleRepos = installationReposCache.get(installationId)!;
      const hasAccess = accessibleRepos.has(project.repoFullName);

      if (hasAccess) {
        result.push(project);
      } else {
        await db
          .update(projects)
          .set({ installationId: null, updatedAt: new Date() })
          .where(eq(projects.id, project.id));

        logger.info('Repo access revoked, disconnected project', {
          projectId: project.id,
          repoFullName: project.repoFullName,
        });

        result.push({
          ...project,
          installationId: null,
          installation: null,
        });
      }
    }

    for (const project of disconnectedProjects) {
      let reconnectedInstallation: any = null;

      for (const installation of userInstallations) {
        if (!installationReposCache.has(installation.installationId)) {
          try {
            const repos = await githubAppService.listInstallationRepos(installation.installationId);
            installationReposCache.set(installation.installationId, new Set(repos.map((r) => r.fullName)));
          } catch (error: any) {
            logger.warn('Failed to list installation repos for reconnect check', {
              installationId: installation.installationId,
              error: error.message || String(error),
            });
            continue;
          }
        }

        const accessibleRepos = installationReposCache.get(installation.installationId)!;
        if (accessibleRepos.has(project.repoFullName)) {
          reconnectedInstallation = installation;
          break;
        }
      }

      if (reconnectedInstallation) {
        await db
          .update(projects)
          .set({ installationId: reconnectedInstallation.id, updatedAt: new Date() })
          .where(eq(projects.id, project.id));

        logger.info('Repo access restored, reconnected project', {
          projectId: project.id,
          repoFullName: project.repoFullName,
          installationId: reconnectedInstallation.id,
        });

        result.push({
          ...project,
          installationId: reconnectedInstallation.id,
          installation: reconnectedInstallation,
        });
      } else {
        result.push(project);
      }
    }

    return result;
  }

  async relinkGithub(req: Request, res: Response) {
    const { id } = req.params;
    const { installationId } = req.body;
    const userId = req.userId!;

    logger.info('Re-linking GitHub installation to project', { projectId: id, installationId, userId });

    try {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.userId, userId)),
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const installation = await db.query.githubInstallations.findFirst({
        where: and(
          eq(githubInstallations.id, installationId),
          eq(githubInstallations.userId, userId)
        ),
      });

      if (!installation) {
        return res.status(400).json({
          error: 'InvalidInstallation',
          message: 'Invalid GitHub installation selected',
        });
      }

      const [owner, repo] = project.repoFullName.split('/');
      try {
        await githubAppService.getRepository(installation.installationId, owner, repo);
      } catch {
        return res.status(400).json({
          error: 'RepoNotAccessible',
          message: `The installation "${installation.accountLogin}" does not have access to ${project.repoFullName}`,
        });
      }

      if (project.webhookEnabled) {
        const secretPlain = webhookSecretService.generate();
        const encryptedSecret = webhookSecretService.encrypt(secretPlain);
        const webhookUrl = getWebhookUrl();

        try {
          await githubAppService.registerWebhook(installation.installationId, project.repoFullName, webhookUrl, secretPlain);
          await db
            .update(projects)
            .set({
              installationId: installation.id,
              webhookSecret: encryptedSecret,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, id));
        } catch (webhookError) {
          logger.warn('Failed to register webhook during relink', {
            error: webhookError instanceof Error ? webhookError.message : String(webhookError),
          });
          await db
            .update(projects)
            .set({
              installationId: installation.id,
              webhookEnabled: false,
              webhookSecret: null,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, id));
        }
      } else {
        await db
          .update(projects)
          .set({
            installationId: installation.id,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, id));
      }

      logger.info('GitHub installation re-linked to project', {
        projectId: id,
        installationId: installation.id,
        accountLogin: installation.accountLogin,
      });

      return res.json({
        success: true,
        installationId: installation.id,
        accountLogin: installation.accountLogin,
      });
    } catch (error) {
      logger.error('Failed to re-link GitHub:', {
        error: error instanceof Error ? error.message : String(error),
        projectId: id,
        userId,
      });
      res.status(500).json({ error: 'Failed to re-link GitHub installation' });
    }
  }
}

export const projectsController = new ProjectsController();
