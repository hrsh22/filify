export type DeploymentStatus =
  | 'pending_build'
  | 'cloning'
  | 'building'
  | 'pending_upload'
  | 'uploading'
  | 'awaiting_signature'
  | 'awaiting_confirmation'
  | 'success'
  | 'failed'
  | 'cancelled'

export interface Deployment {
  id: string
  projectId: string
  status: DeploymentStatus
  buildLog?: string | null
  ipfsCid?: string | null
  ensTxHash?: string | null
  errorMessage?: string | null
  triggeredBy?: 'manual' | 'webhook' | null
  commitSha?: string | null
  commitMessage?: string | null
  createdAt: string
  completedAt?: string | null
}


