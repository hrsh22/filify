import { useNavigate } from 'react-router-dom'
import { FolderPlus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ProjectEmptyState() {
  const navigate = useNavigate()
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-6 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
          <FolderPlus className="h-10 w-10" />
      </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-2xl font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
          Connect a GitHub repository to spin up your first decentralized deployment.
        </p>
      </div>
        <Button onClick={() => navigate('/projects/new')} size="lg">
          <Sparkles className="h-4 w-4" />
        Create project
      </Button>
      </CardContent>
    </Card>
  )
}
