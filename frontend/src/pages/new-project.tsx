import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewProjectForm } from '@/components/projects/new-project-form'
import { useNavigate } from 'react-router-dom'

export function NewProjectPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-cyan">Projects</p>
          <h2 className="text-4xl font-bold text-foreground">Create a new project</h2>
          <p className="text-base text-muted-foreground font-medium">Connect your repository and configure deployment settings</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Button>
      </div>

      <NewProjectForm />
    </div>
  )
}


