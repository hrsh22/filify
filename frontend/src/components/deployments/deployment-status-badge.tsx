import type { DeploymentStatus } from '@/types'
import { Badge } from '@/components/ui/badge'

const badgeVariants: Record<DeploymentStatus, 'default' | 'success' | 'warning' | 'destructive'> = {
  cloning: 'warning',
  building: 'warning',
  uploading: 'warning',
  updating_ens: 'warning',
  success: 'success',
  failed: 'destructive',
  cancelled: 'default',
}

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <Badge variant={badgeVariants[status]} className="capitalize">
      {status.replace('_', ' ')}
    </Badge>
  )
}


