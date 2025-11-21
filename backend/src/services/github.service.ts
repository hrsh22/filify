import { Octokit } from '@octokit/rest';
import { encryptionService } from './encryption.service';

class GitHubService {
    private getOctokit(encryptedToken: string): Octokit {
        const token = encryptionService.decrypt(encryptedToken);
        return new Octokit({ auth: token });
    }

    async listRepositories(encryptedToken: string) {
        const octokit = this.getOctokit(encryptedToken);

        const { data } = await octokit.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100,
            visibility: 'all',
        });

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
        const octokit = this.getOctokit(encryptedToken);

        const { data } = await octokit.repos.listBranches({
            owner,
            repo,
            per_page: 100,
        });

        return data.map((branch: any) => ({
            name: branch.name,
            protected: branch.protected,
        }));
    }

    async getRepository(encryptedToken: string, owner: string, repo: string) {
        const octokit = this.getOctokit(encryptedToken);

        const { data } = await octokit.repos.get({
            owner,
            repo,
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
}

export const githubService = new GitHubService();

