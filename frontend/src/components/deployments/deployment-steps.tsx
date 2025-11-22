import { Check, Loader2, GitBranch, Hammer, Upload, Globe, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import type { DeploymentStatus } from '@/types'

const order: DeploymentStatus[] = ['pending_build', 'cloning', 'building', 'pending_upload', 'uploading', 'updating_ens', 'success']

function getStepState(current: DeploymentStatus, step: DeploymentStatus) {
  const currentIndex = order.indexOf(current)
  const stepIndex = order.indexOf(step)
  const normalizedCurrent = currentIndex === -1 ? order.length : currentIndex
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
  updating_ens: 'Updating ENS',
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
  updating_ens: Globe,
  success: CheckCircle,
}

export function DeploymentSteps({ status }: { status: DeploymentStatus }) {
  const steps = status === 'failed' || status === 'cancelled' ? order.slice(0, 4) : order
  return (
    <ol className="space-y-5">
      {steps.map((step, index) => {
        const state = getStepState(status, step)
        const Icon = stepIcons[step]
        return (
          <li key={step} className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold text-sm shadow-neo-sm transition-neo ${
                  state === 'complete'
                    ? 'bg-cyan border border-cyan text-black'
                    : state === 'active'
                      ? 'bg-primary border border-primary text-black animate-pulse-glow'
                      : 'bg-card/50 text-muted-foreground shadow-neo-inset'
                }`}
              >
                {state === 'complete' ? (
                  <Check className="h-6 w-6" />
                ) : state === 'active' ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : Icon ? (
                  <Icon className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`absolute left-1/2 top-12 h-5 w-0.5 -translate-x-1/2 ${
                  state === 'complete' ? 'bg-gradient-accent' : 'bg-muted/30'
                }`} />
              )}
            </div>
            <div className="flex-1 pt-2">
              <p className={`font-bold capitalize text-base ${
                state === 'active' ? 'text-primary' : state === 'complete' ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {labelMap[step]}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                {state === 'active'
                  ? 'In progress...'
                  : state === 'complete'
                    ? 'Complete ✓'
                    : 'Pending'}
              </p>
            </div>
          </li>
        )
      })}
      {status === 'failed' ? (
        <li className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-destructive/20 font-bold text-destructive shadow-neo-sm">
            <XCircle className="h-6 w-6" />
          </div>
          <div className="pt-2">
            <p className="font-bold text-destructive text-base">Deployment failed</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Check logs below for details.</p>
          </div>
        </li>
      ) : status === 'cancelled' ? (
        <li className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/30 font-bold text-muted-foreground shadow-neo-sm">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="pt-2">
            <p className="font-bold text-base">Deployment cancelled</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Cancelled before completion.</p>
          </div>
        </li>
      ) : null}
    </ol>
  )
}


