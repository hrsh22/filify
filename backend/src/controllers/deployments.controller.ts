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

export class DeploymentsController {
    private static readonly RESUMABLE_STATUSES = new Set(['failed', 'uploading', 'updating_ens']);
    private static readonly ACTIVE_STATUSES = ['cloning', 'building', 'uploading', 'updating_ens'];

    // Create new deployment (start build process)
    async create(req: Request, res: Response) {
        const { projectId, resumeFromPrevious = false } = req.body;
        const userId = (req.user as any).id;

        try {
            // Verify user owns project
            const project = await db.query.projects.findFirst({
                where: eq(projects.id, projectId),
                with: { user: true },
            });

            if (!project || project.userId !== userId) {
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

            // Create deployment record
            await db
                .insert(deployments)
                .values({
                    id: deploymentId,
                    projectId,
                    status: 'cloning',
                    createdAt: new Date(),
                });

            // Start build process asynchronously
            this.executeBuild(deploymentId, project, { reuseDir, reuseSourceDeploymentId }).catch((error) => {
                logger.error(`Build execution failed for deployment ${deploymentId}:`, error);
            });

            res.status(201).json({
                deploymentId,
                status: 'cloning',
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
                `Deployment ${id} cancelled by user ${userId}${
                    killed ? ' (build process terminated)' : ''
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

            // Update deployment with CID
            await db
                .update(deployments)
                .set({
                    ipfsCid,
                    status: 'updating_ens',
                })
                .where(eq(deployments.id, id));

            // Update ENS contenthash
            this.executeENSUpdate(id, deployment.project, ipfsCid).catch((error) => {
                logger.error(`ENS update failed for deployment ${id}:`, error);
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

    // Get deployment status
    async getStatus(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req.user as any).id;

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

    // List project deployments
    async listByProject(req: Request, res: Response) {
        const { id } = req.params; // project ID
        const userId = (req.user as any).id;

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

            res.json(projectDeployments);
        } catch (error) {
            logger.error('Failed to list deployments:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to fetch deployments',
            });
        }
    }

    // Download build artifact (zipped output directory)
    async downloadArtifact(req: Request, res: Response) {
        const { id } = req.params;
        const userId = (req.user as any).id;

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

            const buildDir = getDeploymentBuildDir(id);
            try {
                await fs.access(buildDir);
            } catch {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Build artifacts not found yet. Please wait for the build to finish.',
                });
            }

            let sourceDir: string | null = null;
            try {
                sourceDir = await buildService.getOutputPath(buildDir);
            } catch (error) {
                logger.warn(`Could not detect output directory for deployment ${id}:`, error);
                sourceDir = buildDir;
            }

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

    // Private method: Execute build process
    private async executeBuild(
        deploymentId: string,
        project: any,
        options?: { reuseDir?: string; reuseSourceDeploymentId?: string }
    ) {

        try {
            // Update status to cloning
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

            // Update status to success
            await db
                .update(deployments)
                .set({
                    status: 'uploading',
                    buildLog: result.logs,
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
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, deploymentId));
        }
    }
}

export const deploymentsController = new DeploymentsController();

