import { useNavigate } from 'react-router-dom'
import { FolderPlus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ProjectEmptyState() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-xl bg-card border border-border px-8 py-16 text-center shadow-neo-lg">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary border border-primary shadow-neo animate-pulse-glow">
        <FolderPlus className="h-10 w-10 text-white" />
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold text-foreground">No projects yet</h3>
        <p className="max-w-md text-base font-medium text-muted-foreground leading-relaxed">
          Connect a GitHub repository to spin up your first decentralized deployment.
        </p>
      </div>
      <Button onClick={() => navigate('/projects/new')} size="lg" className="min-w-[200px]">
        <Sparkles className="h-5 w-5" />
        Create project
      </Button>
    </div>
  )
}


