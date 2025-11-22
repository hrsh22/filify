import { Github } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'

interface SignInButtonProps extends ButtonProps {
  label?: string
}

export function SignInButton({ label = 'Sign in with GitHub', ...props }: SignInButtonProps) {
  const { login, loading } = useAuth()
  return (
    <Button onClick={login} disabled={loading} {...props}>
      <Github className="h-5 w-5" />
      {label}
    </Button>
  )
}


