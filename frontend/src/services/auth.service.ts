import type { User } from '@/types'
import { api } from './api'

const DEFAULT_BACKEND_URL = 'http://localhost:3000'

function getBackendBaseUrl() {
  return import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') ?? DEFAULT_BACKEND_URL
}

export const authService = {
  login() {
    window.location.href = `${getBackendBaseUrl()}/api/auth/github`
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


