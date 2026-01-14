import { useCallback, useEffect, useState } from 'react'
import type { Project } from '@/types'
import { projectsService } from '@/services/projects.service'

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [githubAppName, setGithubAppName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      return
    }
    try {
      setLoading(true)
      const data = await projectsService.getById(projectId)
      const { githubAppName: appName, ...projectData } = data
      setProject(projectData)
      setGithubAppName(appName)
      setError(null)
    } catch (err) {
      console.error('[useProject]', err)
      setError('Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchProject()
  }, [fetchProject])

  return {
    project,
    githubAppName,
    loading,
    error,
    refresh: fetchProject,
  }
}


