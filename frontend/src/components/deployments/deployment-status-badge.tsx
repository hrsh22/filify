import type { DeploymentStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'

const badgeVariants: Record<DeploymentStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  pending_build: 'warning',
  cloning: 'info',
  building: 'info',
  pending_upload: 'warning',
  uploading: 'info',
  awaiting_signature: 'warning',
  awaiting_confirmation: 'warning',
  success: 'success',
  failed: 'destructive',
  cancelled: 'default',
}

const statusIcons: Record<DeploymentStatus, React.ReactNode> = {
  pending_build: <Clock className="h-3.5 w-3.5" />,
  cloning: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  building: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  pending_upload: <Clock className="h-3.5 w-3.5" />,
  uploading: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  awaiting_signature: <Clock className="h-3.5 w-3.5" />,
  awaiting_confirmation: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
  cancelled: <AlertCircle className="h-3.5 w-3.5" />,
}

const labelMap: Partial<Record<DeploymentStatus, string>> = {
  pending_build: 'Queued',
  pending_upload: 'Ready to upload',
  awaiting_signature: 'Awaiting signature',
  awaiting_confirmation: 'Confirming',
}

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  const label = labelMap[status] ?? status.replace('_', ' ')
  const icon = statusIcons[status] ?? <Loader2 className="h-3.5 w-3.5 animate-spin" />
  const variant = badgeVariants[status] ?? 'warning'
  return (
    <Badge variant={variant} className="capitalize inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </Badge>
  )
}
