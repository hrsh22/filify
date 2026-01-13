import type { User } from '@/types'
import { api } from './api'

export const authService = {
  async getNonce(address: string) {
    const { data } = await api.post<{ nonce: string }>('/auth/nonce', { address })
    return data.nonce
  },

  async verify(message: string, signature: string) {
    console.log('[AuthService][verify] Sending SIWE verification', {
      message: message.substring(0, 100) + '...',
      signature: signature.substring(0, 20) + '...',
    });

    try {
      const { data } = await api.post<User>('/auth/verify', { message, signature })
      console.log('[AuthService][verify] Verification successful', { walletAddress: data.walletAddress });
      return data
    } catch (error) {
      console.error('[AuthService][verify] Verification failed', {
        error: error instanceof Error ? error.message : String(error),
        responseStatus: (error as any)?.response?.status,
        responseData: (error as any)?.response?.data,
      });
      throw error
    }
  },

  async logout() {
    await api.post('/auth/logout')
  },

  async getCurrentUser() {
    const { data } = await api.get<User>('/auth/user')
    return data
  },

  async getStatus() {
    const { data } = await api.get<{ authenticated: boolean; user: User | null }>('/auth/status')
    return data
  },
}
