import type { BranchSummary, RepositorySummary } from '@/types'
import { api } from './api'

export const repositoriesService = {
  async getAll() {
    const { data } = await api.get<RepositorySummary[]>('/repositories')
    return data
  },
  async getBranches(fullName: string) {
    const [owner, repo] = fullName.split('/')
    if (!owner || !repo) {
      throw new Error('Invalid repository name')
    }
    const { data } = await api.get<BranchSummary[]>(`/repositories/${owner}/${repo}/branches`)
    return data
  },
}


