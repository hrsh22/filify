import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AuthErrorPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const message = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('message') ?? 'Something went wrong during authentication.'
  }, [location.search])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-destructive/20 shadow-neo-lg">
        <AlertCircle className="h-12 w-12 text-destructive" />
      </div>
      <div className="space-y-4 max-w-md">
        <h1 className="text-4xl font-bold text-foreground">Unable to sign in</h1>
        <p className="text-lg font-medium text-muted-foreground leading-relaxed">{message}</p>
      </div>
      <Button onClick={() => navigate('/')} size="lg" className="shadow-neo">
        <ArrowLeft className="h-5 w-5" />
        Back to landing
      </Button>
    </div>
  )
}


