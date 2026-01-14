import { db } from '../db';
import { deployments } from '../db/schema';
import { inArray, eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { buildService } from './build.service';

const STALE_STATUSES = [
    'pending_build',
    'cloning',
    'building',
    'pending_upload',
    'uploading',
];

export async function cancelStaleDeployments(): Promise<number> {
    try {
        const staleDeployments = await db.query.deployments.findMany({
            where: inArray(deployments.status, STALE_STATUSES),
        });

        if (staleDeployments.length === 0) {
            logger.info('No stale deployments found on startup');
            return 0;
        }

        logger.info(`Found ${staleDeployments.length} stale deployment(s) from previous server session`);

        for (const deployment of staleDeployments) {
            await db
                .update(deployments)
                .set({
                    status: 'failed',
                    errorMessage: 'Server restarted while deployment was in progress',
                    completedAt: new Date(),
                })
                .where(eq(deployments.id, deployment.id));

            await buildService.cleanupDeploymentBuild(deployment.id).catch(() => {});

            logger.info('Marked stale deployment as failed', {
                deploymentId: deployment.id,
                previousStatus: deployment.status,
            });
        }

        return staleDeployments.length;
    } catch (error) {
        logger.error('Failed to cancel stale deployments on startup', {
            error: error instanceof Error ? error.message : String(error),
        });
        return 0;
    }
}
