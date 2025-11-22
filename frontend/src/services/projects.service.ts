import type { Project } from '@/types'
import { api } from './api'

type CreateProjectPayload = {
  name: string
  repoName: string
  repoUrl: string
  repoBranch: string
  ensName: string
  ensPrivateKey: string
  ethereumRpcUrl: string
  buildCommand?: string
  outputDir?: string
}

type UpdateProjectPayload = Partial<CreateProjectPayload>

export const projectsService = {
  async getAll() {
    const { data } = await api.get<Project[]>('/projects')
    return data
  },
  async getById(id: string) {
    const { data } = await api.get<Project>(`/projects/${id}`)
    return data
  },
  async create(payload: CreateProjectPayload) {
    const { data } = await api.post<Project>('/projects', payload)
    return data
  },
  async update(id: string, payload: UpdateProjectPayload) {
    const { data } = await api.put<Project>(`/projects/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await api.delete(`/projects/${id}`)
  },
  async enableWebhook(id: string, branch?: string) {
    const { data } = await api.post<{ webhookEnabled: boolean; autoDeployBranch: string }>(`/projects/${id}/webhook/enable`, {
      branch,
    })
    return data
  },
  async disableWebhook(id: string) {
    const { data } = await api.post<{ webhookEnabled: boolean }>(`/projects/${id}/webhook/disable`)
    return data
  },
}


