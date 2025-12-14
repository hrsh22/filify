import type { Deployment } from './deployment'

export type Network = 'mainnet' | 'sepolia'

export interface Project {
  id: string
  userId: string
  name: string
  repoName: string
  repoUrl: string
  repoBranch: string
  autoDeployBranch: string
  network: Network
  ensName: string
  ensOwnerAddress: string
  ethereumRpcUrl: string
  buildCommand?: string | null
  outputDir?: string | null
  frontendDir?: string | null
  webhookEnabled: boolean
  createdAt: string
  updatedAt: string
  deployments?: Deployment[]
}

export type ProjectListItem = Project & {
  deployments: Deployment[]
}
