import { Request, Response } from 'express';
import fs from 'fs/promises';
import archiver from 'archiver';
import { db } from '../db';
import { projects, deployments } from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { generateId } from '../utils/generateId';
import { buildService } from '../services/build.service';
import { ensService } from '../services/ens.service';
import { logger } from '../utils/logger';
import { getDeploymentBuildDir } from '../utils/paths';
import { deploymentQueue } from '../services/deployment-queue.service';

export class DeploymentsController {
    private static readonly RESUMABLE_STATUSES = new Set(['failed', 'pending_upload', 'uploading', 'updating_ens']);
    private static readonly ACTIVE_STATUSES = ['pending_build', 'cloning', 'building', 'pending_upload', 'uploading', 'updating_ens'];
    private static readonly KNOWN_STATUSES = new Set([
        'pending_build',
        'cloning',
        'building',
        'pending_upload',
        'uploading',
        'updating_ens',
        'success',
        'failed',
        'cancelled',
    ]);

    // Create new deployment (start build process)
    async create(req: Request, res: Response) {
        const { projectId, resumeFromPrevious = false } = req.body;
        const userId = (req.user as any).id;

        logger.info('Creating new deployment', {
            projectId,
            userId,
            resumeFromPrevious,
        });

        try {
            // Verify user owns project
            const project = await db.query.projects.findFirst({
                where: eq(projects.id, projectId),
                with: { user: true },
            });

            if (!project || project.userId !== userId) {
                logger.warn('Deployment creation denied: project not found or access denied', {
                    projectId,
                    userId,
                });
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this project',
                });
            }

            const activeDeployment = await db.query.deployments.findFirst({
                where: (deployment, { eq: eqField, inArray: inArrayField, and: andField }) =>
                    andField(
                        eqField(deployment.projectId, projectId),
                        inArrayField(deployment.status, DeploymentsController.ACTIVE_STATUSES)
                    ),
                orderBy: (deployment, { desc: orderDesc }) => [orderDesc(deployment.createdAt)],
            });

            if (activeDeployment) {
                logger.warn('Deployment creation blocked: active deployment exists', {
                    projectId,
                    activeDeploymentId: activeDeployment.id,
                    activeDeploymentStatus: activeDeployment.status,
                    userId,
                });
                return res.status(409).json({
                    error: 'DeploymentInProgress',
                    message: 'A deployment is already running for this project. Please wait until it completes or cancel it before starting another.',
                });
            }

            let reuseDir: string | undefined;
            let reuseSourceDeploymentId: string | undefined;

            if (resumeFromPrevious) {
                const previousDeployment = await db.query.deployments.findFirst({
                    where: eq(deployments.projectId, projectId),
                    orderBy: (dep, { desc }) => [desc(dep.createdAt)],
                });

                if (
                    !previousDeployment ||
                    !DeploymentsController.RESUMABLE_STATUSES.has(previousDeployment.status)
                ) {
                    return res.status(400).json({
                        error: 'NoResumableDeployment',
                        message:
                            'No previous deployment with reusable build artifacts was found. Please run a full deployment.',
                    });
                }

                const previousDir = getDeploymentBuildDir(previousDeployment.id);
                try {
                    await fs.access(previousDir);
                    reuseDir = previousDir;
                    reuseSourceDeploymentId = previousDeployment.id;
                    logger.info(
                        `Deployment will reuse workspace from deployment ${reuseSourceDeploymentId}`
                    );
                } catch {
                    return res.status(400).json({
                        error: 'ArtifactsMissing',
                        message:
                            'Previous build artifacts are missing. Please run a full deployment to recreate the build output.',
                    });
                }
            }

            const deploymentId = generateId();

            logger.info('Creating deployment record', {
                deploymentId,
                projectId,
                projectName: project.name,
                reuseDir: reuseDir ? 'yes' : 'no',
                reuseSourceDeploymentId,
            });

            // Create deployment record
            await db
                .insert(deployments)
                .values({
                    id: deploymentId,
                    projectId,
                    status: 'pending_build',
                    triggeredBy: 'manual',
                    createdAt: new Date(),
                });

            // Start build process asynchronously using per-project queue
            logger.info('Enqueuing deployment build', {
                deploymentId,
                projectId,
            });

            deploymentQueue.enqueue(projectId, () =>
                this.runBuildPipeline(deploymentId, project, { reuseDir, reuseSourceDeploymentId })
            );

