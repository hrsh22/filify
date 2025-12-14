import { Check, Loader2, GitBranch, Hammer, Upload, Globe, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import type { DeploymentStatus } from '@/types'

const ALL_STEPS: DeploymentStatus[] = [
  'pending_build',
  'cloning',
  'building',
  'pending_upload',
  'uploading',
  'awaiting_signature',
  'awaiting_confirmation',
  'success',
]

// Steps for IPFS-only deployments (no ENS)
const IPFS_ONLY_STEPS: DeploymentStatus[] = [
  'pending_build',
  'cloning',
  'building',
  'pending_upload',
  'uploading',
  'success',
]

function getStepState(current: DeploymentStatus, step: DeploymentStatus, steps: DeploymentStatus[]) {
  const currentIndex = steps.indexOf(current)
  const stepIndex = steps.indexOf(step)

  // For IPFS-only: if current is 'success' and step is in our list, it's complete
  const normalizedCurrent = currentIndex === -1 ? steps.length : currentIndex

  if (normalizedCurrent > stepIndex) return 'complete'
  if (normalizedCurrent === stepIndex) {
    if (current === 'success') {
      return 'complete'
    }
    return 'active'
  }
  return 'pending'
}

const labelMap: Record<DeploymentStatus, string> = {
  pending_build: 'Queued for build',
  cloning: 'Cloning repository',
  building: 'Building project',
  pending_upload: 'Waiting for upload',
  uploading: 'Uploading to Filecoin',
  awaiting_signature: 'Waiting for ENS signature',
  awaiting_confirmation: 'Awaiting confirmation',
  success: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  pending_build: Clock,
  cloning: GitBranch,
  building: Hammer,
  pending_upload: Upload,
  uploading: Upload,
  awaiting_signature: Globe,
  awaiting_confirmation: Clock,
  success: CheckCircle,
}

interface DeploymentStepsProps {
  status: DeploymentStatus
  hasEns?: boolean
}

export function DeploymentSteps({ status, hasEns = true }: DeploymentStepsProps) {
  // Choose steps based on whether ENS is enabled
  const baseSteps = hasEns ? ALL_STEPS : IPFS_ONLY_STEPS
  const steps = status === 'failed' || status === 'cancelled' ? baseSteps.slice(0, 4) : baseSteps

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const state = getStepState(status, step, baseSteps)
        const Icon = stepIcons[step]
        return (
          <li key={step} className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold text-sm transition-smooth ${state === 'complete'
                    ? 'bg-success border-success text-success-foreground'
                    : state === 'active'
                      ? 'bg-primary border-primary text-primary-foreground animate-pulse-slow'
                      : 'bg-background border-border text-muted-foreground'
                  }`}
              >
                {state === 'complete' ? (
                  <Check className="h-5 w-5" />
                ) : state === 'active' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : Icon ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`absolute left-1/2 top-10 h-4 w-0.5 -translate-x-1/2 ${state === 'complete' ? 'bg-success' : 'bg-border'
                  }`} />
              )}
            </div>
            <div className="flex-1 pt-1.5">
              <p className={`font-semibold text-sm ${state === 'active' ? 'text-primary' : state === 'complete' ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                {labelMap[step]}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state === 'active'
                  ? 'In progress...'
                  : state === 'complete'
                    ? 'Complete'
                    : 'Pending'}
              </p>
            </div>
          </li>
        )
      })}
      {status === 'failed' && (
        <li className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
            <XCircle className="h-5 w-5" />
          </div>
          <div className="pt-1.5">
            <p className="font-semibold text-sm text-destructive">Deployment failed</p>
            <p className="text-xs text-muted-foreground mt-0.5">Check logs below for details.</p>
          </div>
        </li>
      )}
      {status === 'cancelled' && (
        <li className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="pt-1.5">
            <p className="font-semibold text-sm">Deployment cancelled</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cancelled before completion.</p>
          </div>
        </li>
      )}
    </ol>
  )
}
