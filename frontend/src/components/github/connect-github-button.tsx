import { Github } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button, type ButtonProps } from '@/components/ui/button'
import { api } from '@/services/api'

interface ConnectGitHubButtonProps extends ButtonProps {
  label?: string
}

export function ConnectGitHubButton({
  label = 'Connect GitHub',
  ...props
}: ConnectGitHubButtonProps) {
  const location = useLocation()

  const handleConnect = async () => {
    sessionStorage.setItem('github_return_path', location.pathname)
    const { data } = await api.get<{ url: string }>('/github/install')
    window.location.href = data.url
  }

  return (
    <Button onClick={handleConnect} {...props}>
      <Github className="h-5 w-5" />
      {label}
    </Button>
  )
}
