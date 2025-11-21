import axios from 'axios'

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api'
const unauthorizedListeners = new Set<() => void>()

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? DEFAULT_API_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function onApiUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('[api] unauthorized listener failed', error)
    }
  })
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      notifyUnauthorized()
    }
    return Promise.reject(error)
  }
)


