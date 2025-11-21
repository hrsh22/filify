export type DeploymentStatus = 'cloning' | 'building' | 'uploading' | 'updating_ens' | 'success' | 'failed' | 'cancelled'

export interface Deployment {
  id: string
  projectId: string
  status: DeploymentStatus
  buildLog?: string | null
  ipfsCid?: string | null
  ensTxHash?: string | null
  errorMessage?: string | null
  createdAt: string
  completedAt?: string | null
}


