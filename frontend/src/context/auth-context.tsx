import { useDisconnect } from '@reown/appkit/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@/types'
import { authService } from '@/services/auth.service'
import { onApiUnauthorized } from '@/services/api'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { disconnect } = useDisconnect()

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    await disconnect()
    setUser(null)
  }, [disconnect])

  const login = useCallback(() => {
    authService.login()
  }, [])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  useEffect(() => {
    return onApiUnauthorized(() => {
      setUser(null)
      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      checkAuth,
    }),
    [user, loading, login, logout, checkAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


