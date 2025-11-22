import { logger } from '../utils/logger';

type Task = () => Promise<void>;

class DeploymentQueue {
    private readonly queues = new Map<string, Promise<void>>();

    enqueue(projectId: string, task: Task): void {
        const previous = this.queues.get(projectId) ?? Promise.resolve();
        const hasExisting = this.queues.has(projectId);

        if (hasExisting) {
            logger.debug('Queueing deployment task (previous task exists)', { projectId });
        } else {
            logger.info('Queueing deployment task (no previous task)', { projectId });
        }

        const next = previous
            .catch((error) => {
                logger.warn('Previous deployment task failed', {
                    projectId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
            })
            .then(() => {
                logger.debug('Starting deployment task', { projectId });
                return task();
            })
            .catch((error) => {
                logger.error('Deployment task failed', {
                    projectId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
            })
            .finally(() => {
                const current = this.queues.get(projectId);
                if (current === next) {
                    this.queues.delete(projectId);
                    logger.debug('Deployment task completed and removed from queue', { projectId });
                }
            });

        this.queues.set(projectId, next);
    }
}

export const deploymentQueue = new DeploymentQueue();



