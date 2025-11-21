import { Link, NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { SignOutButton } from '@/components/auth/sign-out-button'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects/new', label: 'New project' },
]

export function AppHeader() {
  const { user } = useAuth()

  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="text-lg font-semibold">
            FilShip
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium text-muted-foreground md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'text-foreground' : 'hover:text-foreground')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground md:inline-flex">
                {user.githubUsername}
              </span>
              <Avatar src={user.avatarUrl ?? undefined} alt={user.githubUsername} />
              <SignOutButton variant="outline" />
            </>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link to="/">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}


