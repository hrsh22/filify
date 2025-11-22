import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/context/toast-context'
import { useNavigate } from 'react-router-dom'

interface SignOutButtonProps extends ButtonProps {
  label?: string
}

export function SignOutButton({ label = 'Sign out', ...props }: SignOutButtonProps) {
  const { logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogout = async () => {
    try {
      setIsSubmitting(true)
      await logout()
      showToast('Signed out', 'success')
      navigate('/')
    } catch (error) {
      console.error('[SignOutButton]', error)
      showToast('Failed to sign out', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button onClick={handleLogout} disabled={isSubmitting} variant="ghost" {...props}>
      <LogOut className="h-4 w-4" />
      {isSubmitting ? 'Signing out...' : label}
    </Button>
  )
}


