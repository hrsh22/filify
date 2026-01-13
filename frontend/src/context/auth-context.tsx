import { useDisconnect, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { useSignMessage } from 'wagmi'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SiweMessage } from 'siwe'
import type { User } from '@/types'
import { authService } from '@/services/auth.service'
import { onApiUnauthorized } from '@/services/api'
import { BACKEND_URL } from '@/utils/constants'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { disconnect } = useDisconnect()
  const { address, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork()
  const { signMessageAsync } = useSignMessage()

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error('Wallet not connected')
    }

    setLoading(true)
    try {
      const nonce = await authService.getNonce(address)

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Filify',
        uri: window.location.origin,
        version: '1',
        chainId: typeof chainId === 'number' ? chainId : 1,
        nonce,
      })

      const messageToSign = message.prepareMessage()
      const signature = await signMessageAsync({ message: messageToSign })

      const verifiedUser = await authService.verify(messageToSign, signature)
      setUser(verifiedUser)
    } finally {
      setLoading(false)
    }
  }, [address, isConnected, chainId, signMessageAsync])

  const logout = useCallback(async () => {
    await authService.logout()
    await disconnect()
    setUser(null)
  }, [disconnect])

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
