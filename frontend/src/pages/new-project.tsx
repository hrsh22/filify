import { Button } from '@/components/ui/button'
import { NewProjectForm } from '@/components/projects/new-project-form'
import { useNavigate } from 'react-router-dom'

export function NewProjectPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Projects</p>
          <h2 className="text-2xl font-semibold">Create a new project</h2>
        </div>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </div>

      <NewProjectForm />
    </div>
  )
}


