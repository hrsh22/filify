import type { Deployment } from '@/types'
import { api } from './api'

export type PreparedEnsPayload = {
  resolverAddress: string
  data: string
  chainId: number
  rpcUrl: string
  encodedContenthash: string
  normalizedCid: string
  gasEstimate?: string | null
}

export const deploymentsService = {
  async create(projectId: string) {
    const { data } = await api.post<{ deploymentId: string }>('/deployments', { projectId })
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
  async list(params?: { status?: string; limit?: number }) {
    const { data } = await api.get<Deployment[]>('/deployments', {
      params,
    })
    return data
  },
  async prepareEns(id: string, ipfsCid: string) {
    const { data } = await api.post<{ status: string; payload: PreparedEnsPayload }>(
      `/deployments/${id}/ens/prepare`,
      { ipfsCid }
    )
    return data
  },
  async confirmEns(id: string, txHash: string) {
    const { data } = await api.post<{ status: string; txHash: string; verified: boolean }>(
      `/deployments/${id}/ens/confirm`,
      { txHash }
    )
    return data
  },
  async markUploadFailed(id: string, message?: string) {
    await api.post(`/deployments/${id}/upload/fail`, { message })
  },
  async cancel(id: string) {
    const { data } = await api.post<{ status: string; killed: boolean }>(`/deployments/${id}/cancel`)
    return data
  },
  async skipEns(id: string) {
    const { data } = await api.post<{ status: string; message: string }>(`/deployments/${id}/ens/skip`)
    return data
  },
}


