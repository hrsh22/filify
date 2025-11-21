import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-3xl font-semibold">Page not found</p>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
      <Button onClick={() => navigate('/')}>Go home</Button>
    </div>
  )
}


