import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function AuthErrorPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const message = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('message') ?? 'Something went wrong during authentication.'
  }, [location.search])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-3">
        <p className="text-2xl font-semibold">Unable to sign in</p>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <Button onClick={() => navigate('/')}>Back to landing</Button>
    </div>
  )
}


