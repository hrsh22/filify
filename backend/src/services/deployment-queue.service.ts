import { logger } from '../utils/logger';

type Task = (signal: AbortSignal) => Promise<void>;

export class CancellationError extends Error {
    constructor(message = 'Deployment was cancelled') {
        super(message);
        this.name = 'CancellationError';
    }
}

class DeploymentQueue {
    private readonly queues = new Map<string, Promise<void>>();
    private readonly abortControllers = new Map<string, AbortController>();

    enqueue(projectId: string, task: Task): void {
        const previous = this.queues.get(projectId) ?? Promise.resolve();
        const hasExisting = this.queues.has(projectId);

        if (hasExisting) {
            logger.debug('Queueing deployment task (previous task exists)', { projectId });
        } else {
            logger.info('Queueing deployment task (no previous task)', { projectId });
        }

        // Create abort controller for this task
        const abortController = new AbortController();
        this.abortControllers.set(projectId, abortController);

        const next = previous
            .catch((error) => {
                // Ignore CancellationError from previous task - it's expected
                if (error instanceof CancellationError) {
                    logger.debug('Previous deployment task was cancelled', { projectId });
                    return;
                }
                logger.warn('Previous deployment task failed', {
                    projectId,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
            })
            .then(() => {
                // Check if cancelled before starting
                if (abortController.signal.aborted) {
                    throw new CancellationError();
                }
                logger.debug('Starting deployment task', { projectId });
                return task(abortController.signal);
            })
            .catch((error) => {
                if (error instanceof CancellationError) {
                    logger.info('Deployment task cancelled', { projectId });
                    return;
                }
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
                    this.abortControllers.delete(projectId);
                    logger.debug('Deployment task completed and removed from queue', { projectId });
                }
            });

        this.queues.set(projectId, next);
    }

    /**
     * Clear the queue for a project and abort any running task.
     * This allows new deployments to start immediately after cancellation.
     */
    clearQueue(projectId: string): boolean {
        const abortController = this.abortControllers.get(projectId);
        const hadQueue = this.queues.has(projectId);

        if (abortController) {
            abortController.abort();
            logger.info('Aborted running deployment task', { projectId });
        }

        this.queues.delete(projectId);
        this.abortControllers.delete(projectId);

        if (hadQueue) {
            logger.info('Cleared deployment queue for project', { projectId });
        }

        return hadQueue;
    }

    /**
     * Check if a project has a pending or running task in the queue.
     */
    hasTask(projectId: string): boolean {
        return this.queues.has(projectId);
    }
}

export const deploymentQueue = new DeploymentQueue();