            logger.info('Deployment created and queued', {
                deploymentId,
                projectId,
                status: 'pending_build',
            });

            res.status(201).json({
                deploymentId,
                status: 'pending_build',
                message: 'Deployment started',
            });
        } catch (error) {
            logger.error('Failed to create deployment:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to start deployment',
            });
        }
    }

    async cancel(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req.user as any).id;

        logger.info('Cancelling deployment', { deploymentId: id, userId });

        try {
            const deployment = await db.query.deployments.findFirst({
                where: eq(deployments.id, id),
                with: {
                    project: {
                        with: { user: true },
                    },
                },
            });

            if (!deployment || deployment.project.userId !== userId) {
                return res.status(404).json({
                    error: 'NotFound',
                    message: 'Deployment not found',
                });
            }

            if (!DeploymentsController.ACTIVE_STATUSES.includes(deployment.status)) {
                logger.warn('Cannot cancel deployment: not in active status', {
                    deploymentId: id,
                    currentStatus: deployment.status,
                    userId,
                });
                return res.status(400).json({
                    error: 'CannotCancel',
                    message: 'Deployment is no longer running.',
                });
            }

            const cancelled = await db
                .update(deployments)
                .set({
                    status: 'cancelled',
                    errorMessage: 'Deployment cancelled by user',
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, id))
                .returning();

            const killed = buildService.cancelBuild(id);

            logger.info(
                `Deployment ${id} cancelled by user ${userId}${killed ? ' (build process terminated)' : ''
                }`
            );

            res.json({
                status: cancelled[0]?.status ?? 'cancelled',
                killed,
            });
        } catch (error) {
            logger.error('Failed to cancel deployment:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to cancel deployment',
            });
        }
    }

    // Update ENS with IPFS CID (called by frontend after upload)
    async updateENS(req: Request, res: Response) {
        const { id } = req.params;
        const { ipfsCid } = req.body;
        const userId = (req.user as any).id;

        logger.info('ENS update requested', {
            deploymentId: id,
            ipfsCid,
            userId,
        });

        try {
            // Get deployment and verify ownership
            const deployment = await db.query.deployments.findFirst({
                where: eq(deployments.id, id),
                with: {
                    project: {
                        with: { user: true },
                    },
                },
            });

            if (!deployment || deployment.project.userId !== userId) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this deployment',
                });
            }

            if (deployment.status !== 'pending_upload' && deployment.status !== 'uploading') {
                return res.status(400).json({
                    error: 'InvalidState',
                    message: 'Deployment is not awaiting upload.',
                });
            }

            // Update deployment with CID
            await db
                .update(deployments)
                .set({
                    ipfsCid,
                    status: 'updating_ens',
                    buildArtifactsPath: null,
                })
                .where(eq(deployments.id, id));

            logger.info('Deployment status updated to updating_ens, starting ENS update', {
                deploymentId: id,
                ipfsCid,
                ensName: deployment.project.ensName,
            });

            // Update ENS contenthash
            this.executeENSUpdate(id, deployment.project, ipfsCid).catch((error) => {
                logger.error(`ENS update failed for deployment ${id}:`, {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    deploymentId: id,
                });
            });

            res.json({
                message: 'ENS update started',
                status: 'updating_ens',
            });
        } catch (error) {
            logger.error('Failed to update ENS:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update ENS',
            });
        }
    }

    // Mark deployment as failed during upload
    async markUploadFailed(req: Request, res: Response) {
        const { id } = req.params;
        const { message } = req.body as { message?: string };
        const userId = (req.user as any).id;

        logger.warn('Marking deployment upload as failed', {
            deploymentId: id,
            errorMessage: message,
            userId,
        });

        try {
            const deployment = await db.query.deployments.findFirst({
                where: eq(deployments.id, id),
                with: {
                    project: true,
                },
            });

            if (!deployment || deployment.project.userId !== userId) {
                return res.status(404).json({
                    error: 'NotFound',
                    message: 'Deployment not found',
                });
            }

            if (deployment.status !== 'pending_upload' && deployment.status !== 'uploading') {
                return res.status(400).json({
                    error: 'InvalidState',
                    message: 'Only deployments awaiting upload can be marked as failed.',
                });
            }

            await db
                .update(deployments)
                .set({
                    status: 'failed',
                    errorMessage: message ?? 'Filecoin upload failed.',
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, id));

            logger.info('Deployment marked as failed', {
                deploymentId: id,
                errorMessage: message ?? 'Filecoin upload failed.',
            });

            res.json({ status: 'failed' });
        } catch (error) {
            logger.error('Failed to mark deployment as failed:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update deployment status',
            });
        }
    }

    // Get deployment status
    async getStatus(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req.user as any).id;

        logger.debug('Getting deployment status', { deploymentId: id, userId });

        try {
            const deployment = await db.query.deployments.findFirst({
                where: eq(deployments.id, id),
                with: {
                    project: {
                        with: { user: true },
                    },
                },
            });

            if (!deployment || deployment.project.userId !== userId) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Deployment not found',
                });
            }

            res.json({
                id: deployment.id,
                projectId: deployment.projectId,
                status: deployment.status,
                ipfsCid: deployment.ipfsCid,
                ensTxHash: deployment.ensTxHash,
                buildLog: deployment.buildLog,
                errorMessage: deployment.errorMessage,
                triggeredBy: deployment.triggeredBy,
                commitSha: deployment.commitSha,
                commitMessage: deployment.commitMessage,
                createdAt: deployment.createdAt,
                completedAt: deployment.completedAt,
            });
        } catch (error) {
            logger.error('Failed to get deployment status:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to fetch deployment status',
            });
        }
    }

    // List deployments with optional status filter (used by auto-deploy poller)
    async list(req: Request, res: Response) {
        const userId = (req.user as any).id;
        const { status, limit = '20' } = req.query;

        logger.debug('Listing deployments', {
            userId,
            statusFilter: status,
            limit,
        });

        try {
            if (status && typeof status === 'string' && !DeploymentsController.KNOWN_STATUSES.has(status)) {
                return res.status(400).json({
                    error: 'InvalidStatus',
                    message: `Unsupported status filter: ${status}`,
                });
            }

            const numericLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

            const whereClause = status && typeof status === 'string'
                ? and(eq(projects.userId, userId), eq(deployments.status, status))
                : eq(projects.userId, userId);

            const rows = await db
                .select({
                    deployment: deployments,
                })
                .from(deployments)
                .innerJoin(projects, eq(deployments.projectId, projects.id))
                .where(whereClause)
                .orderBy(desc(deployments.createdAt))
                .limit(numericLimit);

            logger.debug('Deployments listed successfully', {
                userId,
                count: rows.length,
                statusFilter: status,
            });

            res.json(rows.map((row) => row.deployment));
        } catch (error) {
            logger.error('Failed to list deployments:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to fetch deployments',
            });
        }
    }

    // List project deployments
    async listByProject(req: Request, res: Response) {
        const { id } = req.params; // project ID
        const userId = (req.user as any).id;

        logger.debug('Listing project deployments', { projectId: id, userId });

        try {
            // Verify user owns project
            const project = await db.query.projects.findFirst({
                where: eq(projects.id, id),
            });

            if (!project || project.userId !== userId) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this project',
                });
            }

            const projectDeployments = await db.query.deployments.findMany({
                where: eq(deployments.projectId, id),
                orderBy: [desc(deployments.createdAt)],
                limit: 20,
            });

            logger.debug('Project deployments listed successfully', {
                projectId: id,
                count: projectDeployments.length,
                userId,
            });

            res.json(projectDeployments);
        } catch (error) {
            logger.error('Failed to list deployments:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to fetch deployments',
            });
        }
    }

    // Download build artifacts (zipped output directory)
    async downloadArtifacts(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req.user as any).id;

        logger.info('Downloading build artifacts', { deploymentId: id, userId });

        try {
            const deployment = await db.query.deployments.findFirst({
                where: eq(deployments.id, id),
                with: {
                    project: {
                        with: { user: true },
                    },
                },
            });

            if (!deployment || deployment.project.userId !== userId) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Deployment not found',
                });
            }

            if (deployment.status !== 'pending_upload' && deployment.status !== 'uploading') {
                return res.status(400).json({
                    error: 'InvalidState',
                    message: 'Artifacts are only available while awaiting upload.',
                });
            }

            const sourceDir = deployment.buildArtifactsPath;

            if (!sourceDir) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Build artifacts path missing for this deployment.',
                });
            }

            try {
                await fs.access(sourceDir);
            } catch {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Build artifacts not found yet. Please wait for the build to finish.',
                });
            }

            if (deployment.status === 'pending_upload') {
                logger.debug('Updating deployment status to uploading', { deploymentId: id });
                await db
                    .update(deployments)
                    .set({ status: 'uploading' })
                    .where(eq(deployments.id, id));
            }

            logger.info('Starting artifact download', {
                deploymentId: id,
                sourceDir,
                projectName: deployment.project.repoName,
            });

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${deployment.project.repoName || 'build'}-${id}.zip"`
            );

            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', (error) => {
                logger.error('Artifact archive error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to prepare artifact download',
                    });
                } else {
                    res.end();
                }
            });

            archive.directory(sourceDir, false);
            archive.pipe(res);
            await archive.finalize();

            logger.info('Artifact download completed', { deploymentId: id });
        } catch (error) {
            logger.error('Failed to download artifact:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to download build artifact',
                });
            } else {
                res.end();
            }
        }
    }

    // Run the build process for a deployment
    async runBuildPipeline(
        deploymentId: string,
        project: any,
        options?: { reuseDir?: string; reuseSourceDeploymentId?: string }
    ) {

        try {
            logger.info('Build pipeline starting', {
                deploymentId,
                projectId: project.id,
                projectName: project.name,
                repoUrl: project.repoUrl,
                repoBranch: project.repoBranch || 'main',
                reuseDir: options?.reuseDir ? 'yes' : 'no',
            });

            // Update status to cloning when build actually starts
            await db
                .update(deployments)
                .set({ status: 'cloning' })
                .where(eq(deployments.id, deploymentId));

            logger.info(`Starting build for deployment ${deploymentId}`);

            // Clone and build
            const result = await buildService.cloneAndBuild(project.repoUrl, project.repoBranch || 'main', project.user.githubToken, deploymentId, {
                buildCommand: project.buildCommand ?? undefined,
                outputDir: project.outputDir ?? undefined,
                reuseDir: options?.reuseDir,
                reuseLabel: options?.reuseSourceDeploymentId,
            });

            await db
                .update(deployments)
                .set({
                    status: 'pending_upload',
                    buildLog: result.logs,
                    buildArtifactsPath: result.outputDir,
                })
                .where(eq(deployments.id, deploymentId));

            logger.info(`Build completed successfully for deployment ${deploymentId}`);
            logger.info(`Output directory: ${result.outputDir}`);
            logger.info(`Build directory: ${getDeploymentBuildDir(deploymentId)}`);
            logger.info(`Frontend should now upload from: ${result.outputDir}`);

            // Note: Build directory is kept in builds/ folder for artifact download
            // The frontend will handle the Filecoin upload
            // Once uploaded, frontend will call POST /api/deployments/:id/ens with the IPFS CID
        } catch (error) {
            logger.error(`Build failed for deployment ${deploymentId}:`, error);

            const currentStatus = await db.query.deployments.findFirst({
                where: eq(deployments.id, deploymentId),
            });

            if (currentStatus?.status === 'cancelled') {
                logger.info(`Deployment ${deploymentId} marked as cancelled.`);
                return;
            }

            await db
                .update(deployments)
                .set({
                    status: 'failed',
                    errorMessage: (error as Error).message,
                    buildLog: (error as Error).message,
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, deploymentId));
        }
    }

    // Private method: Execute ENS update
    private async executeENSUpdate(deploymentId: string, project: any, ipfsCid: string) {
        try {
            logger.info(`Updating ENS for deployment ${deploymentId}`);

            const result = await ensService.updateContentHash(
                project.ensName,
                project.ensPrivateKey,
                ipfsCid,
                project.ethereumRpcUrl
            );

            await db
                .update(deployments)
                .set({
                    status: 'success',
                    ensTxHash: result.txHash,
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, deploymentId));

            logger.info(`ENS updated successfully for deployment ${deploymentId}`);
            logger.info(`Transaction hash: ${result.txHash}`);
        } catch (error) {
            logger.error(`ENS update failed for deployment ${deploymentId}:`, error);

            await db
                .update(deployments)
                .set({
                    status: 'failed',
                    errorMessage: `ENS update failed: ${(error as Error).message}`,
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, deploymentId));
        }
    }
}

export const deploymentsController = new DeploymentsController();

