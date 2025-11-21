import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function ProjectEmptyState() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-12 text-center">
      <p className="text-xl font-semibold">No projects yet</p>
      <p className="max-w-md text-sm text-muted-foreground">Connect a GitHub repository to spin up your first decentralized deployment.</p>
      <Button onClick={() => navigate('/projects/new')}>Create project</Button>
    </div>
  )
}


