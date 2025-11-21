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
}

export interface BranchSummary {
  name: string
  protected: boolean
}


