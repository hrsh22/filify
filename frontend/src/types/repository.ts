export interface RepositorySummary {
  id: number
  name: string
  fullName: string
  url: string
  cloneUrl: string
  defaultBranch: string
  private: boolean
  description?: string | null
  updatedAt?: string
  installationId: string
  accountLogin: string
}

export interface BranchSummary {
  name: string
  protected: boolean
}

export interface GitHubInstallation {
  id: string
  installationId: number
  accountLogin: string
  accountType: 'User' | 'Organization'
  accountAvatarUrl?: string | null
  createdAt: string
}

export interface GitHubInstallationsResponse {
  installations: GitHubInstallation[]
  githubAppName: string
}
