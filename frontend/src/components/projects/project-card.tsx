import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { AxiosError } from 'axios'
import type { Project } from '@/types'
import { deploymentsService } from '@/services/deployments.service'
import { projectsService } from '@/services/projects.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/context/toast-context'

interface ProjectCardProps {
  project: Project
  onChange?: () => void
}

const statusVariantMap: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  success: 'success',
  failed: 'destructive',
  building: 'warning',
  uploading: 'warning',
  updating_ens: 'warning',
  cloning: 'warning',
  cancelled: 'default',
}

const RESUMABLE_STATUSES = new Set(['failed', 'uploading', 'updating_ens'])
const ACTIVE_STATUSES = new Set(['cloning', 'building', 'uploading', 'updating_ens'])

export function ProjectCard({ project, onChange }: ProjectCardProps) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [isDeploying, setIsDeploying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [resumeFromPrevious, setResumeFromPrevious] = useState(false)
  const latestDeployment = project.deployments?.[0]
  const lastStatusLabel = latestDeployment ? latestDeployment.status.replace('_', ' ') : 'unknown'
  const canResume = Boolean(latestDeployment && RESUMABLE_STATUSES.has(latestDeployment.status))
  const projectBusy = Boolean(latestDeployment && ACTIVE_STATUSES.has(latestDeployment.status))

  useEffect(() => {
    if (!canResume) {
      setResumeFromPrevious(false)
    }
  }, [canResume])

  const handleDeploy = async () => {
    try {
      setIsDeploying(true)
      const { deploymentId } = await deploymentsService.create(project.id, {
        resumeFromPrevious: canResume && resumeFromPrevious,
      })
      showToast('Deployment started', 'success')
      setResumeFromPrevious(false)
      navigate(`/deployments/${deploymentId}`)
    } catch (error) {
      console.error('[ProjectCard][deploy]', error)
      let message = 'Failed to start deployment'
      if (error instanceof AxiosError) {
        message = (error.response?.data as { message?: string })?.message ?? message
      }
      showToast(message, 'error')
    } finally {
      setIsDeploying(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this project? This cannot be undone.')) {
      return
    }
    try {
      setIsDeleting(true)
      await projectsService.remove(project.id)
      showToast('Project deleted', 'success')
      onChange?.()
    } catch (error) {
      console.error('[ProjectCard][delete]', error)
      showToast('Failed to delete project', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Repository</p>
          <a href={project.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-lg font-semibold text-foreground hover:underline">
            {project.repoName}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${project.id}`)}>
          View details
        </Button>
      </div>

      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-muted-foreground">ENS domain</p>
          <p className="font-medium">{project.ensName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Latest deployment</p>
          {latestDeployment ? (
            <Badge variant={statusVariantMap[latestDeployment.status] ?? 'outline'} className="capitalize">
              {latestDeployment.status.replace('_', ' ')}
            </Badge>
          ) : (
            <p className="font-medium text-muted-foreground">Never deployed</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Build command</p>
          <p className="font-mono text-xs">{project.buildCommand ?? 'npm run build'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Output directory</p>
          <p className="font-mono text-xs">{project.outputDir ?? 'out'}</p>
        </div>
      </div>

      {canResume ? (
        <label className="flex items-start gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border border-border accent-foreground"
            checked={resumeFromPrevious}
            onChange={(event) => setResumeFromPrevious(event.target.checked)}
            disabled={isDeploying}
          />
          <span>
            Resume from last build (status: {lastStatusLabel})
            <span className="block text-xs">
              Uncheck to start a fresh deployment (will re-clone the repository).
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleDeploy} disabled={isDeploying || projectBusy}>
          {isDeploying ? 'Deploying...' : 'Deploy'}
        </Button>
        <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
      {projectBusy ? (
        <p className="text-sm text-muted-foreground">
          A deployment is already running. Cancel it or wait for it to finish before starting another.
        </p>
      ) : null}
    </div>
  )
}


