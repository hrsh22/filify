import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-destructive">Authentication error</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spinner className="h-10 w-10 border-t-primary" />
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  )
}


