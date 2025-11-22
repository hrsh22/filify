import axios from 'axios'

const DEFAULT_BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL
const unauthorizedListeners = new Set<() => void>()

function getBackendBaseUrl() {
  const configured = import.meta.env.VITE_BACKEND_URL
  const base = configured && configured.length > 0 ? configured : DEFAULT_BACKEND_BASE_URL
  return base.replace(/\/+$/, '')
}

export const api = axios.create({
  baseURL: `${getBackendBaseUrl()}/api`,
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


