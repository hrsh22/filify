import { useNavigate } from 'react-router-dom'
import { Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjects } from '@/hooks/use-projects'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectEmptyState } from '@/components/projects/project-empty-state'

export function DashboardPage() {
  const navigate = useNavigate()
  const { projects, loading, error, refresh } = useProjects()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-cyan">Overview</p>
          <h2 className="text-4xl font-bold text-foreground">Projects</h2>
          <p className="text-base text-muted-foreground font-medium">Manage your decentralized deployments</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} size="lg" className="shadow-neo">
          <Plus className="h-5 w-5" />
          New project
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-5 text-destructive border border-destructive/20 shadow-neo-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-6">
          {[...Array(2)].map((_, index) => (
            <Skeleton key={index} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <ProjectEmptyState />
      ) : (
        <div className="space-y-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onChange={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}


