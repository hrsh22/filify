import { useState, useEffect } from 'react'
import { Plus, Trash2, Github, Loader2, Settings, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/context/toast-context'
import { repositoriesService } from '@/services/repositories.service'
import { api } from '@/services/api'
import type { GitHubInstallation } from '@/types'

export function GitHubInstallationsManager() {
  const [installations, setInstallations] = useState<GitHubInstallation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [installationToDelete, setInstallationToDelete] = useState<GitHubInstallation | null>(null)
  const { showToast } = useToast()

  const fetchInstallations = async () => {
    try {
      const data = await repositoriesService.getInstallations()
      setInstallations(data.installations)
    } catch (error) {
      console.error('[GitHubInstallationsManager] Failed to fetch installations', error)
      showToast('Failed to load GitHub installations', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInstallations()
  }, [])

  const handleAddInstallation = async () => {
    try {
      const { data } = await api.get<{ url: string }>('/github/install')
      window.location.href = data.url
    } catch (error) {
      console.error('[GitHubInstallationsManager] Failed to get install URL', error)
      showToast('Failed to initiate GitHub connection', 'error')
    }
  }

  const handleDeleteClick = (installation: GitHubInstallation) => {
    setInstallationToDelete(installation)
  }

  const handleDeleteConfirm = async () => {
    if (!installationToDelete) return

    try {
      setIsDeleting(installationToDelete.id)
      await repositoriesService.removeInstallation(installationToDelete.id)
      
      setInstallations((prev) => 
        prev.filter((inst) => inst.id !== installationToDelete.id)
      )
      
      showToast('GitHub installation removed', 'success')
    } catch (error) {
      console.error('[GitHubInstallationsManager] Failed to remove installation', error)
      showToast('Failed to remove installation', 'error')
    } finally {
      setIsDeleting(null)
      setInstallationToDelete(null)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>GitHub Connections</CardTitle>
            <CardDescription>
              Manage your connected GitHub accounts and organizations
            </CardDescription>
          </div>
          <Button onClick={handleAddInstallation} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Connection
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : installations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Github className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm font-medium">No GitHub accounts connected</p>
            <p className="text-xs">Connect an account to start deploying projects</p>
          </div>
        ) : (
          <div className="space-y-4">
            {installations.map((installation) => (
              <div
                key={installation.id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={installation.accountAvatarUrl || undefined} />
                    <AvatarFallback>
                      {installation.accountLogin.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium leading-none">
                      {installation.accountLogin}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize mt-1">
                      {installation.accountType}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => window.open(
                      `https://github.com/settings/installations/${installation.installationId}`,
                      '_blank'
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Configure
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteClick(installation)}
                    disabled={isDeleting === installation.id}
                  >
                    {isDeleting === installation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog 
        open={!!installationToDelete} 
        onOpenChange={(open) => !open && setInstallationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove GitHub Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove access to repositories from{' '}
              <span className="font-semibold text-foreground">
                {installationToDelete?.accountLogin}
              </span>
              . Existing deployments will continue to work, but you won't be able to deploy updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
