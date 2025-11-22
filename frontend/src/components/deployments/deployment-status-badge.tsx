import type { DeploymentStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

const badgeVariants: Record<DeploymentStatus, 'default' | 'success' | 'warning' | 'destructive'> = {
  pending_build: 'warning',
  cloning: 'warning',
  building: 'warning',
  pending_upload: 'warning',
  uploading: 'warning',
  updating_ens: 'warning',
  success: 'success',
  failed: 'destructive',
  cancelled: 'default',
}

const statusIcons: Record<DeploymentStatus, React.ReactNode> = {
  pending_build: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  cloning: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  building: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  pending_upload: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  uploading: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  updating_ens: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  failed: <XCircle className="h-3.5 w-3.5" />,
  cancelled: <AlertCircle className="h-3.5 w-3.5" />,
}

const labelMap: Partial<Record<DeploymentStatus, string>> = {
  pending_build: 'Building…',
  pending_upload: 'Uploading…',
}

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  const label = labelMap[status] ?? status.replace('_', ' ')
  return (
    <Badge variant={badgeVariants[status]} className="capitalize">
      {statusIcons[status]}
      {label}
    </Badge>
  )
}


