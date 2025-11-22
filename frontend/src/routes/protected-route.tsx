import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppKitAccount } from '@reown/appkit/react'
import { useAuth } from '@/context/auth-context'
import { Spinner } from '@/components/ui/spinner'

export function ProtectedRoute() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { isConnected, status } = useAppKitAccount()

  const walletLoading = status === 'connecting' || status === 'reconnecting'

  if (loading || walletLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 border-t-primary" />
      </div>
    )
  }

  if (!user || !isConnected) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}


