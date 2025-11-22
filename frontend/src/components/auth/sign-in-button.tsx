import { Github } from 'lucide-react'
import { useAppKitAccount } from '@reown/appkit/react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'

interface SignInButtonProps extends ButtonProps {
  label?: string
}

export function SignInButton({ label = 'Sign in with GitHub', ...props }: SignInButtonProps) {
  const { login, loading } = useAuth()
  const { isConnected } = useAppKitAccount()
  const disabled = loading || !isConnected

  return (
    <Button onClick={login} disabled={disabled} title={!isConnected ? 'Connect your wallet first' : undefined} {...props}>
      <Github className="h-5 w-5" />
      {isConnected ? label : 'Connect wallet to continue'}
    </Button>
  )
}


