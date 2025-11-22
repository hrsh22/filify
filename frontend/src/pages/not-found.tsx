import { Home, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-card border border-border shadow-neo-lg">
        <SearchX className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-4 max-w-md">
        <h1 className="text-5xl font-bold text-foreground">404</h1>
        <p className="text-2xl font-bold text-foreground">Page not found</p>
        <p className="text-lg font-medium text-muted-foreground leading-relaxed">
          The page you requested does not exist.
        </p>
      </div>
      <Button onClick={() => navigate('/')} size="lg" className="shadow-neo">
        <Home className="h-5 w-5" />
        Go home
      </Button>
    </div>
  )
}


