import { Button, type ButtonProps } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'

interface SignInButtonProps extends ButtonProps {
  label?: string
}

export function SignInButton({ label = 'Sign in with GitHub', ...props }: SignInButtonProps) {
  const { login, loading } = useAuth()
  return (
    <Button onClick={login} disabled={loading} {...props}>
      {label}
    </Button>
  )
}


