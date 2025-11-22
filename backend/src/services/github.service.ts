import { Octokit } from '@octokit/rest';
import { encryptionService } from './encryption.service';
import { logger } from '../utils/logger';

class GitHubService {
    private getOctokit(encryptedToken: string): Octokit {
        const token = encryptionService.decrypt(encryptedToken);
        return new Octokit({ auth: token });
    }

    private parseRepoFullName(fullName: string) {
        const [owner, repo] = fullName.split('/');
        if (!owner || !repo) {
            throw new Error(`Invalid repository name: ${fullName}`);
        }
        return { owner, repo };
    }

    private async findWebhookByUrl(octokit: Octokit, owner: string, repo: string, webhookUrl: string) {
        const { data } = await octokit.repos.listWebhooks({
            owner,
            repo,
            per_page: 100,
        });
        return data.find((hook: any) => hook.config?.url === webhookUrl);
    }

    async listRepositories(encryptedToken: string) {
        logger.debug('Fetching user repositories from GitHub');
        const octokit = this.getOctokit(encryptedToken);

        const { data } = await octokit.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100,
            visibility: 'all',
        });

        logger.info('Repositories fetched successfully', { count: data.length });

        return data.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            url: repo.html_url,
            cloneUrl: repo.clone_url,
            defaultBranch: repo.default_branch,
            private: repo.private,
            description: repo.description,
            updatedAt: repo.updated_at,
        }));
    }

    async listBranches(encryptedToken: string, owner: string, repo: string) {
        logger.debug('Fetching repository branches', { owner, repo });
        const octokit = this.getOctokit(encryptedToken);

        const { data } = await octokit.repos.listBranches({
            owner,
            repo,
            per_page: 100,
        });

        logger.debug('Branches fetched successfully', { owner, repo, count: data.length });

        return data.map((branch: any) => ({
            name: branch.name,
            protected: branch.protected,
        }));
    }

    async getRepository(encryptedToken: string, owner: string, repo: string) {
        logger.debug('Fetching repository details', { owner, repo });
        const octokit = this.getOctokit(encryptedToken);

        const { data } = await octokit.repos.get({
            owner,
            repo,
        });

        logger.debug('Repository details fetched successfully', {
            owner,
            repo,
            fullName: data.full_name,
            defaultBranch: data.default_branch,
        });

        return {
            id: data.id,
            name: data.name,
            fullName: data.full_name,
            url: data.html_url,
            cloneUrl: data.clone_url,
            defaultBranch: data.default_branch,
            private: data.private,
        };
    }

    async registerWebhook(encryptedToken: string, repoFullName: string, webhookUrl: string, secret: string) {
        logger.info('Registering GitHub webhook', { repoFullName, webhookUrl });
        const octokit = this.getOctokit(encryptedToken);
        const { owner, repo } = this.parseRepoFullName(repoFullName);

        const existing = await this.findWebhookByUrl(octokit, owner, repo, webhookUrl);
        if (existing) {
            logger.info('Webhook already exists, reusing', {
                repoFullName,
                webhookId: existing.id,
            });
            return existing.id;
        }

        logger.debug('Creating new webhook', { owner, repo, webhookUrl });
        const { data } = await octokit.repos.createWebhook({
            owner,
            repo,
            events: ['push'],
            config: {
                url: webhookUrl,
                content_type: 'json',
                secret,
                insecure_ssl: '0',
            },
            active: true,
        });

        logger.info('Webhook registered successfully', {
            repoFullName,
            webhookId: data.id,
            webhookUrl,
        });

        return data.id;
    }

    async unregisterWebhook(encryptedToken: string, repoFullName: string, webhookUrl: string) {
        logger.info('Unregistering GitHub webhook', { repoFullName, webhookUrl });
        const octokit = this.getOctokit(encryptedToken);
        const { owner, repo } = this.parseRepoFullName(repoFullName);

        const existing = await this.findWebhookByUrl(octokit, owner, repo, webhookUrl);
        if (!existing) {
            logger.debug('Webhook not found, nothing to unregister', { repoFullName, webhookUrl });
            return;
        }

        logger.debug('Deleting webhook', { owner, repo, webhookId: existing.id });
        await octokit.repos.deleteWebhook({
            owner,
            repo,
            hook_id: existing.id,
        });

        logger.info('Webhook unregistered successfully', {
            repoFullName,
            webhookId: existing.id,
        });
    }
}

export const githubService = new GitHubService();

