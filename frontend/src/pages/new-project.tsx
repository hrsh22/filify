import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { NewProjectForm } from '@/components/projects/new-project-form'
import { Separator } from '@/components/ui/separator'

export function NewProjectPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="pl-0 w-fit">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Button>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Create a new project</h1>
          <p className="text-muted-foreground">
            Connect your GitHub repository to start deploying to the decentralized web.
          </p>
        </div>
      </div>

      <Separator />

      <NewProjectForm />
    </div>
  )
}
