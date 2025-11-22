import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { XCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/context/toast-context'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { checkAuth } = useAuth()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const hasError = params.get('error')
    const message = params.get('message')

    if (hasError || message) {
      setError(message ?? 'Authentication failed')
      return
    }

    let mounted = true
    ;(async () => {
      try {
        await checkAuth()
        if (mounted) {
          showToast('Signed in successfully', 'success')
          navigate('/dashboard', { replace: true })
        }
      } catch (err) {
        console.error('[AuthCallback]', err)
        if (mounted) {
          setError('Unable to verify session')
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [checkAuth, location.search, navigate, showToast])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-destructive/20 shadow-neo">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-3 text-center max-w-md">
          <p className="text-2xl font-bold text-destructive">Authentication error</p>
          <p className="text-base font-medium text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary border border-primary shadow-neo animate-pulse-glow">
        <Spinner className="h-10 w-10" />
      </div>
      <p className="text-base font-semibold text-muted-foreground">Completing sign in...</p>
    </div>
  )
}


