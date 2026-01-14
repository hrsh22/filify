import { Request, Response } from 'express';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import archiver from 'archiver';
import { db } from '../db';
import { projects, deployments } from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { generateId } from '../utils/generateId';
import { buildService } from '../services/build.service';
import { ensService } from '../services/ens.service';
import { logger } from '../utils/logger';
import { getDeploymentBuildDir } from '../utils/paths';
import { deploymentQueue, CancellationError } from '../services/deployment-queue.service';
import { env } from '../config/env';
import { dynamicImport } from '../utils/dynamic-import';
import { filecoinUploadService } from '../services/filecoin-upload.service';

async function recoverCarRootCid(carPath: string): Promise<string | null> {
    try {
        const buffer = await fs.readFile(carPath);
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let carModule: any;
        try {
            carModule = await dynamicImport('@ipld/car/reader');
        } catch {
            carModule = await dynamicImport('@ipld/car');
        }
        const CarReader = carModule.CarReader ?? carModule.default;
        if (!CarReader) {
            throw new Error('CarReader export not available');
        }
        const reader = await CarReader.fromBytes(bytes);
        const roots = await reader.getRoots();
        return roots[0]?.toString() ?? null;
    } catch (error) {
        logger.error('Failed to recover CAR root CID from artifact', {
            carPath,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export class DeploymentsController {
    private static readonly ACTIVE_STATUSES = [
        'pending_build',
        'cloning',
        'building',
        'pending_upload',
        'uploading',
        'awaiting_signature',
        'awaiting_confirmation',
    ];
    private static readonly KNOWN_STATUSES = new Set([
        'pending_build',
        'cloning',
        'building',
        'pending_upload',
        'uploading',
        'awaiting_signature',
        'awaiting_confirmation',
        'success',
        'failed',
        'cancelled',
    ]);

    // Create new deployment (start build process)
    async create(req: Request, res: Response) {
        const { projectId } = req.body;
        const userId = req.userId!;

        logger.info('Creating new deployment', {
            projectId,
            userId,
        });

        try {
            // Verify user owns project
            const project = await db.query.projects.findFirst({
                where: eq(projects.id, projectId),
                with: { user: true, installation: true },
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

            if (!project.installation) {
                logger.warn('Deployment creation denied: no GitHub installation linked', {
                    projectId,
                    userId,
                });
                return res.status(400).json({
                    error: 'NoGitHubInstallation',
                    message: 'This project has no GitHub App installation linked. Please reconnect GitHub.',
                });
            }

            const activeDeployment = await db.query.deployments.findFirst({
                where: (deployment: any, { eq: eqField, inArray: inArrayField, and: andField }: any) =>
                    andField(
                        eqField(deployment.projectId, projectId),
                        inArrayField(deployment.status, DeploymentsController.ACTIVE_STATUSES)
                    ),
                orderBy: (deployment: any, { desc: orderDesc }: any) => [orderDesc(deployment.createdAt)],
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

            const deploymentId = generateId();

            logger.info('Creating deployment record', {
                deploymentId,
                projectId,
                projectName: project.name,
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

            deploymentQueue.enqueue(projectId, (signal) =>
                this.runBuildPipeline(deploymentId, project, project.installation!.installationId, signal)
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
        const userId = req.userId!;

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
            const queueCleared = deploymentQueue.clearQueue(deployment.projectId);

            logger.info(
                `Deployment ${id} cancelled by user ${userId}${killed ? ' (build process terminated)' : ''
                }${queueCleared ? ' (queue cleared)' : ''}`
            );

            res.json({
                status: cancelled[0]?.status ?? 'cancelled',
                killed,
                queueCleared,
            });
        } catch (error) {
            logger.error('Failed to cancel deployment:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to cancel deployment',
            });
        }
    }

    // Prepare ENS transaction payload after Filecoin upload completes
    async prepareENS(req: Request, res: Response) {
        const { id } = req.params;
        const { ipfsCid } = req.body;
        const userId = req.userId!;

        logger.info('Preparing ENS transaction', {
            deploymentId: id,
            ipfsCid,
            userId,
        });

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
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this deployment',
                });
            }

            if (!deployment.project.ensOwnerAddress) {
                return res.status(400).json({
                    error: 'MissingOwner',
                    message: 'Project is missing the ENS owner address required to sign transactions.',
                });
            }

            if (!['pending_upload', 'uploading', 'awaiting_signature', 'success'].includes(deployment.status)) {
                return res.status(400).json({
                    error: 'InvalidState',
                    message: 'Deployment is not ready for ENS preparation.',
                });
            }

            const payload = await ensService.prepareContenthashTx(
                deployment.project.ensName!,
                deployment.project.ensOwnerAddress!,
                ipfsCid,
                deployment.project.ethereumRpcUrl!
            );

            // Only update status if not already successful (to avoid triggering auto-deploy poller)
            // For successful deployments, we're just preparing ENS for a deployment that skipped ENS
            if (deployment.status !== 'success') {
                await db
                    .update(deployments)
                    .set({
                        ipfsCid,
                        status: 'awaiting_signature',
                        buildArtifactsPath: null,
                    })
                    .where(eq(deployments.id, id));
            }

            logger.info('ENS transaction prepared and awaiting signature', {
                deploymentId: id,
                ensName: deployment.project.ensName,
            });

            res.json({
                status: 'awaiting_signature',
                payload,
            });
        } catch (error) {
            logger.error('Failed to prepare ENS transaction:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to prepare ENS payload',
            });
        }
    }

    // Confirm ENS transaction after the wallet signs & broadcasts it
    async confirmENS(req: Request, res: Response) {
        const { id } = req.params;
        const { txHash } = req.body;
        const userId = req.userId!;

        logger.info('Confirming ENS transaction', {
            deploymentId: id,
            txHash,
            userId,
        });

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
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this deployment',
                });
            }

            if (!deployment.ipfsCid) {
                return res.status(400).json({
                    error: 'MissingCid',
                    message: 'IPFS CID missing. Prepare the ENS transaction before confirming.',
                });
            }

            if (!['awaiting_signature', 'awaiting_confirmation', 'success'].includes(deployment.status)) {
                return res.status(400).json({
                    error: 'InvalidState',
                    message: 'Deployment is not awaiting ENS confirmation.',
                });
            }

            await db
                .update(deployments)
                .set({
                    status: 'awaiting_confirmation',
                    ensTxHash: txHash,
                })
                .where(eq(deployments.id, id));

            const result = await ensService.waitForTransaction({
                ensName: deployment.project.ensName!,
                txHash,
                expectedCid: deployment.ipfsCid!,
                rpcUrl: deployment.project.ethereumRpcUrl!,
            });

            await db
                .update(deployments)
                .set({
                    status: 'success',
                    ensTxHash: txHash,
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, id));

            // Cleanup build directory if enabled
            if (env.CLEANUP_BUILDS_ON_COMPLETE) {
                await buildService.cleanupDeploymentBuild(id).catch((error) => {
                    logger.warn('Failed to cleanup build directory after success', { deploymentId: id, error });
                });
            }

            res.json({
                status: 'success',
                txHash: result.txHash,
                verified: result.verified,
                blockNumber: result.blockNumber,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to confirm ENS transaction';
            logger.error('ENS confirmation failed:', error);

            await db
                .update(deployments)
                .set({
                    status: 'failed',
                    errorMessage: `ENS confirmation failed: ${message}`,
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, id));

            // Cleanup build directory if enabled
            if (env.CLEANUP_BUILDS_ON_COMPLETE) {
                await buildService.cleanupDeploymentBuild(id).catch((error) => {
                    logger.warn('Failed to cleanup build directory after failure', { deploymentId: id, error });
                });
            }

            res.status(500).json({
                error: 'ENSConfirmationFailed',
                message,
            });
        }
    }

    // Mark deployment as failed during upload
    async markUploadFailed(req: Request, res: Response) {
        const { id } = req.params;
        const { message } = req.body as { message?: string };
        const userId = req.userId!;

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

            // Cleanup build directory if enabled
            if (env.CLEANUP_BUILDS_ON_COMPLETE) {
                await buildService.cleanupDeploymentBuild(id).catch((error) => {
                    logger.warn('Failed to cleanup build directory after upload failure', { deploymentId: id, error });
                });
            }

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
        const userId = req.userId!;

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
        const userId = req.userId!;
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

            res.json(rows.map((row: any) => row.deployment));
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
        const userId = req.userId!;

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
        const userId = req.userId!;

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
                projectName: deployment.project.name,
            });

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${deployment.project.name || 'build'}-${id}.zip"`
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

    async downloadCar(req: Request, res: Response) {
        const { id } = req.params;
        const userId = req.userId!;

        logger.info('Downloading CAR artifact', { deploymentId: id, userId });

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
                    message: 'CAR artifacts are only available while awaiting upload.',
                });
            }

            const carPath = deployment.carFilePath;
            if (!carPath) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'CAR artifact is not available for this deployment.',
                });
            }

            try {
                await fs.access(carPath);
            } catch {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'CAR artifact not found yet. Please wait for the build to finish.',
                });
            }

            if (deployment.status === 'pending_upload') {
                logger.debug('Updating deployment status to uploading before CAR download', { deploymentId: id });
                await db
                    .update(deployments)
                    .set({ status: 'uploading' })
                    .where(eq(deployments.id, id));
            }

            const stats = await fs.stat(carPath);
            const dispositionName = `${deployment.project.name || 'build'}-${id}.car`;

            res.setHeader('Content-Type', 'application/vnd.ipld.car');
            res.setHeader('Content-Length', stats.size.toString());
            res.setHeader('Content-Disposition', `attachment; filename="${dispositionName}"`);
            let rootCid = deployment.carRootCid;
            if (!rootCid) {
                rootCid = await recoverCarRootCid(carPath);
                if (rootCid) {
                    await db
                        .update(deployments)
                        .set({ carRootCid: rootCid, carFilePath: deployment.carFilePath ?? carPath })
                        .where(eq(deployments.id, id));
                    logger.info('Recovered CAR root CID for deployment', { deploymentId: id, rootCid });
                } else {
                    logger.warn('Unable to determine CAR root CID for deployment', { deploymentId: id });
                }
            }

            if (!rootCid) {
                logger.error('Missing CAR root CID after recovery attempt', { deploymentId: id });
                return res.status(500).json({
                    error: 'CarRootCidUnavailable',
                    message: 'Failed to determine CAR root CID for this deployment.',
                });
            }

            res.setHeader('x-root-cid', rootCid);
            if (deployment.buildArtifactsPath) {
                res.setHeader('x-build-output', deployment.buildArtifactsPath);
            }

            const readStream = createReadStream(carPath);
            readStream.on('error', (error) => {
                logger.error('Failed while streaming CAR artifact', {
                    deploymentId: id,
                    error: error instanceof Error ? error.message : String(error),
                });
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to stream CAR artifact',
                    });
                } else {
                    res.end();
                }
            });

            readStream.pipe(res);
        } catch (error) {
            logger.error('Failed to download CAR artifact:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Failed to download CAR artifact',
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
        installationId: number,
        signal?: AbortSignal
    ) {

        const checkCancelled = () => {
            if (signal?.aborted) {
                throw new CancellationError();
            }
        };

        try {
            checkCancelled();
            logger.info('Build pipeline starting', {
                deploymentId,
                projectId: project.id,
                projectName: project.name,
                repoUrl: project.repoUrl,
                repoBranch: project.repoBranch || 'main',
                installationId,
            });

            // Update status to cloning when build actually starts
            await db
                .update(deployments)
                .set({ status: 'cloning' })
                .where(eq(deployments.id, deploymentId));

            logger.info(`Starting build for deployment ${deploymentId}`);

            // Clone and build
            const result = await buildService.cloneAndBuild(project.repoUrl, project.repoBranch || 'main', installationId, deploymentId, {
                buildCommand: project.buildCommand ?? undefined,
                outputDir: project.outputDir ?? undefined,
                frontendDir: project.frontendDir ?? undefined,
            });

            checkCancelled();

            await db
                .update(deployments)
                .set({
                    status: 'pending_upload',
                    buildLog: result.logs,
                    buildArtifactsPath: result.outputDir,
                    carRootCid: result.carRootCid,
                    carFilePath: result.carFilePath,
                })
                .where(eq(deployments.id, deploymentId));

            logger.info(`Build completed successfully for deployment ${deploymentId}`);
            logger.info(`Output directory: ${result.outputDir}`);
            logger.info(`Build directory: ${getDeploymentBuildDir(deploymentId)}`);
            logger.info(`Frontend should now upload from: ${result.outputDir}`);
            logger.info('CAR artifact prepared', {
                deploymentId,
                carRootCid: result.carRootCid,
                carFilePath: result.carFilePath,
            });

            checkCancelled();

            // Step: Upload to Filecoin
            await db
                .update(deployments)
                .set({ status: 'uploading' })
                .where(eq(deployments.id, deploymentId));

            logger.info('Starting Filecoin upload', { deploymentId, carFilePath: result.carFilePath });

            const uploadResult = await filecoinUploadService.uploadCar(
                result.carFilePath,
                result.carRootCid,
                deploymentId,
                { signal }
            );

            logger.info('Filecoin upload completed', {
                deploymentId,
                rootCid: uploadResult.rootCid,
                pieceCid: uploadResult.pieceCid,
                transactionHash: uploadResult.transactionHash,
            });

            // Check if project has ENS configured
            const hasEns = Boolean(project.ensName && project.ensOwnerAddress);

            if (hasEns) {
                // ENS configured - transition to awaiting_signature
                await db
                    .update(deployments)
                    .set({
                        status: 'awaiting_signature',
                        ipfsCid: uploadResult.rootCid,
                    })
                    .where(eq(deployments.id, deploymentId));

                logger.info('Deployment ready for ENS signature', {
                    deploymentId,
                    ipfsCid: uploadResult.rootCid,
                    ensName: project.ensName,
                });
            } else {
                // No ENS configured - mark as success immediately
                await db
                    .update(deployments)
                    .set({
                        status: 'success',
                        ipfsCid: uploadResult.rootCid,
                        completedAt: new Date(),
                    })
                    .where(eq(deployments.id, deploymentId));

                logger.info('Deployment completed (IPFS-only, no ENS)', {
                    deploymentId,
                    ipfsCid: uploadResult.rootCid,
                });
            }

            // Cleanup build directory after successful upload if enabled
            if (env.CLEANUP_BUILDS_ON_COMPLETE) {
                await buildService.cleanupDeploymentBuild(deploymentId).catch((cleanupError) => {
                    logger.warn('Failed to cleanup build directory after upload', { deploymentId, error: cleanupError });
                });
            }
        } catch (error) {
            logger.error(`Build/upload failed for deployment ${deploymentId}:`, error);

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

            // Cleanup build directory if enabled
            if (env.CLEANUP_BUILDS_ON_COMPLETE) {
                await buildService.cleanupDeploymentBuild(deploymentId).catch((cleanupError) => {
                    logger.warn('Failed to cleanup build directory after build failure', { deploymentId, error: cleanupError });
                });
            }
        }
    }

    /**
     * Skip ENS update and mark deployment as successful
     * POST /api/deployments/:id/ens/skip
     * 
     * When a deployment is awaiting_signature, the user can skip the ENS update
     * and mark the deployment as successful (IPFS upload completed).
     */
    async skipENS(req: Request, res: Response) {
        const { id } = req.params;
        const userId = req.userId!;

        logger.info('Skipping ENS update for deployment', { deploymentId: id, userId });

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

            if (deployment.status !== 'awaiting_signature') {
                return res.status(400).json({
                    error: 'InvalidState',
                    message: 'Only deployments awaiting ENS signature can skip ENS.',
                });
            }

            await db
                .update(deployments)
                .set({
                    status: 'success',
                    buildArtifactsPath: null,
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, id));

            // Cleanup build directory if enabled
            if (env.CLEANUP_BUILDS_ON_COMPLETE) {
                await buildService.cleanupDeploymentBuild(id).catch((error) => {
                    logger.warn('Failed to cleanup build directory after ENS skip', { deploymentId: id, error });
                });
            }

            logger.info('ENS update skipped, deployment marked as success', { deploymentId: id });

            res.json({
                status: 'success',
                message: 'Deployment completed without ENS update',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to skip ENS';
            logger.error('Failed to skip ENS:', error);
            res.status(500).json({
                error: 'SkipENSFailed',
                message,
            });
        }
    }

}

export const deploymentsController = new DeploymentsController();

