import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { Spinner } from '@/components/ui/spinner'

export function ProtectedRoute() {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 border-t-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}
