import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { projects, deployments, users, githubInstallations } from '../db/schema';
import { eq } from 'drizzle-orm';
import { webhookSecretService } from '../services/webhook-secret.service';
import { logger } from '../utils/logger';
import { generateId } from '../utils/generateId';
import { deploymentQueue } from '../services/deployment-queue.service';
import { deploymentsController } from './deployments.controller';
import { githubAppService } from '../services/github-app.service';
import { env } from '../config/env';

type GithubPushPayload = {
    ref?: string;
    repository?: {
        full_name?: string;
    };
    head_commit?: {
        id?: string;
        message?: string;
    };
};

type ProjectWithUser = typeof projects.$inferSelect & {
    user: typeof users.$inferSelect;
    installation: typeof githubInstallations.$inferSelect | null;
};

const WEBHOOK_ENDPOINT = '/api/webhooks/github';

class WebhooksController {
    private getWebhookUrl() {
        return new URL(WEBHOOK_ENDPOINT, env.BACKEND_URL).toString();
    }

    private verifySignature(secret: string, payload: Buffer, signatureHeader: string | undefined): boolean {
        if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
            return false;
        }

        const computed = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
        const received = Buffer.from(signatureHeader);
        const expected = Buffer.from(computed);

        if (received.length !== expected.length) {
            return false;
        }

        return crypto.timingSafeEqual(received, expected);
    }

    private async rotateWebhookSecret(project: ProjectWithUser) {
        if (!project.installation) {
            logger.warn('Cannot rotate webhook secret: project installation missing', { projectId: project.id });
            return;
    }

        try {
            const secretPlain = webhookSecretService.generate();
            const encryptedSecret = webhookSecretService.encrypt(secretPlain);
            const webhookUrl = this.getWebhookUrl();

            await githubAppService.registerWebhook(project.installation.installationId, project.repoFullName, webhookUrl, secretPlain);

            await db
                .update(projects)
                .set({
                    webhookSecret: encryptedSecret,
                    updatedAt: new Date(),
                })
                .where(eq(projects.id, project.id));

            logger.info('Webhook secret rotated after invalid signature', {
                projectId: project.id,
                repoFullName: project.repoFullName,
            });
        } catch (error) {
            logger.error('Failed to rotate webhook secret after invalid signature', {
                projectId: project.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleGithubWebhook(req: Request, res: Response) {
        const deliveryId = req.header('X-GitHub-Delivery');
        const event = req.header('X-GitHub-Event');
        const signature = req.header('X-Hub-Signature-256');
        const payloadBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '{}');

        logger.info('GitHub webhook received', {
            deliveryId,
            event,
            hasSignature: !!signature,
            ip: req.ip,
        });

        if (event !== 'push') {
            logger.debug('Webhook ignored: not a push event', { event, deliveryId });
            return res.status(200).json({ ignored: true });
        }

        let payload: GithubPushPayload;
        try {
            payload = JSON.parse(payloadBuffer.toString('utf8')) as GithubPushPayload;
        } catch (error) {
            logger.warn('Invalid GitHub webhook payload', {
                error: error instanceof Error ? error.message : String(error),
                deliveryId,
            });
            return res.status(400).json({ error: 'InvalidPayload' });
        }

        const repoFullName = payload.repository?.full_name;
        const ref = payload.ref ?? '';
        const branch = ref.split('/').pop();
        const commitSha = payload.head_commit?.id;
        const commitMessage = payload.head_commit?.message;

        logger.debug('Webhook payload parsed', {
            deliveryId,
            repoFullName,
            branch,
            commitSha,
        });

        if (!repoFullName) {
            logger.debug('Webhook ignored: no repository name', { deliveryId });
            return res.status(200).json({ ignored: true });
        }

        try {
            const project = await db.query.projects.findFirst({
                where: eq(projects.repoFullName, repoFullName),
                with: { user: true, installation: true },
            });

        if (!project || !project.webhookEnabled || !project.webhookSecret) {
                logger.debug('Webhook ignored: project not found or webhook disabled', {
                    deliveryId,
                    repoFullName,
                    projectId: project?.id,
                    webhookEnabled: project?.webhookEnabled,
                });
                return res.status(200).json({ ignored: true });
            }

            logger.debug('Verifying webhook signature', {
                deliveryId,
                projectId: project.id,
                repoFullName,
            });

            const secret = webhookSecretService.decrypt(project.webhookSecret);
            const signatureValid = this.verifySignature(secret, payloadBuffer, signature);

            if (!signatureValid) {
                logger.warn('Invalid webhook signature', {
                    projectId: project.id,
                    deliveryId,
                    repoFullName,
                });

                // Attempt to rotate the webhook secret so the next delivery succeeds
                await this.rotateWebhookSecret(project);

                return res.status(202).json({ error: 'InvalidSignature', rotated: true });
            }

            logger.debug('Webhook signature verified', { projectId: project.id, deliveryId });

            const expectedBranch = project.autoDeployBranch ?? project.repoBranch ?? 'main';

            if (!branch || branch !== expectedBranch) {
                logger.info('Webhook ignored: branch mismatch', {
                    projectId: project.id,
                    deliveryId,
                    receivedBranch: branch,
                    expectedBranch,
                });
                return res.status(200).json({ ignored: true });
            }

            const deploymentId = generateId();

            logger.info('Creating webhook-triggered deployment', {
                deploymentId,
                projectId: project.id,
                projectName: project.name,
                branch,
                commitSha,
                commitMessage,
                deliveryId,
            });

            await db.insert(deployments).values({
                id: deploymentId,
                projectId: project.id,
                status: 'pending_build',
                triggeredBy: 'webhook',
                commitSha: commitSha ?? null,
                commitMessage: commitMessage ?? null,
                createdAt: new Date(),
            });

            logger.info('Enqueuing webhook deployment', {
                deploymentId,
                projectId: project.id,
            });

            if (!project.installation) {
                logger.warn('Webhook ignored: no GitHub installation linked', {
                    deliveryId,
                    projectId: project.id,
                    repoFullName,
                });
                return res.status(200).json({ ignored: true });
            }

            deploymentQueue.enqueue(project.id, () => deploymentsController.runBuildPipeline(deploymentId, project, project.installation!.installationId));

            logger.info('Webhook deployment queued successfully', {
                deploymentId,
                projectId: project.id,
                deliveryId: deliveryId ?? 'n/a',
            });

            return res.status(200).json({ deploymentId });
        } catch (error) {
            logger.error('Failed to process GitHub webhook:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const webhooksController = new WebhooksController();


