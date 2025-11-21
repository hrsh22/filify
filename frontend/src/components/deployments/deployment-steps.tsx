import { Check, Loader2 } from 'lucide-react'
import type { DeploymentStatus } from '@/types'

const order: DeploymentStatus[] = ['cloning', 'building', 'uploading', 'updating_ens', 'success']

function getStepState(current: DeploymentStatus, step: DeploymentStatus) {
  const currentIndex = order.indexOf(current)
  const stepIndex = order.indexOf(step)
  const normalizedCurrent = currentIndex === -1 ? order.length : currentIndex
  if (normalizedCurrent > stepIndex) return 'complete'
  if (normalizedCurrent === stepIndex) return 'active'
  return 'pending'
}

const labelMap: Record<DeploymentStatus, string> = {
  cloning: 'Cloning repository',
  building: 'Building project',
  uploading: 'Uploading to Filecoin',
  updating_ens: 'Updating ENS',
  success: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function DeploymentSteps({ status }: { status: DeploymentStatus }) {
  const steps = status === 'failed' || status === 'cancelled' ? order.slice(0, 4) : order
  return (
    <ol className="space-y-4">
      {steps.map((step) => {
        const state = getStepState(status, step)
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                state === 'complete'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
                  : state === 'active'
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground'
              }`}
            >
              {state === 'complete' ? <Check className="h-4 w-4" /> : state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 'success' ? 5 : order.indexOf(step) + 1}
            </span>
            <div>
              <p className="font-medium capitalize">{labelMap[step]}</p>
              <p className="text-sm text-muted-foreground">
                {state === 'active'
                  ? 'In progress'
                  : state === 'complete'
                    ? 'Complete'
                    : 'Pending'}
              </p>
            </div>
          </li>
        )
      })}
      {status === 'failed' ? (
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-destructive text-destructive">!</span>
          <div>
            <p className="font-medium text-destructive">Deployment failed</p>
            <p className="text-sm text-muted-foreground">Check logs below for details.</p>
          </div>
        </li>
      ) : status === 'cancelled' ? (
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground">✕</span>
          <div>
            <p className="font-medium">Deployment cancelled</p>
            <p className="text-sm text-muted-foreground">Cancelled before completion.</p>
          </div>
        </li>
      ) : null}
    </ol>
  )
}


