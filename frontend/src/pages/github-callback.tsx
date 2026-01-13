import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/context/toast-context'

export function GitHubCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const path = location.pathname
    const params = new URLSearchParams(location.search)
    const returnPath = sessionStorage.getItem('github_return_path') || '/dashboard'
    sessionStorage.removeItem('github_return_path')

    if (path.includes('/github/success')) {
      setStatus('success')
      showToast('GitHub connected successfully!', 'success')
      setTimeout(() => navigate(returnPath, { replace: true }), 1500)
    } else if (path.includes('/github/error')) {
      setStatus('error')
      setErrorMessage(params.get('message') || 'Failed to connect GitHub')
    } else {
      setTimeout(() => navigate(returnPath, { replace: true }), 100)
    }
  }, [location, navigate, showToast])

  if (status === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/20 shadow-neo">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-3 text-center">
          <p className="text-2xl font-bold text-primary">GitHub Connected!</p>
          <p className="text-base font-medium text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-destructive/20 shadow-neo">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-3 text-center max-w-md">
          <p className="text-2xl font-bold text-destructive">Connection Failed</p>
          <p className="text-base font-medium text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary border border-primary shadow-neo animate-pulse-glow">
        <Spinner className="h-10 w-10" />
      </div>
      <p className="text-base font-semibold text-muted-foreground">Connecting GitHub...</p>
    </div>
  )
}
