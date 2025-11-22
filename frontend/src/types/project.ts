import type { Deployment } from './deployment'

export interface Project {
  id: string
  userId: string
  name: string
  repoName: string
  repoUrl: string
  repoBranch: string
  autoDeployBranch: string
  ensName: string
  ensPrivateKey?: string
  ethereumRpcUrl: string
  buildCommand?: string | null
  outputDir?: string | null
  webhookEnabled: boolean
  createdAt: string
  updatedAt: string
  deployments?: Deployment[]
}

export type ProjectListItem = Project & {
  deployments: Deployment[]
}


