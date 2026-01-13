import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface InstallationToken {
  token: string;
  expiresAt: Date;
}

const tokenCache = new Map<number, InstallationToken>();

class GitHubAppService {
  private appOctokit: Octokit;

  constructor() {
    this.appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_APP_ID,
        privateKey: Buffer.from(env.GITHUB_APP_PRIVATE_KEY!, 'base64').toString('utf-8'),
      },
    });
  }

  async getInstallationToken(installationId: number): Promise<string> {
    const cached = tokenCache.get(installationId);
    const now = new Date();

    if (cached && cached.expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
      return cached.token;
    }

    logger.debug('Fetching new installation token', { installationId });

    const { data } = await this.appOctokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    tokenCache.set(installationId, {
      token: data.token,
      expiresAt: new Date(data.expires_at),
    });

    logger.debug('Installation token cached', {
      installationId,
      expiresAt: data.expires_at,
    });

    return data.token;
  }

  getOctokitForInstallation(token: string): Octokit {
    return new Octokit({ auth: token });
  }

  async listInstallationRepos(installationId: number) {
    const token = await this.getInstallationToken(installationId);
    const octokit = this.getOctokitForInstallation(token);

    const { data } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    logger.debug('Listed repos for installation', {
      installationId,
      count: data.repositories.length,
    });

    return data.repositories.map((repo) => ({
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

  async getInstallation(installationId: number) {
    try {
      const { data } = await this.appOctokit.apps.getInstallation({
        installation_id: installationId,
      });
      return data;
    } catch (error) {
      logger.error('Failed to get installation', {
        installationId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async listBranches(installationId: number, owner: string, repo: string) {
    const token = await this.getInstallationToken(installationId);
    const octokit = this.getOctokitForInstallation(token);

    const { data } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map((branch) => ({
      name: branch.name,
      protected: branch.protected,
    }));
  }

  async getRepository(installationId: number, owner: string, repo: string) {
    const token = await this.getInstallationToken(installationId);
    const octokit = this.getOctokitForInstallation(token);

    const { data } = await octokit.repos.get({ owner, repo });

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

  getInstallUrl(state?: string): string {
    const baseUrl = `https://github.com/apps/${env.GITHUB_APP_NAME}/installations/new`;
    if (state) {
      return `${baseUrl}?state=${encodeURIComponent(state)}`;
    }
    return baseUrl;
  }

  async registerWebhook(
    installationId: number,
    repoFullName: string,
    webhookUrl: string,
    secret: string
  ): Promise<number> {
    const token = await this.getInstallationToken(installationId);
    const octokit = this.getOctokitForInstallation(token);
    const [owner, repo] = repoFullName.split('/');

    const { data: hooks } = await octokit.repos.listWebhooks({
      owner,
      repo,
      per_page: 100,
    });

    const existing = hooks.find((h) => h.config?.url === webhookUrl);
    if (existing) {
      await octokit.repos.updateWebhook({
        owner,
        repo,
        hook_id: existing.id,
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
      });
      return existing.id;
    }

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

    logger.info('Webhook registered', { repoFullName, webhookId: data.id });
    return data.id;
  }

  async unregisterWebhook(
    installationId: number,
    repoFullName: string,
    webhookUrl: string
  ): Promise<void> {
    const token = await this.getInstallationToken(installationId);
    const octokit = this.getOctokitForInstallation(token);
    const [owner, repo] = repoFullName.split('/');

    const { data: hooks } = await octokit.repos.listWebhooks({
      owner,
      repo,
      per_page: 100,
    });

    const existing = hooks.find((h) => h.config?.url === webhookUrl);
    if (existing) {
      await octokit.repos.deleteWebhook({
        owner,
        repo,
        hook_id: existing.id,
      });
      logger.info('Webhook unregistered', { repoFullName, webhookId: existing.id });
    }
  }
}

export const githubAppService = new GitHubAppService();
