import { useNavigate } from 'react-router-dom'
import { Plus, FolderGit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useProjects } from '@/hooks/use-projects'
import { useAutoDeployPoller } from '@/hooks/use-auto-deploy-poller'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectEmptyState } from '@/components/projects/project-empty-state'
import { Separator } from '@/components/ui/separator'

export function DashboardPage() {
  const navigate = useNavigate()
  const { projects, githubAppName, loading, error, refresh } = useProjects()
  useAutoDeployPoller(true)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Overview</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `${projects.length} total project${projects.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button onClick={() => navigate('/projects/new')} size="lg" className="shadow-soft">
          <Plus className="h-5 w-5" />
          New project
        </Button>
      </div>

      <Separator />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-2">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <ProjectEmptyState />
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">All Projects</h2>
          <div className="grid gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} githubAppName={githubAppName} onChange={refresh} />
          ))}
          </div>
        </div>
      )}
    </div>
  )
}
