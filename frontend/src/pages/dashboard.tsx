import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjects } from '@/hooks/use-projects'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectEmptyState } from '@/components/projects/project-empty-state'

export function DashboardPage() {
  const navigate = useNavigate()
  const { projects, loading, error, refresh } = useProjects()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Overview</p>
          <h2 className="text-2xl font-semibold">Projects</h2>
        </div>
        <Button onClick={() => navigate('/projects/new')}>New project</Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <ProjectEmptyState />
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onChange={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}


