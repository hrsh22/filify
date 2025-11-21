import type { Deployment } from '@/types'
import { api } from './api'

export const deploymentsService = {
  async create(projectId: string, options?: { resumeFromPrevious?: boolean }) {
    const payload: Record<string, unknown> = { projectId }
    if (options?.resumeFromPrevious) {
      payload.resumeFromPrevious = true
    }
    const { data } = await api.post<{ deploymentId: string }>('/deployments', payload)
    return data
  },
  async getById(id: string) {
    const { data } = await api.get<Deployment>(`/deployments/${id}`)
    return data
  },
  async listByProject(projectId: string) {
    const { data } = await api.get<Deployment[]>(`/projects/${projectId}/deployments`)
    return data
  },
  async updateEns(id: string, ipfsCid: string) {
    const { data } = await api.post<{ status: string; message: string }>(`/deployments/${id}/ens`, { ipfsCid })
    return data
  },
  async cancel(id: string) {
    const { data } = await api.post<{ status: string; killed: boolean }>(`/deployments/${id}/cancel`)
    return data
  },
}


