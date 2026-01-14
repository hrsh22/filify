import type { BranchSummary, RepositorySummary, GitHubInstallationsResponse } from '@/types'
import { api } from './api'

export const repositoriesService = {
  async getAll() {
    const { data } = await api.get<RepositorySummary[]>('/repositories')
    return data
  },

  async getBranches(installationId: string, fullName: string) {
    const [owner, repo] = fullName.split('/')
    if (!owner || !repo) {
      throw new Error('Invalid repository name')
    }
    const { data } = await api.get<BranchSummary[]>(
      `/repositories/${installationId}/${owner}/${repo}/branches`
    )
    return data
  },

  async getInstallations() {
    const { data } = await api.get<GitHubInstallationsResponse>('/github/installations')
    return data
  },

  async removeInstallation(installationId: string) {
    await api.delete(`/github/installations/${installationId}`)
  },
}
