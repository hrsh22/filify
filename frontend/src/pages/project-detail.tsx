import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AxiosError } from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProject } from '@/hooks/use-project'
import { deploymentsService } from '@/services/deployments.service'
import { useToast } from '@/context/toast-context'
import { DeploymentStatusBadge } from '@/components/deployments/deployment-status-badge'

const RESUMABLE_STATUSES = new Set(['failed', 'uploading', 'updating_ens'])
const ACTIVE_STATUSES = new Set(['cloning', 'building', 'uploading', 'updating_ens'])

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { project, loading, error } = useProject(projectId)
  const { showToast } = useToast()
  const [isDeploying, setIsDeploying] = useState(false)
  const [resumeFromPrevious, setResumeFromPrevious] = useState(false)

  const latestDeployment = project?.deployments?.[0]
  const latestStatusLabel = latestDeployment ? latestDeployment.status.replace('_', ' ') : 'n/a'
  const canResume = useMemo(
    () => Boolean(latestDeployment && RESUMABLE_STATUSES.has(latestDeployment.status)),
    [latestDeployment]
  )
  const projectBusy = useMemo(
    () => Boolean(latestDeployment && ACTIVE_STATUSES.has(latestDeployment.status)),
    [latestDeployment]
  )

  useEffect(() => {
    if (!canResume) {
      setResumeFromPrevious(false)
    }
  }, [canResume])

  const handleDeploy = async () => {
    if (!project) return
    try {
      setIsDeploying(true)
      const { deploymentId } = await deploymentsService.create(project.id, {
        resumeFromPrevious: canResume && resumeFromPrevious,
      })
      showToast('Deployment started', 'success')
      setResumeFromPrevious(false)
      navigate(`/deployments/${deploymentId}`)
    } catch (err) {
      console.error('[ProjectDetail][deploy]', err)
      let message = 'Failed to start deployment'
      if (err instanceof AxiosError) {
        message = (err.response?.data as { message?: string })?.message ?? message
      }
      showToast(message, 'error')
    } finally {
      setIsDeploying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-10 w-10 border-t-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  if (!project) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Project</p>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.repoName}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back
          </Button>
          <Button onClick={handleDeploy} disabled={isDeploying || projectBusy}>
            {isDeploying ? 'Deploying...' : projectBusy ? 'Deployment running' : 'Deploy now'}
          </Button>
        </div>
      </div>

      {projectBusy ? (
        <p className="text-sm text-muted-foreground">
          A deployment is currently running. Cancel it or wait until it completes before starting a new one.
        </p>
      ) : null}

      {canResume ? (
        <label className="flex items-start gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border border-border accent-foreground"
            checked={resumeFromPrevious}
            onChange={(event) => setResumeFromPrevious(event.target.checked)}
            disabled={isDeploying || projectBusy}
          />
          <span>
            Resume from last build (status: {latestStatusLabel})
            <span className="block text-xs">
              Uncheck to run a full deployment and clone the repository again.
            </span>
          </span>
        </label>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Repository</p>
            <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-foreground underline-offset-4 hover:underline">
              {project.repoName}
            </a>
            <p className="text-xs text-muted-foreground">Branch: {project.repoBranch}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ENS</p>
            <p className="font-medium">{project.ensName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Build command</p>
            <p className="font-mono text-xs">{project.buildCommand ?? 'npm run build'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Output directory</p>
            <p className="font-mono text-xs">{project.outputDir ?? 'out'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.deployments && project.deployments.length > 0 ? (
            project.deployments.map((deployment) => (
              <div key={deployment.id} className="rounded-2xl border border-border/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <DeploymentStatusBadge status={deployment.status} />
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
                    </p>
                    {deployment.ipfsCid ? (
                      <a
                        href={`https://ipfs.io/ipfs/${deployment.ipfsCid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        IPFS: {deployment.ipfsCid}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/deployments/${deployment.id}`)}>
                      View status
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No deployments yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


