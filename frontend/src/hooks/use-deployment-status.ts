import { useCallback, useEffect, useRef, useState } from 'react'
import type { Deployment } from '@/types'
import { deploymentsService } from '@/services/deployments.service'

const POLL_INTERVAL_MS = 2000

export function useDeploymentStatus(deploymentId: string | undefined) {
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const fetchDeployment = useCallback(async () => {
    if (!deploymentId) {
      return
    }
    try {
      const data = await deploymentsService.getById(deploymentId)
      setDeployment(data)
      setError(null)
    } catch (err) {
      console.error('[useDeploymentStatus]', err)
      setError('Failed to load deployment status')
    } finally {
      setLoading(false)
    }
  }, [deploymentId])

  useEffect(() => {
    setLoading(true)
    setDeployment(null)
    void fetchDeployment()

    if (!deploymentId) {
      return
    }

    pollRef.current = window.setInterval(() => {
      void fetchDeployment()
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
    }
  }, [deploymentId, fetchDeployment])

  return {
    deployment,
    loading,
    error,
    refresh: fetchDeployment,
  }
}


