import type { User } from '@/types'
import { api } from './api'
import { BACKEND_URL } from '@/utils/constants'

export const authService = {
  login() {
    window.location.href = `${BACKEND_URL}/api/auth/github`
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


