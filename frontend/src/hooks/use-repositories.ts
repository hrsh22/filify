import { useCallback, useEffect, useState } from 'react'
import type { BranchSummary, RepositorySummary, GitHubInstallation } from '@/types'
import { repositoriesService } from '@/services/repositories.service'

export function useRepositories() {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([])
  const [installations, setInstallations] = useState<GitHubInstallation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRepos = useCallback(async () => {
    try {
      setLoading(true)
      const [repos, installs] = await Promise.all([
        repositoriesService.getAll(),
        repositoriesService.getInstallations(),
      ])
      setRepositories(repos)
      setInstallations(installs)
      setError(null)
    } catch (err) {
      console.error('[useRepositories]', err)
      setError('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRepos()
  }, [fetchRepos])

  return { repositories, installations, loading, error, refresh: fetchRepos }
}

export function useBranches(installationId: string | null, fullName: string | null) {
  const [branches, setBranches] = useState<BranchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBranches = useCallback(async () => {
    if (!fullName || !installationId) {
      setBranches([])
      return
    }
    try {
      setLoading(true)
      const data = await repositoriesService.getBranches(installationId, fullName)
      setBranches(data)
      setError(null)
    } catch (err) {
      console.error('[useBranches]', err)
      setError('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [installationId, fullName])

  useEffect(() => {
    void fetchBranches()
  }, [fetchBranches])

  return { branches, loading, error, refresh: fetchBranches }
}
