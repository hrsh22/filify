import type { Project } from '@/types'
import { api } from './api'
import type { Network } from '@/context/network-context'

type CreateProjectPayload = {
  name: string
  repoFullName: string
  repoUrl: string
  repoBranch: string
  installationId: string
  network: Network
  ensName?: string
  ensOwnerAddress?: string
  ethereumRpcUrl?: string
  buildCommand?: string
  outputDir?: string
  frontendDir?: string
  force?: boolean
}

type UpdateProjectPayload = Partial<Omit<CreateProjectPayload, 'network'>> & {
  autoDeployBranch?: string
}

export const projectsService = {
  async getAll(network: Network) {
    const { data } = await api.get<Project[]>(`/projects?network=${network}`)
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
  async attachEns(id: string, ensName: string, ensOwnerAddress: string, force = false) {
    const { data } = await api.post<{
      needsSignature: boolean;
      deploymentId?: string;
      ipfsCid?: string;
      payload?: any;
    }>(`/projects/${id}/ens/attach`, { ensName, ensOwnerAddress, force });
    return data;
  },
  async confirmEnsAttach(id: string, txHash: string, ipfsCid: string) {
    const { data } = await api.post<{
      status: string;
      txHash: string;
      verified: boolean;
      blockNumber: number;
    }>(`/projects/${id}/ens/confirm`, { txHash, ipfsCid });
    return data;
  },
  async removeEns(id: string) {
    const { data } = await api.delete<{ success: boolean }>(`/projects/${id}/ens`);
    return data;
  },
}
