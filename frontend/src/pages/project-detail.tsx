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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-cyan">Project</p>
          <h2 className="text-4xl font-bold text-foreground">{project.name}</h2>
          <p className="text-base font-medium text-muted-foreground">{project.repoName}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            Back
          </Button>
          <Button onClick={handleDeploy} disabled={isDeploying || projectBusy} size="lg" className="shadow-neo">
            {isDeploying ? 'Deploying...' : projectBusy ? 'Deployment running' : 'Deploy now'}
          </Button>
        </div>
      </div>

      {projectBusy ? (
        <div className="flex items-start gap-3 rounded-xl bg-primary/10 p-5 text-primary border border-primary/20 shadow-neo-sm">
          <p className="text-sm font-semibold">
            A deployment is currently running. Cancel it or wait until it completes before starting a new one.
          </p>
        </div>
      ) : null}

      {canResume ? (
        <label className="flex items-start gap-3 rounded-xl bg-muted/30 p-5 text-sm font-medium text-muted-foreground shadow-neo-inset cursor-pointer transition-neo hover:bg-muted/40">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded-lg border-2 border-border accent-primary shadow-neo-sm cursor-pointer"
            checked={resumeFromPrevious}
            onChange={(event) => setResumeFromPrevious(event.target.checked)}
            disabled={isDeploying || projectBusy}
          />
          <div className="flex-1 space-y-1">
            <span className="font-semibold text-foreground">Resume from last build (status: {latestStatusLabel})</span>
            <span className="block text-xs">
              Uncheck to run a full deployment and clone the repository again.
            </span>
          </div>
        </label>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Repository</p>
            <a href={project.repoUrl} target="_blank" rel="noreferrer" className="font-bold text-foreground underline-offset-4 hover:underline">
              {project.repoName}
            </a>
            <p className="text-xs font-medium text-muted-foreground">Branch: {project.repoBranch}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">ENS</p>
            <p className="font-bold">{project.ensName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Build command</p>
            <p className="font-mono text-xs font-bold">{project.buildCommand ?? 'npm run build'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Output directory</p>
            <p className="font-mono text-xs font-bold">{project.outputDir ?? 'out'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.deployments && project.deployments.length > 0 ? (
            project.deployments.map((deployment) => (
              <div key={deployment.id} className="group rounded-xl bg-card/50 px-6 py-5 shadow-neo-sm transition-neo hover:shadow-neo hover:-translate-y-1">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-2">
                    <DeploymentStatusBadge status={deployment.status} />
                    <p className="text-sm font-medium text-muted-foreground">
                      {formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })}
                    </p>
                    {deployment.ipfsCid ? (
                      <a
                        href={`https://ipfs.io/ipfs/${deployment.ipfsCid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-cyan underline-offset-4 hover:underline font-semibold"
                      >
                        IPFS: {deployment.ipfsCid.slice(0, 12)}...
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
            <p className="text-sm text-muted-foreground font-medium">No deployments yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


