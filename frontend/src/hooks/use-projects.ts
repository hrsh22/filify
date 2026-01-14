import { useCallback, useEffect, useState } from 'react'
import type { Project } from '@/types'
import { projectsService } from '@/services/projects.service'
import { useNetwork } from '@/context/network-context'

export function useProjects() {
  const { network } = useNetwork()
  const [projects, setProjects] = useState<Project[]>([])
  const [githubAppName, setGithubAppName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const data = await projectsService.getAll(network)
      setProjects(data.projects)
      setGithubAppName(data.githubAppName)
      setError(null)
    } catch (err) {
      console.error('[useProjects]', err)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [network])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  return {
    projects,
    githubAppName,
    loading,
    error,
    refresh: fetchProjects,
  }
}
